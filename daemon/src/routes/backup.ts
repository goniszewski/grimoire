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
} from "fs";
import { join, resolve } from "path";
import { Config } from "../config.js";
import { log } from "../logger.js";
import { settingsManager } from "../settings.js";
import { nextCronRunAt } from "../lib/cron.js";

interface BackupDeps {
  db: Database;
  /** Absolute path to the live SQLite file. */
  dbPath: string;
  /** Data directory root. Defaults to Config.DATA_DIR. */
  dataDir?: string;
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

  return entries
    .map((name) => {
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
        };
      } catch {
        return null;
      }
    })
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

export function createBackupRoute(deps: BackupDeps): Hono {
  const router = new Hono();
  const resolvedDataDir = deps.dataDir ?? Config.DATA_DIR;
  const resolvedBackupsDir = resolve(backupsDir(resolvedDataDir));

  /** In-flight operation guard — prevents concurrent backup or restore operations. */
  let operationInProgress = false;

  /**
   * POST /backup
   * Creates a new backup snapshot in DATA_DIR/backups/<timestamp>/.
   * Returns metadata about the created backup.
   */
  router.post("/backup", async (c) => {
    if (operationInProgress) {
      return c.json({ error: "A backup or restore operation is already in progress" }, 409);
    }
    operationInProgress = true;

    try {
      const result = await createBackupSnapshot(deps.db, resolvedBackupsDir);
      return c.json(result, 201);
    } catch (err) {
      log.error("Backup failed", { error: String(err) });
      return c.json({ error: "Failed to create backup" }, 500);
    } finally {
      operationInProgress = false;
    }
  });

  /**
   * GET /backup/list
   * Lists all backups in DATA_DIR/backups/, newest first.
   */
  router.get("/backup/list", (c) => {
    return c.json({ data: listBackups(resolvedBackupsDir) });
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
        },
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
   * POST /restore
   * Restores the database from a backup directory.
   * Body: { name: string }  — basename of a backup directory inside DATA_DIR/backups/.
   *
   * Accepts only directory names (not arbitrary paths) to prevent path traversal.
   * The daemon must be restarted after a successful restore for the new database
   * to take effect on the open SQLite connection.
   */
  router.post("/restore", async (c) => {
    if (operationInProgress) {
      return c.json({ error: "A backup or restore operation is already in progress" }, 409);
    }
    // Acquire the lock immediately — all validation below is async and a second
    // concurrent request could otherwise pass the check above while we are still
    // reading and verifying the backup files.
    operationInProgress = true;

    try {

    let body: { name?: unknown };
    try {
      body = await c.req.json() as { name?: unknown };
    } catch {
      return c.json({ error: "Request body must be valid JSON" }, 400);
    }

    if (!body.name || typeof body.name !== "string") {
      return c.json({ error: "Field 'name' (string) is required" }, 422);
    }

    // Reject any name containing path separators or traversal sequences.
    const name = body.name;
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      return c.json({ error: "Invalid backup name" }, 422);
    }

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

    // --- Validate backup directory exists ---
    try {
      statSync(backupPath);
    } catch {
      return c.json({ error: "Backup not found" }, 422);
    }

    // --- Validate required files exist ---
    if (!existsSync(snapshotPath) || !existsSync(manifestPath)) {
      return c.json({ error: "Backup directory is missing snapshot.db or manifest.json" }, 422);
    }

    // --- Verify checksum ---
    let checksumVerified = false;
    if (existsSync(checksumPath)) {
      const checksumFile = await Bun.file(checksumPath).text();
      const expectedHash = checksumFile.trim().split(/\s+/)[0];
      const actualHash = await sha256File(snapshotPath);
      if (actualHash !== expectedHash) {
        log.warn("Restore rejected: checksum mismatch", { name });
        return c.json({ error: "Checksum mismatch — backup file may be corrupted" }, 422);
      }
      checksumVerified = true;
    } else {
      log.warn("Restore: no checksum file found, proceeding without verification", { name });
    }

    // --- Parse manifest for bookmark count ---
    let bookmarkCount = 0;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bookmark_count?: number };
      bookmarkCount = manifest.bookmark_count ?? 0;
    } catch {
      // ignore — non-fatal
    }

    // --- Checkpoint WAL and replace database files ---
    try {
      try {
        deps.db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch (err) {
        log.warn("Restore: WAL checkpoint failed (proceeding anyway)", { error: String(err) });
      }

      try {
        copyFileSync(snapshotPath, deps.dbPath);
        const walPath = `${deps.dbPath}-wal`;
        const shmPath = `${deps.dbPath}-shm`;
        if (existsSync(walPath)) rmSync(walPath);
        if (existsSync(shmPath)) rmSync(shmPath);
        log.info("Restore: database file replaced", { from: snapshotPath, to: deps.dbPath });
      } catch (err) {
        log.error("Restore failed: could not overwrite database", { error: String(err) });
        return c.json({ error: "Failed to replace database file" }, 500);
      }

      return c.json({
        restored_at: new Date().toISOString(),
        bookmark_count: bookmarkCount,
        checksum_verified: checksumVerified,
        restart_required: true,
      });
    } catch (err) {
      log.error("Restore: unexpected error", { error: String(err) });
      return c.json({ error: "Restore failed" }, 500);
    }

    } finally {
      operationInProgress = false;
    }
  });

  return router;
}
