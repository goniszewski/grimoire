import { Hono } from "hono";
import { Database } from "bun:sqlite";
import {
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  readFileSync,
  rmSync,
  existsSync,
  writeFileSync,
  accessSync,
  constants as fsConstants,
} from "fs";
import { join, resolve, basename, isAbsolute } from "path";
import { tmpdir } from "os";
import { Config } from "../config.js";
import { log } from "../logger.js";
import { settingsManager } from "../settings.js";
import { nextCronRunAt } from "../lib/cron.js";
import {
  s3ConfigPresent,
  uploadToS3,
  downloadFromS3,
  listS3Objects,
  testS3Connection,
} from "../lib/s3.js";

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

  const snapshotPath = join(backupDir, "snapshot.db");
  const manifestPath = join(backupDir, "manifest.json");
  const checksumPath = join(backupDir, "checksums.sha256");

  try {
    assertSafeSqlPath(snapshotPath);
    db.exec(`VACUUM INTO '${snapshotPath}'`);

    const snapshotStat = statSync(snapshotPath);
    const bookmarkCount = countBookmarks(db);
    const createdAt = new Date().toISOString();

    const manifest = {
      version: 1,
      created_at: createdAt,
      db_size_bytes: snapshotStat.size,
      bookmark_count: bookmarkCount,
    };

    await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

    const checksum = await sha256File(snapshotPath);
    await Bun.write(checksumPath, `${checksum}  snapshot.db\n`);

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
          const snapshotPath = join(result.path, "snapshot.db");
          const checksumPath = join(result.path, "checksums.sha256");
          const backupName = basename(result.path);
          const snapshotData = await Bun.file(snapshotPath).bytes();
          const s3Key = `${s3cfg.prefix}${backupName}/snapshot.db`;
          const remoteUrl = await uploadToS3(s3cfg, s3Key, snapshotData);
          // Upload checksum file so remote restores can verify integrity
          if (existsSync(checksumPath)) {
            const checksumData = await Bun.file(checksumPath).bytes();
            await uploadToS3(s3cfg, `${s3cfg.prefix}${backupName}/checksums.sha256`, checksumData, "text/plain");
          }
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
      remoteEntries = objects.map((obj) => ({
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
   * Shared restore logic: given a resolved snapshotPath, replaces the live database file.
   */
  async function restoreFromSnapshot(
    snapshotPath: string,
    checksumPath: string | null,
    manifestPath: string | null
  ): Promise<{ bookmark_count: number; checksum_verified: boolean }> {
    // --- Verify checksum (when available) ---
    let checksumVerified = false;
    if (checksumPath && existsSync(checksumPath)) {
      const checksumFile = await Bun.file(checksumPath).text();
      const expectedHash = checksumFile.trim().split(/\s+/)[0];
      const actualHash = await sha256File(snapshotPath);
      if (actualHash !== expectedHash) {
        throw Object.assign(new Error("Checksum mismatch — backup file may be corrupted"), { status: 422 });
      }
      checksumVerified = true;
    }

    // --- Parse manifest for bookmark count ---
    let bookmarkCount = 0;
    if (manifestPath) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bookmark_count?: number };
        bookmarkCount = manifest.bookmark_count ?? 0;
      } catch {
        // ignore — non-fatal
      }
    }

    // --- Checkpoint WAL and replace database file ---
    try {
      deps.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch (err) {
      log.warn("Restore: WAL checkpoint failed (proceeding anyway)", { error: String(err) });
    }

    copyFileSync(snapshotPath, deps.dbPath);
    const walPath = `${deps.dbPath}-wal`;
    const shmPath = `${deps.dbPath}-shm`;
    if (existsSync(walPath)) rmSync(walPath);
    if (existsSync(shmPath)) rmSync(shmPath);
    log.info("Restore: database file replaced", { from: snapshotPath, to: deps.dbPath });

    return { bookmark_count: bookmarkCount, checksum_verified: checksumVerified };
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

        // Download snapshot to a temp file
        const tmpPath = join(tmpdir(), `littleimp-restore-${Date.now()}.db`);
        const tmpChecksumPath = `${tmpPath}.sha256`;
        try {
          const data = await downloadFromS3(s3cfg, s3Key);
          writeFileSync(tmpPath, data);

          // Attempt to download a matching checksum file for integrity verification
          const checksumKey = s3Key.replace(/\/snapshot\.db$/, "/checksums.sha256");
          let resolvedChecksumPath: string | null = null;
          try {
            const checksumData = await downloadFromS3(s3cfg, checksumKey);
            writeFileSync(tmpChecksumPath, checksumData);
            resolvedChecksumPath = tmpChecksumPath;
          } catch {
            log.warn("Remote restore: no checksum file found on S3, proceeding without verification", { checksumKey });
          }

          const { bookmark_count, checksum_verified } = await restoreFromSnapshot(tmpPath, resolvedChecksumPath, null);

          return c.json({
            restored_at: new Date().toISOString(),
            bookmark_count,
            checksum_verified,
            restart_required: true,
          });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status === 422) return c.json({ error: (err as Error).message }, 422);
          log.error("Remote restore failed", { error: String(err) });
          return c.json({ error: "Remote restore failed" }, 500);
        } finally {
          try { rmSync(tmpPath, { force: true }); } catch { /* best-effort */ }
          try { rmSync(tmpChecksumPath, { force: true }); } catch { /* best-effort */ }
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

      if (!existsSync(checksumPath)) {
        log.warn("Restore: no checksum file found, proceeding without verification", { name });
      }

      try {
        const { bookmark_count, checksum_verified } = await restoreFromSnapshot(
          snapshotPath,
          checksumPath,
          manifestPath
        );
        return c.json({
          restored_at: new Date().toISOString(),
          bookmark_count,
          checksum_verified,
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
