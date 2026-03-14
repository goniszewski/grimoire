/**
 * S3-compatible object storage helpers (TASK-037).
 *
 * Wraps @aws-sdk/client-s3 with a thin layer so callers never touch the SDK directly.
 * All operations return plain objects; errors propagate as thrown Error instances.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import type { BackupS3Settings } from "../settings.js";
import { log } from "../logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface S3RemoteEntry {
  key: string;
  size_bytes: number;
  last_modified: string;
}

// ─── Guard ───────────────────────────────────────────────────────────────────

/** Returns true when enough S3 config is present to attempt remote operations. */
export function s3ConfigPresent(s3: BackupS3Settings): boolean {
  return !!(s3.bucket && s3.access_key && s3.secret_key);
}

// ─── Client factory ───────────────────────────────────────────────────────────

function makeS3Client(s3: BackupS3Settings): S3Client {
  const cfg: ConstructorParameters<typeof S3Client>[0] = {
    region: s3.region || "us-east-1",
    credentials: {
      accessKeyId: s3.access_key,
      secretAccessKey: s3.secret_key,
    },
  };
  if (s3.endpoint) {
    cfg.endpoint = s3.endpoint;
    cfg.forcePathStyle = true; // required for MinIO / R2
  }
  return new S3Client(cfg);
}

// ─── Operations ───────────────────────────────────────────────────────────────

/**
 * Uploads a file to S3. Returns the S3 URI (s3://<bucket>/<key>).
 */
export async function uploadToS3(
  s3cfg: BackupS3Settings,
  key: string,
  data: Uint8Array,
  contentType = "application/octet-stream"
): Promise<string> {
  const client = makeS3Client(s3cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: s3cfg.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
  log.info("S3 upload complete", { bucket: s3cfg.bucket, key });
  return `s3://${s3cfg.bucket}/${key}`;
}

/**
 * Downloads an object from S3 and returns its bytes.
 */
export async function downloadFromS3(s3cfg: BackupS3Settings, key: string): Promise<Uint8Array> {
  const client = makeS3Client(s3cfg);
  const res = await client.send(
    new GetObjectCommand({ Bucket: s3cfg.bucket, Key: key })
  );
  if (!res.Body) throw new Error(`S3 object ${key} has no body`);
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — Body is a ReadableStream in Bun/Node; we consume it manually
  for await (const chunk of res.Body) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.length;
  }
  log.info("S3 download complete", { bucket: s3cfg.bucket, key, bytes: total });
  return buf;
}

/**
 * Lists objects under the configured prefix.
 */
/** Hard cap on how many remote objects we will load to protect against runaway pagination. */
const LIST_MAX_KEYS = 200;
const LIST_MAX_PAGES = 10;

export async function listS3Objects(s3cfg: BackupS3Settings): Promise<S3RemoteEntry[]> {
  const client = makeS3Client(s3cfg);
  const results: S3RemoteEntry[] = [];
  let continuationToken: string | undefined;
  let pages = 0;

  do {
    const res: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: s3cfg.bucket,
        Prefix: s3cfg.prefix,
        MaxKeys: LIST_MAX_KEYS,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      results.push({
        key: obj.Key,
        size_bytes: obj.Size ?? 0,
        last_modified: obj.LastModified?.toISOString() ?? new Date().toISOString(),
      });
    }
    pages++;
    continuationToken = res.IsTruncated && pages < LIST_MAX_PAGES ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
}

/**
 * Tests the S3 connection by issuing a HeadBucket request.
 * Throws on failure (bucket not found, wrong credentials, etc.).
 */
export async function testS3Connection(s3cfg: BackupS3Settings): Promise<void> {
  const client = makeS3Client(s3cfg);
  await client.send(new HeadBucketCommand({ Bucket: s3cfg.bucket }));
}
