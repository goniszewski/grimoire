import { existsSync, readFileSync } from "fs";
import { isAbsolute, join, resolve } from "path";

const BACKUP_FORMAT_VERSION = 1;
const CHECKSUM_ALGORITHM = "sha256";
const SNAPSHOT_FILE = "snapshot.db";
const MANIFEST_FILE = "manifest.json";
const CHECKSUM_FILE = "checksums.sha256";
const SETTINGS_FILE = "data/settings.json";

type BackupManifest = {
  version?: number;
  backup_format_version?: number;
  app_version?: string;
  created_at?: string;
  db_size_bytes?: number;
  bookmark_count?: number;
  database?: {
    filename?: string;
    schema_version?: string;
    size_bytes?: number;
  };
  settings?: {
    included?: boolean;
    filename?: string;
    secrets_policy?: string;
  };
  checksum_algorithm?: string;
  included_files?: unknown;
  compatibility?: {
    min_app_version?: string;
    restore_supported?: boolean;
  };
};

export type BackupVerificationResult = {
  ok: true;
  path: string;
  checksum_verified: true;
  verified_files: string[];
  bookmark_count: number;
  created_at: string;
};

export class BackupVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupVerificationError";
  }
}

async function sha256File(path: string): Promise<string> {
  const data = await Bun.file(path).arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function assertSafeBackupRelativePath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.includes("\\") ||
    relativePath.includes("..") ||
    isAbsolute(relativePath)
  ) {
    throw new BackupVerificationError(`Invalid checksum path: ${relativePath}`);
  }
}

function parseChecksumFile(contents: string): Array<{ hash: string; relativePath: string }> {
  const entries = contents
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-fA-F0-9]{64})\s{2}(.+)$/);
      if (!match) {
        throw new BackupVerificationError("Checksum file is malformed");
      }
      const [, hash, relativePath] = match;
      assertSafeBackupRelativePath(relativePath);
      return { hash: hash.toLowerCase(), relativePath };
    });

  if (entries.length === 0) {
    throw new BackupVerificationError("Checksum file is empty");
  }

  return entries;
}

function readManifest(path: string): BackupManifest {
  if (!existsSync(path)) {
    throw new BackupVerificationError("Backup manifest is required");
  }

  let parsed: BackupManifest;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as BackupManifest;
  } catch {
    throw new BackupVerificationError("Backup manifest is malformed");
  }

  const formatVersion = parsed.backup_format_version ?? parsed.version;
  if (typeof formatVersion !== "number" || !Number.isSafeInteger(formatVersion) || formatVersion < 1) {
    throw new BackupVerificationError("Backup manifest is missing backup_format_version");
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupVerificationError(`Unsupported backup format version: ${formatVersion}`);
  }

  if (parsed.checksum_algorithm && parsed.checksum_algorithm !== CHECKSUM_ALGORITHM) {
    throw new BackupVerificationError(`Unsupported checksum algorithm: ${parsed.checksum_algorithm}`);
  }

  if (parsed.compatibility?.restore_supported === false) {
    throw new BackupVerificationError("Backup manifest marks restore as unsupported");
  }

  if (parsed.database?.filename && parsed.database.filename !== SNAPSHOT_FILE) {
    throw new BackupVerificationError(`Unsupported database filename in manifest: ${parsed.database.filename}`);
  }

  if (parsed.settings?.included && parsed.settings.filename !== SETTINGS_FILE) {
    throw new BackupVerificationError(`Unsupported settings filename in manifest: ${parsed.settings.filename}`);
  }

  if (parsed.included_files !== undefined) {
    if (!Array.isArray(parsed.included_files)) {
      throw new BackupVerificationError("Backup manifest included_files must be an array");
    }
    for (const relativePath of parsed.included_files) {
      if (typeof relativePath !== "string") {
        throw new BackupVerificationError("Backup manifest included_files must contain only strings");
      }
      assertSafeBackupRelativePath(relativePath);
    }
  }

  return parsed;
}

async function verifyChecksums(rootDir: string, checksumPath: string): Promise<string[]> {
  if (!existsSync(checksumPath)) {
    throw new BackupVerificationError("Backup checksum file is required");
  }

  const entries = parseChecksumFile(await Bun.file(checksumPath).text());
  const verified: string[] = [];
  for (const entry of entries) {
    const filePath = join(rootDir, entry.relativePath);
    if (!existsSync(filePath)) {
      throw new BackupVerificationError(`Checksum entry is missing file: ${entry.relativePath}`);
    }
    const actualHash = await sha256File(filePath);
    if (actualHash !== entry.hash) {
      throw new BackupVerificationError(`Checksum mismatch for ${entry.relativePath}; backup file may be corrupted`);
    }
    verified.push(entry.relativePath);
  }

  if (!verified.includes(SNAPSHOT_FILE)) {
    throw new BackupVerificationError("Checksum file must include snapshot.db");
  }

  return verified;
}

export async function verifyBackupDirectory(path: string): Promise<BackupVerificationResult> {
  const backupRoot = resolve(path);
  const snapshotPath = join(backupRoot, SNAPSHOT_FILE);
  const checksumPath = join(backupRoot, CHECKSUM_FILE);
  const manifestPath = join(backupRoot, MANIFEST_FILE);

  if (!existsSync(snapshotPath)) {
    throw new BackupVerificationError("Backup directory is missing snapshot.db");
  }

  const manifest = readManifest(manifestPath);
  const verifiedFiles = await verifyChecksums(backupRoot, checksumPath);

  if (manifest.settings?.included && !verifiedFiles.includes(SETTINGS_FILE)) {
    throw new BackupVerificationError("Checksum file must include backed-up settings");
  }

  return {
    ok: true,
    path: backupRoot,
    checksum_verified: true,
    verified_files: verifiedFiles,
    bookmark_count: manifest.bookmark_count ?? 0,
    created_at: manifest.created_at ?? new Date(0).toISOString(),
  };
}
