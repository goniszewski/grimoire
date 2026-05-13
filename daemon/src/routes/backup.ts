import { Hono } from "hono";
import { Database } from "bun:sqlite";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  statSync,
  copyFileSync,
  renameSync,
  readFileSync,
  rmSync,
  existsSync,
  writeFileSync,
  accessSync,
  constants as fsConstants,
} from "fs";
import { join, resolve, basename, dirname, isAbsolute } from "path";
import { tmpdir } from "os";
import { version as APP_VERSION } from "../../package.json";
import { Config } from "../config.js";
import { log } from "../logger.js";
import { settingsManager, type Settings } from "../settings.js";
import { nextCronRunAt } from "../lib/cron.js";
import {
  s3ConfigPresent,
  uploadToS3,
  downloadFromS3,
  listS3Objects,
  testS3Connection,
} from "../lib/s3.js";
import { runMigrations } from "../db/migrations.js";

interface BackupDeps {
  db: Database;
  /** Absolute path to the live SQLite file. */
  dbPath: string;
  /** Data directory root. Defaults to Config.DATA_DIR. */
  dataDir?: string;
  /**
   * Override S3 config — used in tests to inject mocked settings without
   * touching the settingsManager singleton.
   */
  s3Config?: import("../settings.js").BackupS3Settings;
}

const BACKUP_FORMAT_VERSION = 1;
const CHECKSUM_ALGORITHM = "sha256";
const SETTINGS_SECRETS_POLICY = "secrets omitted; current local secrets are preserved on restore";
const SNAPSHOT_FILE = "snapshot.db";
const MANIFEST_FILE = "manifest.json";
const CHECKSUM_FILE = "checksums.sha256";
const SETTINGS_FILE = "data/settings.json";

type PortableSettings = {
  ai: {
    provider: Settings["ai"]["provider"];
    openai: { model: string };
    ollama: Settings["ai"]["ollama"];
    embeddings: Settings["ai"]["embeddings"];
  };
  app: {
    autostart: boolean;
    theme: Settings["app"]["theme"];
    lock: { enabled: boolean };
  };
  backup: {
    local: Settings["backup"]["local"];
    schedule: Settings["backup"]["schedule"];
    s3: Pick<Settings["backup"]["s3"], "endpoint" | "bucket" | "region" | "prefix">;
  };
};

interface BackupManifest {
  version: number;
  backup_format_version: number;
  app_version: string;
  created_at: string;
  db_size_bytes: number;
  bookmark_count: number;
  database: {
    filename: typeof SNAPSHOT_FILE;
    schema_version: string;
    size_bytes: number;
  };
  settings: {
    included: boolean;
    filename: typeof SETTINGS_FILE;
    secrets_policy: typeof SETTINGS_SECRETS_POLICY;
  };
  checksum_algorithm: typeof CHECKSUM_ALGORITHM;
  included_files: string[];
  compatibility: {
    min_app_version: string;
    restore_supported: boolean;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function backupsDir(dataDir: string): string {
  return join(dataDir, "backups");
}

/** Compute SHA-256 hex digest of a file. */
async function sha256File(path: string): Promise<string> {
  const data = await Bun.file(path).arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** ISO-8601 timestamp safe for use in filenames (colons and dots replaced). */
function safeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-");
}

function countBookmarks(db: Database): number {
  const row = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM bookmarks").get();
  return row?.n ?? 0;
}

/**
 * Assert that a constructed file path contains no single-quote characters.
 * This guards the VACUUM INTO SQL string interpolation against injection if the
 * path derivation ever changes (e.g. DATA_DIR set by an operator to a path
 * containing unusual characters). Throws if violated.
 */
function assertSafeSqlPath(path: string): void {
  if (path.includes("'")) {
    throw new Error(`Unsafe path for SQL: contains single-quote character: ${path}`);
  }
}

function statusError(message: string, status = 422): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function currentSchemaVersion(db: Database): string {
  try {
    const row = db
      .query<{ version: string }, []>("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
      .get();
    return row?.version ?? "0000";
  } catch {
    return "0000";
  }
}

function portableSettings(settings: Settings): PortableSettings {
  return {
    ai: {
      provider: settings.ai.provider,
      openai: {
        model: settings.ai.openai.model,
      },
      ollama: {
        base_url: settings.ai.ollama.base_url,
        model: settings.ai.ollama.model,
      },
      embeddings: {
        provider: settings.ai.embeddings.provider,
        model: settings.ai.embeddings.model,
      },
    },
    app: {
      autostart: settings.app.autostart,
      theme: settings.app.theme,
      lock: {
        enabled: settings.app.lock.enabled,
      },
    },
    backup: {
      local: {
        destination_path: settings.backup.local.destination_path,
      },
      schedule: {
        enabled: settings.backup.schedule.enabled,
        cron: settings.backup.schedule.cron,
        retention_count: settings.backup.schedule.retention_count,
      },
      s3: {
        endpoint: settings.backup.s3.endpoint,
        bucket: settings.backup.s3.bucket,
        region: settings.backup.s3.region,
        prefix: settings.backup.s3.prefix,
      },
    },
  };
}

function assertSafeBackupRelativePath(relativePath: string): void {
  if (
    !relativePath ||
    relativePath.includes("\\") ||
    relativePath.includes("..") ||
    isAbsolute(relativePath)
  ) {
    throw statusError(`Invalid checksum path: ${relativePath}`);
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
        throw statusError("Checksum file is malformed");
      }
      const [, hash, relativePath] = match;
      assertSafeBackupRelativePath(relativePath);
      return { hash: hash.toLowerCase(), relativePath };
    });

  if (entries.length === 0) {
    throw statusError("Checksum file is empty");
  }

  return entries;
}

async function writeChecksums(rootDir: string, relativePaths: string[], checksumPath: string): Promise<void> {
  const lines: string[] = [];
  for (const relativePath of relativePaths) {
    assertSafeBackupRelativePath(relativePath);
    const hash = await sha256File(join(rootDir, relativePath));
    lines.push(`${hash}  ${relativePath}`);
  }
  await Bun.write(checksumPath, `${lines.join("\n")}\n`);
}

async function verifyChecksums(rootDir: string, checksumPath: string): Promise<string[]> {
  if (!existsSync(checksumPath)) {
    throw statusError("Backup checksum file is required");
  }

  const entries = parseChecksumFile(await Bun.file(checksumPath).text());
  const verified: string[] = [];
  for (const entry of entries) {
    const filePath = join(rootDir, entry.relativePath);
    if (!existsSync(filePath)) {
      throw statusError(`Checksum entry is missing file: ${entry.relativePath}`);
    }
    const actualHash = await sha256File(filePath);
    if (actualHash !== entry.hash) {
      throw statusError(`Checksum mismatch for ${entry.relativePath} — backup file may be corrupted`);
    }
    verified.push(entry.relativePath);
  }

  if (!verified.includes(SNAPSHOT_FILE)) {
    throw statusError("Checksum file must include snapshot.db");
  }

  return verified;
}

function readManifest(manifestPath: string, maxSchemaVersion: string): BackupManifest {
  if (!existsSync(manifestPath)) {
    throw statusError("Backup manifest is required");
  }

  let parsed: Partial<BackupManifest> & { version?: number };
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<BackupManifest> & { version?: number };
  } catch {
    throw statusError("Backup manifest is malformed");
  }

  const formatVersion = parsed.backup_format_version ?? parsed.version;
  if (typeof formatVersion !== "number" || !Number.isSafeInteger(formatVersion) || formatVersion < 1) {
    throw statusError("Backup manifest is missing backup_format_version");
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw statusError(`Unsupported backup format version: ${formatVersion}`);
  }

  if (parsed.checksum_algorithm && parsed.checksum_algorithm !== CHECKSUM_ALGORITHM) {
    throw statusError(`Unsupported checksum algorithm: ${parsed.checksum_algorithm}`);
  }

  if (parsed.compatibility?.restore_supported === false) {
    throw statusError("Backup manifest marks restore as unsupported");
  }

  if (parsed.database?.filename && parsed.database.filename !== SNAPSHOT_FILE) {
    throw statusError(`Unsupported database filename in manifest: ${parsed.database.filename}`);
  }

  if (parsed.settings?.included && parsed.settings.filename !== SETTINGS_FILE) {
    throw statusError(`Unsupported settings filename in manifest: ${parsed.settings.filename}`);
  }

  if (parsed.included_files && !Array.isArray(parsed.included_files)) {
    throw statusError("Backup manifest included_files must be an array");
  }

  if (parsed.included_files) {
    for (const relativePath of parsed.included_files) {
      if (typeof relativePath !== "string") {
        throw statusError("Backup manifest included_files must contain only strings");
      }
      assertSafeBackupRelativePath(relativePath);
    }
  }

  const schemaVersion = parsed.database?.schema_version;
  if (schemaVersion !== undefined && typeof schemaVersion !== "string") {
    throw statusError("Backup database schema_version must be a string");
  }
  if (schemaVersion && schemaVersion > maxSchemaVersion) {
    throw statusError(`Backup schema version ${schemaVersion} is newer than this daemon supports`);
  }

  return {
    version: parsed.version ?? formatVersion,
    backup_format_version: formatVersion,
    app_version: parsed.app_version ?? "unknown",
    created_at: parsed.created_at ?? new Date(0).toISOString(),
    db_size_bytes: parsed.db_size_bytes ?? parsed.database?.size_bytes ?? 0,
    bookmark_count: parsed.bookmark_count ?? 0,
    database: parsed.database ?? {
      filename: SNAPSHOT_FILE,
      schema_version: "0000",
      size_bytes: parsed.db_size_bytes ?? 0,
    },
    settings: parsed.settings ?? {
      included: false,
      filename: SETTINGS_FILE,
      secrets_policy: SETTINGS_SECRETS_POLICY,
    },
    checksum_algorithm: parsed.checksum_algorithm ?? CHECKSUM_ALGORITHM,
    included_files: parsed.included_files ?? [SNAPSHOT_FILE],
    compatibility: parsed.compatibility ?? {
      min_app_version: "0.0.0",
      restore_supported: true,
    },
  };
}

// ─── Shared backup creation ───────────────────────────────────────────────────

export interface BackupResult {
  path: string;
  size_bytes: number;
  bookmark_count: number;
  created_at: string;
  remote_url?: string;
}

/**
 * Creates a new backup snapshot in <resolvedBackupsDir>/<timestamp>/.
 * Exported for use by the scheduler (backup-snapshot task).
 */
export async function createBackupSnapshot(
  db: Database,
  resolvedBackupsDir: string
): Promise<BackupResult> {
  mkdirSync(resolvedBackupsDir, { recursive: true });

  const ts = safeTimestamp();
  const backupDir = join(resolvedBackupsDir, ts);
  mkdirSync(backupDir, { recursive: true });

  const snapshotPath = join(backupDir, SNAPSHOT_FILE);
  const manifestPath = join(backupDir, MANIFEST_FILE);
  const checksumPath = join(backupDir, CHECKSUM_FILE);
  const settingsPath = join(backupDir, SETTINGS_FILE);

  try {
    assertSafeSqlPath(snapshotPath);
    db.exec(`VACUUM INTO '${snapshotPath}'`);

    mkdirSync(join(backupDir, "data"), { recursive: true });
    await Bun.write(settingsPath, JSON.stringify(portableSettings(settingsManager.read()), null, 2));

    const snapshotStat = statSync(snapshotPath);
    const bookmarkCount = countBookmarks(db);
    const createdAt = new Date().toISOString();
    const includedFiles = [SNAPSHOT_FILE, SETTINGS_FILE];

    const manifest: BackupManifest = {
      version: 1,
      backup_format_version: BACKUP_FORMAT_VERSION,
      app_version: APP_VERSION,
      created_at: createdAt,
      db_size_bytes: snapshotStat.size,
      bookmark_count: bookmarkCount,
      database: {
        filename: SNAPSHOT_FILE,
        schema_version: currentSchemaVersion(db),
        size_bytes: snapshotStat.size,
      },
      settings: {
        included: true,
        filename: SETTINGS_FILE,
        secrets_policy: SETTINGS_SECRETS_POLICY,
      },
      checksum_algorithm: CHECKSUM_ALGORITHM,
      included_files: includedFiles,
      compatibility: {
        min_app_version: "0.0.0",
        restore_supported: true,
      },
    };

    await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
    await writeChecksums(backupDir, includedFiles, checksumPath);

    log.info("Backup created", { path: backupDir, bookmarkCount });

    return {
      path: backupDir,
      size_bytes: snapshotStat.size,
      bookmark_count: bookmarkCount,
      created_at: createdAt,
    };
  } catch (err) {
    // Clean up partial backup directory so the list doesn't show corrupt entries.
    try { rmSync(backupDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    throw err;
  }
}

// ─── Retention ────────────────────────────────────────────────────────────────

interface BackupEntry {
  name: string;
  path: string;
  size_bytes: number;
  bookmark_count: number;
  created_at: string;
  source: "local" | "remote";
}

/** Lists all valid backups in a directory, sorted newest first. */
function listBackups(resolvedBackupsDir: string): BackupEntry[] {
  let entries: string[];
  try {
    mkdirSync(resolvedBackupsDir, { recursive: true });
    entries = readdirSync(resolvedBackupsDir);
  } catch {
    return [];
  }

  const mapped: Array<BackupEntry | null> = entries.map((name) => {
    const fullPath = join(resolvedBackupsDir, name);
    try {
      const st = statSync(fullPath);
      if (!st.isDirectory()) return null;
      const manifestPath = join(fullPath, "manifest.json");
      if (!existsSync(join(fullPath, SNAPSHOT_FILE)) || !existsSync(join(fullPath, CHECKSUM_FILE))) {
        return null;
      }
      let manifest: { created_at?: string; db_size_bytes?: number; bookmark_count?: number } = {};
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as typeof manifest;
      } catch {
        return null;
      }
      return {
        name,
        path: fullPath,
        size_bytes: manifest.db_size_bytes ?? st.size,
        bookmark_count: manifest.bookmark_count ?? 0,
        created_at: manifest.created_at ?? new Date(st.mtimeMs).toISOString(),
        source: "local" as BackupEntry["source"],
      };
    } catch {
      return null;
    }
  });

  return mapped
    .filter((e): e is BackupEntry => e !== null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/**
 * Deletes the oldest backups beyond retentionCount.
 * Returns the number of backups deleted.
 */
export function applyRetentionPolicy(resolvedBackupsDir: string, retentionCount: number): number {
  const all = listBackups(resolvedBackupsDir);
  const toDelete = all.slice(retentionCount); // oldest are at the end (sorted newest-first)
  let deleted = 0;
  for (const entry of toDelete) {
    try {
      rmSync(entry.path, { recursive: true, force: true });
      log.info("Backup retention: deleted old snapshot", { name: entry.name });
      deleted++;
    } catch (err) {
      log.warn("Backup retention: failed to delete snapshot", { name: entry.name, error: String(err) });
    }
  }
  return deleted;
}

// ─── Route factory ────────────────────────────────────────────────────────────

/**
 * Check whether an existing directory is writable WITHOUT creating it.
 * Use this for read-only status probes (e.g. GET /backup/destination).
 */
function checkWritable(dir: string): boolean {
  try {
    accessSync(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists and is writable.
 * Creates the directory if absent (idempotent via mkdirSync recursive).
 * Use this before writing — not for read-only status checks.
 */
function ensureWritable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function createBackupRoute(deps: BackupDeps): Hono {
  const router = new Hono();
  const resolvedDataDir = deps.dataDir ?? Config.DATA_DIR;
  const defaultBackupsDir = resolve(backupsDir(resolvedDataDir));

  /** Returns the effective S3 config: injected dep (tests) or live settings. */
  function getS3Config() {
    return deps.s3Config ?? settingsManager.read().backup.s3;
  }

  /**
   * Returns the effective backup directory:
   * custom destination_path from settings (when set and absolute), or the default.
   */
  function getBackupsDir(): string {
    if (deps.dataDir !== undefined) {
      // In tests we always use the injected dataDir — skip settings lookup.
      return defaultBackupsDir;
    }
    const customPath = settingsManager.read().backup.local?.destination_path ?? "";
    if (customPath && isAbsolute(customPath)) {
      return resolve(customPath);
    }
    return defaultBackupsDir;
  }

  /** In-flight operation guard — prevents concurrent backup or restore operations. */
  let operationInProgress = false;

  /**
   * POST /backup
   * Creates a new backup snapshot in the configured backup directory.
   * If S3 config is present, also uploads the snapshot to S3.
   * Returns metadata about the created backup (including remote_url when uploaded).
   */
  router.post("/backup", async (c) => {
    if (operationInProgress) {
      return c.json({ error: "A backup or restore operation is already in progress" }, 409);
    }
    operationInProgress = true;

    try {
      const result = await createBackupSnapshot(deps.db, getBackupsDir());

      // S3 upload — optional, runs after local backup succeeds
      const s3cfg = getS3Config();
      if (s3ConfigPresent(s3cfg)) {
        try {
          const backupName = basename(result.path);
          const extraFiles: Array<{ relativePath: string; contentType: string }> = [
            { relativePath: MANIFEST_FILE, contentType: "application/json" },
            { relativePath: SETTINGS_FILE, contentType: "application/json" },
            { relativePath: CHECKSUM_FILE, contentType: "text/plain" },
          ];
          for (const file of extraFiles) {
            const filePath = join(result.path, file.relativePath);
            if (!existsSync(filePath)) continue;
            await uploadToS3(
              s3cfg,
              `${s3cfg.prefix}${backupName}/${file.relativePath}`,
              await Bun.file(filePath).bytes(),
              file.contentType
            );
          }

          // Upload the snapshot last. Remote listing only exposes snapshot.db
          // entries with manifest/checksum companions, so partial uploads are
          // not shown as restorable backups.
          const s3Key = `${s3cfg.prefix}${backupName}/snapshot.db`;
          const remoteUrl = await uploadToS3(
            s3cfg,
            s3Key,
            await Bun.file(join(result.path, SNAPSHOT_FILE)).bytes()
          );

          return c.json({ ...result, remote_url: remoteUrl }, 201);
        } catch (uploadErr) {
          log.warn("S3 upload failed (local backup kept)", { error: String(uploadErr) });
          // Local backup is still valid — return it without remote_url
        }
      }

      return c.json(result, 201);
    } catch (err) {
      log.error("Backup failed", { error: String(err) });
      return c.json({ error: "Failed to create backup" }, 500);
    } finally {
      operationInProgress = false;
    }
  });

  /**
   * GET /backup/list[?include_remote=true]
   * Lists local backups (newest first).
   * When ?include_remote=true, also lists objects from S3 and merges them.
   */
  router.get("/backup/list", async (c) => {
    const local = listBackups(getBackupsDir());

    const includeRemote = c.req.query("include_remote") === "true";
    if (!includeRemote) {
      return c.json({ data: local });
    }

    const s3cfg = getS3Config();
    if (!s3ConfigPresent(s3cfg)) {
      return c.json({ error: "S3 is not configured" }, 422);
    }

    let remoteEntries: BackupEntry[] = [];
    try {
      const objects = await listS3Objects(s3cfg);
      const objectKeys = new Set(objects.map((obj) => obj.key));
      remoteEntries = objects
        .filter((obj) => {
          if (!obj.key.endsWith(`/${SNAPSHOT_FILE}`)) return false;
          const manifestKey = obj.key.replace(/\/snapshot\.db$/, `/${MANIFEST_FILE}`);
          const checksumKey = obj.key.replace(/\/snapshot\.db$/, `/${CHECKSUM_FILE}`);
          return objectKeys.has(manifestKey) && objectKeys.has(checksumKey);
        })
        .map((obj) => ({
          name: obj.key,
          path: `s3://${s3cfg.bucket}/${obj.key}`,
          size_bytes: obj.size_bytes,
          bookmark_count: 0,
          created_at: obj.last_modified,
          source: "remote" as const,
        }));
    } catch (err) {
      log.warn("Failed to list S3 objects", { error: String(err) });
      return c.json({ error: "Failed to list remote backups" }, 500);
    }

    // Merge: local first, then remote, sorted newest first
    const all = [...local, ...remoteEntries].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
    return c.json({ data: all });
  });

  /**
   * GET /backup/schedule
   * Returns the current schedule configuration and next run time.
   */
  router.get("/backup/schedule", (c) => {
    const settings = settingsManager.read();
    const { enabled, cron, retention_count } = settings.backup.schedule;
    const next_run_at = enabled ? nextCronRunAt(cron)?.toISOString() ?? null : null;
    return c.json({ data: { enabled, cron, retention_count, next_run_at } });
  });

  /**
   * PUT /backup/schedule
   * Updates the backup schedule configuration.
   * Body: { enabled?: boolean; cron?: string; retention_count?: number }
   */
  router.put("/backup/schedule", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Request body must be valid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json({ error: "Request body must be an object" }, 400);
    }

    const patch = body as Record<string, unknown>;

    if ("enabled" in patch && typeof patch.enabled !== "boolean") {
      return c.json({ error: "`enabled` must be a boolean" }, 422);
    }

    if ("cron" in patch) {
      if (typeof patch.cron !== "string" || !(patch.cron as string).trim()) {
        return c.json({ error: "`cron` must be a non-empty string" }, 422);
      }
      const parts = (patch.cron as string).trim().split(/\s+/);
      if (parts.length !== 5) {
        return c.json({ error: "`cron` must be a 5-part cron expression (e.g. \"0 3 * * *\")" }, 422);
      }
    }

    if ("retention_count" in patch) {
      const rc = patch.retention_count;
      if (typeof rc !== "number" || !Number.isInteger(rc) || rc < 1) {
        return c.json({ error: "`retention_count` must be a positive integer" }, 422);
      }
    }

    try {
      const updated = settingsManager.write({
        backup: {
          schedule: {
            enabled: ("enabled" in patch ? patch.enabled : undefined) as boolean | undefined,
            cron: ("cron" in patch ? patch.cron : undefined) as string | undefined,
            retention_count: ("retention_count" in patch ? patch.retention_count : undefined) as number | undefined,
          } as { enabled: boolean; cron: string; retention_count: number },
        } as import("../settings.js").Settings["backup"],
      });
      const s = updated.backup.schedule;
      const next_run_at = s.enabled ? nextCronRunAt(s.cron)?.toISOString() ?? null : null;
      return c.json({ data: { enabled: s.enabled, cron: s.cron, retention_count: s.retention_count, next_run_at } });
    } catch (err) {
      log.error("Failed to persist schedule settings", { error: String(err) });
      return c.json({ error: "Failed to save schedule settings" }, 500);
    }
  });

  /**
   * GET /backup/destination
   * Returns the current backup folder path, whether it's custom, and whether it's writable.
   */
  router.get("/backup/destination", (c) => {
    const currentPath = getBackupsDir();
    const customPath = deps.dataDir !== undefined
      ? ""
      : (settingsManager.read().backup.local?.destination_path ?? "");
    const isCustom = !!(customPath && isAbsolute(customPath));
    // Use checkWritable (not ensureWritable) — a GET must not create directories.
    const writable = checkWritable(currentPath);
    return c.json({ data: { path: currentPath, is_custom: isCustom, writable } });
  });

  /**
   * PUT /backup/destination
   * Sets (or clears) the custom backup folder path.
   * Body: { path: string }  — empty string resets to default (DATA_DIR/backups/).
   * Validates that the path is absolute (or empty) and probes write access.
   */
  router.put("/backup/destination", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Request body must be valid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json({ error: "Request body must be an object" }, 400);
    }

    const patch = body as Record<string, unknown>;

    if (!("path" in patch) || typeof patch.path !== "string") {
      return c.json({ error: "`path` (string) is required" }, 422);
    }

    const rawPath = (patch.path as string).trim();

    if (rawPath !== "" && !isAbsolute(rawPath)) {
      return c.json({ error: "`path` must be an absolute path (starting with /) or an empty string to reset to default" }, 422);
    }

    if (rawPath.includes("..")) {
      return c.json({ error: "`path` must not contain path traversal sequences (..)" }, 422);
    }

    if (rawPath.includes("'")) {
      return c.json({ error: "`path` must not contain single-quote characters" }, 422);
    }

    // Probe write access before persisting (unless clearing — the default path is always writable).
    // ensureWritable creates the dir if absent, which is intentional: we want to confirm the
    // path is usable before committing it to settings.
    if (rawPath) {
      const writable = ensureWritable(rawPath);
      if (!writable) {
        return c.json({ error: `Cannot write to the specified path: ${rawPath}` }, 422);
      }
    }

    try {
      settingsManager.write({
        backup: { local: { destination_path: rawPath } } as import("../settings.js").Settings["backup"],
      });
    } catch (err) {
      log.error("Failed to persist backup destination", { error: String(err) });
      return c.json({ error: "Failed to save backup destination" }, 500);
    }

    // Re-read effective path after persisting.
    // checkWritable (no mkdirSync) is safe here: ensureWritable above already created the dir.
    const effectivePath = rawPath && isAbsolute(rawPath) ? resolve(rawPath) : defaultBackupsDir;
    const isCustom = !!(rawPath && isAbsolute(rawPath));
    const writable = rawPath ? checkWritable(effectivePath) : checkWritable(defaultBackupsDir);
    return c.json({ data: { path: effectivePath, is_custom: isCustom, writable } });
  });

  /**
   * Shared restore logic: validates a backup directory and replaces the live database file.
   */
  async function restoreFromBackupDirectory(
    backupRoot: string,
    options: { allowUnsafeNoChecksum?: boolean } = {}
  ): Promise<{ bookmark_count: number; checksum_verified: boolean; rollback_path: string }> {
    const snapshotPath = join(backupRoot, SNAPSHOT_FILE);
    const checksumPath = join(backupRoot, CHECKSUM_FILE);
    const manifestPath = join(backupRoot, MANIFEST_FILE);
    const settingsPath = join(backupRoot, SETTINGS_FILE);

    if (!existsSync(snapshotPath)) {
      throw statusError("Backup directory is missing snapshot.db");
    }

    const manifest = readManifest(manifestPath, currentSchemaVersion(deps.db));

    let checksumVerified = false;
    if (options.allowUnsafeNoChecksum) {
      if (existsSync(checksumPath)) {
        await verifyChecksums(backupRoot, checksumPath);
        checksumVerified = true;
      }
    } else {
      const verifiedFiles = await verifyChecksums(backupRoot, checksumPath);
      if (manifest.settings.included && !verifiedFiles.includes(manifest.settings.filename)) {
        throw statusError("Checksum file must include backed-up settings");
      }
      checksumVerified = true;
    }

    let settingsPatch: PortableSettings | null = null;
    if (manifest.settings.included) {
      if (!existsSync(settingsPath)) {
        throw statusError("Backup settings file is missing");
      }
      try {
        settingsPatch = JSON.parse(readFileSync(settingsPath, "utf8")) as PortableSettings;
      } catch {
        throw statusError("Backup settings file is malformed");
      }
    }

    const rollbackPath = `${resolvedDataDir}.pre-restore-${safeTimestamp()}`;

    // --- Checkpoint WAL and create rollback data before replacement ---
    try {
      deps.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch (err) {
      log.warn("Restore: WAL checkpoint failed before rollback copy", { error: String(err) });
    }

    mkdirSync(rollbackPath, { recursive: true });
    if (existsSync(deps.dbPath)) {
      copyFileSync(deps.dbPath, join(rollbackPath, basename(deps.dbPath)));
    }
    const walPath = `${deps.dbPath}-wal`;
    const shmPath = `${deps.dbPath}-shm`;
    if (existsSync(walPath)) copyFileSync(walPath, join(rollbackPath, basename(walPath)));
    if (existsSync(shmPath)) copyFileSync(shmPath, join(rollbackPath, basename(shmPath)));

    const restoreDbDir = mkdtempSync(join(tmpdir(), "littleimp-restore-db-"));
    const restoreDbPath = join(restoreDbDir, SNAPSHOT_FILE);
    const replacementPath = join(dirname(deps.dbPath), `${basename(deps.dbPath)}.restore-${safeTimestamp()}.tmp`);
    let previousSettings: Settings | null = null;
    let settingsApplied = false;
    try {
      copyFileSync(snapshotPath, restoreDbPath);
      const restoreDb = new Database(restoreDbPath);
      try {
        runMigrations(restoreDb);
      } finally {
        restoreDb.close();
      }

      copyFileSync(restoreDbPath, replacementPath);

      if (settingsPatch) {
        previousSettings = structuredClone(settingsManager.read());
        settingsManager.write(settingsPatch as unknown as Partial<Settings>);
        settingsApplied = true;
      }

      // From this point the daemon process is in restore maintenance mode.
      // The existing handle is intentionally closed; callers must restart.
      deps.db.close();

      if (existsSync(walPath)) rmSync(walPath);
      if (existsSync(shmPath)) rmSync(shmPath);
      renameSync(replacementPath, deps.dbPath);
    } catch (err) {
      if (settingsApplied && previousSettings) {
        try {
          settingsManager.write(previousSettings);
        } catch (rollbackErr) {
          log.error("Restore: failed to roll back settings after database replacement failure", {
            error: String(rollbackErr),
          });
        }
      }
      throw err;
    } finally {
      try { rmSync(replacementPath, { force: true }); } catch { /* best-effort */ }
      try { rmSync(restoreDbDir, { recursive: true, force: true }); } catch { /* best-effort */ }
    }

    log.info("Restore: database file replaced", { from: snapshotPath, to: deps.dbPath, rollbackPath });

    return {
      bookmark_count: manifest.bookmark_count,
      checksum_verified: checksumVerified,
      rollback_path: rollbackPath,
    };
  }

  /**
   * POST /restore
   * Restores the database from a local backup directory or a remote S3 object.
   *
   * Local form:   { name: string }  — basename of a directory inside DATA_DIR/backups/.
   * Remote form:  { source: "remote", key: string }  — S3 object key to download.
   *
   * The daemon must be restarted after a successful restore.
   */
  router.post("/restore", async (c) => {
    if (operationInProgress) {
      return c.json({ error: "A backup or restore operation is already in progress" }, 409);
    }
    operationInProgress = true;

    try {
      let body: Record<string, unknown>;
      try {
        body = await c.req.json() as Record<string, unknown>;
      } catch {
        return c.json({ error: "Request body must be valid JSON" }, 400);
      }

      // ── Remote restore ────────────────────────────────────────────────────────
      if (body.source === "remote") {
        if (!body.key || typeof body.key !== "string") {
          return c.json({ error: "Field 'key' (string) is required for remote restore" }, 422);
        }

        const s3cfg = getS3Config();
        if (!s3ConfigPresent(s3cfg)) {
          return c.json({ error: "S3 is not configured" }, 422);
        }

        const s3Key = body.key as string;

        // Validate that the key is within the configured prefix and points to a snapshot file.
        // This prevents an operator script from accidentally restoring an arbitrary S3 object.
        if (!s3Key.startsWith(s3cfg.prefix)) {
          return c.json({ error: `Key must be within the configured prefix: ${s3cfg.prefix}` }, 422);
        }
        if (!s3Key.endsWith("/snapshot.db")) {
          return c.json({ error: "Key must point to a snapshot.db file (e.g. prefix/timestamp/snapshot.db)" }, 422);
        }

        const allowUnsafeNoChecksum = body.allow_unsafe_no_checksum === true;
        const tmpRestoreDir = mkdtempSync(join(tmpdir(), "littleimp-restore-"));
        try {
          const snapshotData = await downloadFromS3(s3cfg, s3Key);
          writeFileSync(join(tmpRestoreDir, SNAPSHOT_FILE), snapshotData);

          const checksumKey = s3Key.replace(/\/snapshot\.db$/, "/checksums.sha256");
          if (!allowUnsafeNoChecksum) {
            try {
              const checksumData = await downloadFromS3(s3cfg, checksumKey);
              writeFileSync(join(tmpRestoreDir, CHECKSUM_FILE), checksumData);
            } catch {
              throw statusError("Remote backup checksum file is required");
            }
          } else {
            try {
              const checksumData = await downloadFromS3(s3cfg, checksumKey);
              writeFileSync(join(tmpRestoreDir, CHECKSUM_FILE), checksumData);
            } catch {
              log.warn("Remote restore: unsafe checksum bypass requested and checksum file is missing", { checksumKey });
            }
          }

          const manifestKey = s3Key.replace(/\/snapshot\.db$/, "/manifest.json");
          try {
            const manifestData = await downloadFromS3(s3cfg, manifestKey);
            writeFileSync(join(tmpRestoreDir, MANIFEST_FILE), manifestData);
          } catch {
            throw statusError("Remote backup manifest is required");
          }

          const settingsKey = s3Key.replace(/\/snapshot\.db$/, "/data/settings.json");
          try {
            const settingsData = await downloadFromS3(s3cfg, settingsKey);
            mkdirSync(join(tmpRestoreDir, "data"), { recursive: true });
            writeFileSync(join(tmpRestoreDir, SETTINGS_FILE), settingsData);
          } catch {
            log.warn("Remote restore: settings file not found on S3", { settingsKey });
          }

          const { bookmark_count, checksum_verified, rollback_path } = await restoreFromBackupDirectory(
            tmpRestoreDir,
            { allowUnsafeNoChecksum }
          );

          return c.json({
            restored_at: new Date().toISOString(),
            bookmark_count,
            checksum_verified,
            rollback_path,
            restart_required: true,
          });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 422) return c.json({ error: (err as Error).message }, 422);
          log.error("Remote restore failed", { error: String(err) });
          return c.json({ error: "Remote restore failed" }, 500);
        } finally {
          try { rmSync(tmpRestoreDir, { recursive: true, force: true }); } catch { /* best-effort */ }
        }
      }

      // ── Local restore ─────────────────────────────────────────────────────────
      if (!body.name || typeof body.name !== "string") {
        return c.json({ error: "Field 'name' (string) is required" }, 422);
      }

      const name = body.name as string;

      // Reject any name containing path separators or traversal sequences.
      if (name.includes("/") || name.includes("\\") || name.includes("..")) {
        return c.json({ error: "Invalid backup name" }, 422);
      }

      const resolvedBackupsDir = getBackupsDir();

      // Resolve server-side — the caller never controls the base directory.
      const backupPath = resolve(join(resolvedBackupsDir, name));

      // Double-check the resolved path is still inside backupsDir (defense-in-depth).
      if (!backupPath.startsWith(resolvedBackupsDir + "/") && backupPath !== resolvedBackupsDir) {
        log.warn("Restore rejected: path traversal attempt", { name });
        return c.json({ error: "Invalid backup name" }, 422);
      }

      const snapshotPath = join(backupPath, "snapshot.db");
      const manifestPath = join(backupPath, "manifest.json");
      const checksumPath = join(backupPath, "checksums.sha256");

      try { statSync(backupPath); } catch {
        return c.json({ error: "Backup not found" }, 422);
      }

      if (!existsSync(snapshotPath) || !existsSync(manifestPath)) {
        return c.json({ error: "Backup directory is missing snapshot.db or manifest.json" }, 422);
      }

      try {
        const allowUnsafeNoChecksum = body.allow_unsafe_no_checksum === true;
        if (!existsSync(checksumPath) && !allowUnsafeNoChecksum) {
          return c.json({ error: "Backup checksum file is required" }, 422);
        }

        const { bookmark_count, checksum_verified, rollback_path } = await restoreFromBackupDirectory(
          backupPath,
          { allowUnsafeNoChecksum }
        );
        return c.json({
          restored_at: new Date().toISOString(),
          bookmark_count,
          checksum_verified,
          rollback_path,
          restart_required: true,
        });
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 422) return c.json({ error: (err as Error).message }, 422);
        log.error("Restore failed: could not overwrite database", { error: String(err) });
        return c.json({ error: "Failed to replace database file" }, 500);
      }
    } finally {
      operationInProgress = false;
    }
  });

  /**
   * POST /settings/test-s3
   * Tests the S3 connection using the current backup.s3 settings.
   * Returns 200 on success or 422 with error details on failure.
   */
  router.post("/settings/test-s3", async (c) => {
    const s3cfg = getS3Config();
    if (!s3ConfigPresent(s3cfg)) {
      return c.json({ error: "S3 is not configured (bucket, access_key, and secret_key are required)" }, 422);
    }
    try {
      await testS3Connection(s3cfg);
      return c.json({ ok: true, message: "S3 connection successful" });
    } catch (err) {
      log.warn("S3 connection test failed", { error: String(err) });
      return c.json({ error: `S3 connection failed: ${String(err)}` }, 422);
    }
  });

  return router;
}
