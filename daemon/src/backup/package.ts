import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import { Buffer } from "buffer";
import { verifyBackupDirectory, type BackupVerificationResult } from "./verification.js";

const MAGIC = "LITTLEIMP-ENC-V1\n";
const PACKAGE_VERSION = 1;
const ARCHIVE_VERSION = 1;
const KDF_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const SNAPSHOT_FILE = "snapshot.db";
const MANIFEST_FILE = "manifest.json";
const CHECKSUM_FILE = "checksums.sha256";

type PackageMetadata = {
  version: number;
  archive: "littleimp-portable-snapshot-json-v1";
  cipher: "aes-256-gcm";
  kdf: "pbkdf2-sha256";
  iterations: number;
  salt: string;
  iv: string;
  created_at: string;
};

type ArchivePayload = {
  version: number;
  files: Array<{
    path: string;
    contents_base64: string;
  }>;
};

export type EncryptedBackupPackageResult = {
  path: string;
  source_path: string;
  encrypted: true;
  size_bytes: number;
  created_at: string;
};

export class BackupPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupPackageError";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const magicBytes = encoder.encode(MAGIC);

function assertPassword(password: string): void {
  if (password.length === 0) {
    throw new BackupPackageError("Password is required for encrypted backups");
  }
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function assertSafeBackupRelativePath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.includes("\\") ||
    relativePath.includes("..") ||
    isAbsolute(relativePath)
  ) {
    throw new BackupPackageError(`Invalid package path: ${relativePath}`);
  }
}

function isInsideDirectory(parentDir: string, childPath: string): boolean {
  const relativePath = relative(parentDir, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function assertOutputOutsideSource(sourceDir: string, outputPath: string): void {
  if (isInsideDirectory(sourceDir, outputPath)) {
    throw new BackupPackageError("Encrypted package output must be outside the source backup directory");
  }
}

function assertPackageOutputAvailable(outputPath: string): void {
  if (existsSync(outputPath)) {
    throw new BackupPackageError(`Encrypted package output already exists: ${outputPath}`);
  }
}

function assertExtractionTargetAvailable(outputDir: string): void {
  if (!existsSync(outputDir)) return;

  const stats = statSync(outputDir);
  if (!stats.isDirectory()) {
    throw new BackupPackageError("Output path must be a directory");
  }
  if (readdirSync(outputDir).length > 0) {
    throw new BackupPackageError("Output directory must be empty before extracting an encrypted backup package");
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: KDF_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

function encodePackage(metadata: PackageMetadata, ciphertext: Uint8Array): Uint8Array {
  const metadataBytes = encoder.encode(JSON.stringify(metadata));
  const output = new Uint8Array(magicBytes.length + 4 + metadataBytes.length + ciphertext.length);
  output.set(magicBytes, 0);
  new DataView(output.buffer).setUint32(magicBytes.length, metadataBytes.length, false);
  output.set(metadataBytes, magicBytes.length + 4);
  output.set(ciphertext, magicBytes.length + 4 + metadataBytes.length);
  return output;
}

function decodePackage(bytes: Uint8Array): { metadata: PackageMetadata; ciphertext: Uint8Array } {
  if (bytes.length < magicBytes.length + 4) {
    throw new BackupPackageError("Encrypted backup package is malformed");
  }

  for (let i = 0; i < magicBytes.length; i++) {
    if (bytes[i] !== magicBytes[i]) {
      throw new BackupPackageError("Encrypted backup package has an unsupported format");
    }
  }

  const metadataLength = new DataView(bytes.buffer, bytes.byteOffset + magicBytes.length, 4)
    .getUint32(0, false);
  const metadataStart = magicBytes.length + 4;
  const metadataEnd = metadataStart + metadataLength;
  if (metadataLength === 0 || metadataEnd > bytes.length) {
    throw new BackupPackageError("Encrypted backup package metadata is malformed");
  }

  let metadata: PackageMetadata;
  try {
    metadata = JSON.parse(decoder.decode(bytes.slice(metadataStart, metadataEnd))) as PackageMetadata;
  } catch {
    throw new BackupPackageError("Encrypted backup package metadata is malformed");
  }

  if (
    metadata.version !== PACKAGE_VERSION ||
    metadata.archive !== "littleimp-portable-snapshot-json-v1" ||
    metadata.cipher !== "aes-256-gcm" ||
    metadata.kdf !== "pbkdf2-sha256" ||
    metadata.iterations !== KDF_ITERATIONS
  ) {
    throw new BackupPackageError("Encrypted backup package uses an unsupported format");
  }

  return {
    metadata,
    ciphertext: bytes.slice(metadataEnd),
  };
}

function packageFileList(verifiedFiles: string[]): string[] {
  const files = new Set([SNAPSHOT_FILE, MANIFEST_FILE, CHECKSUM_FILE]);
  for (const file of verifiedFiles) files.add(file);
  return [...files];
}

async function buildArchive(sourceDir: string, files: string[]): Promise<ArchivePayload> {
  const root = resolve(sourceDir);
  const archiveFiles: ArchivePayload["files"] = [];

  for (const relativePath of files) {
    assertSafeBackupRelativePath(relativePath);
    const filePath = join(root, relativePath);
    if (!existsSync(filePath)) {
      throw new BackupPackageError(`Backup package input is missing ${relativePath}`);
    }
    archiveFiles.push({
      path: relativePath,
      contents_base64: Buffer.from(readFileSync(filePath)).toString("base64"),
    });
  }

  return {
    version: ARCHIVE_VERSION,
    files: archiveFiles,
  };
}

function parseArchive(bytes: ArrayBuffer): ArchivePayload {
  let parsed: ArchivePayload;
  try {
    parsed = JSON.parse(decoder.decode(bytes)) as ArchivePayload;
  } catch {
    throw new BackupPackageError("Decrypted backup package archive is malformed");
  }

  if (parsed.version !== ARCHIVE_VERSION || !Array.isArray(parsed.files)) {
    throw new BackupPackageError("Decrypted backup package archive is unsupported");
  }

  for (const file of parsed.files) {
    if (!file || typeof file.path !== "string" || typeof file.contents_base64 !== "string") {
      throw new BackupPackageError("Decrypted backup package archive is malformed");
    }
    assertSafeBackupRelativePath(file.path);
  }

  const uniquePaths = new Set(parsed.files.map((file) => file.path));
  if (uniquePaths.size !== parsed.files.length) {
    throw new BackupPackageError("Decrypted backup package archive contains duplicate file paths");
  }

  return parsed;
}

export async function createEncryptedBackupPackage(options: {
  sourceDir: string;
  outputPath: string;
  password: string;
}): Promise<EncryptedBackupPackageResult> {
  assertPassword(options.password);

  const sourceDir = resolve(options.sourceDir);
  const outputPath = resolve(options.outputPath);
  assertOutputOutsideSource(sourceDir, outputPath);
  assertPackageOutputAvailable(outputPath);
  const verification = await verifyBackupDirectory(sourceDir);
  const archive = await buildArchive(sourceDir, packageFileList(verification.verified_files));
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(options.password, salt, ["encrypt"]);
  const createdAt = new Date().toISOString();
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(archive))
    )
  );

  const metadata: PackageMetadata = {
    version: PACKAGE_VERSION,
    archive: "littleimp-portable-snapshot-json-v1",
    cipher: "aes-256-gcm",
    kdf: "pbkdf2-sha256",
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    created_at: createdAt,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encodePackage(metadata, ciphertext), { flag: "wx" });

  return {
    path: outputPath,
    source_path: sourceDir,
    encrypted: true,
    size_bytes: statSync(outputPath).size,
    created_at: createdAt,
  };
}

export async function extractEncryptedBackupPackage(options: {
  packagePath: string;
  outputDir: string;
  password: string;
}): Promise<BackupVerificationResult> {
  assertPassword(options.password);

  const packagePath = resolve(options.packagePath);
  const outputDir = resolve(options.outputDir);
  assertExtractionTargetAvailable(outputDir);
  const bytes = new Uint8Array(await Bun.file(packagePath).arrayBuffer());
  const { metadata, ciphertext } = decodePackage(bytes);
  const key = await deriveKey(options.password, fromBase64(metadata.salt), ["decrypt"]);

  let archiveBytes: ArrayBuffer;
  try {
    archiveBytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(metadata.iv) },
      key,
      ciphertext
    );
  } catch {
    throw new BackupPackageError("Could not decrypt backup package; password is incorrect or package is corrupted");
  }

  const archive = parseArchive(archiveBytes);
  const writtenFiles: string[] = [];

  try {
    mkdirSync(outputDir, { recursive: true });
    for (const file of archive.files) {
      const filePath = join(outputDir, file.path);
      mkdirSync(dirname(filePath), { recursive: true });
      await Bun.write(filePath, fromBase64(file.contents_base64));
      writtenFiles.push(filePath);
    }

    return await verifyBackupDirectory(outputDir);
  } catch (err) {
    for (const filePath of writtenFiles.reverse()) {
      try {
        rmSync(filePath, { force: true });
      } catch {
        // Best effort cleanup after failed extraction.
      }
    }
    throw err;
  }
}
