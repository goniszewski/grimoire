import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createBackupRoute } from "../../routes/backup.js";
import { runMigrations } from "../../db/migrations.js";
import { settingsManager } from "../../settings.js";
import { version as DAEMON_VERSION } from "../../../package.json";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  const dir = join(tmpdir(), `littleimp-backup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Opens a real file-based SQLite DB at <dir>/littleimp.db, runs migrations,
 * and returns { db, dbPath }.
 */
function makeFileDb(dir: string): { db: Database; dbPath: string } {
  const dbPath = join(dir, "littleimp.db");
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return { db, dbPath };
}

const EMPTY_S3_CONFIG = {
  endpoint: "",
  bucket: "",
  access_key: "",
  secret_key: "",
  region: "us-east-1",
  prefix: "little-imp-backups/",
};

const MIN_RESTORE_APP_VERSION = "0.1.0-beta";

/** Returns the SHA-256 hex digest of a file. */
async function sha256File(path: string): Promise<string> {
  const data = await Bun.file(path).arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Backup API", () => {
  const originalConfigHome = process.env.XDG_CONFIG_HOME;
  let tmpDir: string;
  let dataDir: string;
  let db: Database;
  let dbPath: string;
  let app: ReturnType<typeof createBackupRoute>;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.XDG_CONFIG_HOME = join(tmpDir, "config-home");
    settingsManager.invalidate();

    dataDir = join(tmpDir, "data");
    mkdirSync(dataDir, { recursive: true });

    const result = makeFileDb(dataDir);
    db = result.db;
    dbPath = result.dbPath;

    app = createBackupRoute({ db, dbPath, dataDir });
  });

  afterEach(() => {
    try { db.close(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    if (originalConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalConfigHome;
    }
    settingsManager.invalidate();
  });

  // ─── POST /backup ──────────────────────────────────────────────────────────

  it("POST /backup returns 201 with path and metadata", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const res = await localOnlyApp.request("/backup", { method: "POST" });
    expect(res.status).toBe(201);
    const json = await res.json() as {
      path: string;
      size_bytes: number;
      bookmark_count: number;
      created_at: string;
    };
    expect(json.path).toBeString();
    expect(json.size_bytes).toBeGreaterThan(0);
    expect(json.bookmark_count).toBe(0);
    expect(json.created_at).toBeString();
  });

  it("POST /backup creates snapshot.db, manifest.json, and checksums.sha256", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const res = await localOnlyApp.request("/backup", { method: "POST" });
    expect(res.status).toBe(201);
    const json = await res.json() as { path: string };

    expect(existsSync(join(json.path, "snapshot.db"))).toBeTrue();
    expect(existsSync(join(json.path, "manifest.json"))).toBeTrue();
    expect(existsSync(join(json.path, "checksums.sha256"))).toBeTrue();
  });

  it("POST /backup manifest contains correct structure", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const res = await localOnlyApp.request("/backup", { method: "POST" });
    const { path } = await res.json() as { path: string };
    const manifest = JSON.parse(readFileSync(join(path, "manifest.json"), "utf8")) as {
      version: number;
      backup_format_version: number;
      app_version: string;
      created_at: string;
      db_size_bytes: number;
      bookmark_count: number;
      database: { filename: string; schema_version: string; size_bytes: number };
      settings: { included: boolean; filename: string; secrets_policy: string };
      checksum_algorithm: string;
      included_files: string[];
      compatibility: { min_app_version: string; restore_supported: boolean };
    };
    expect(manifest.version).toBe(1);
    expect(manifest.backup_format_version).toBe(1);
    expect(manifest.app_version).toBe(DAEMON_VERSION);
    expect(manifest.bookmark_count).toBe(0);
    expect(manifest.db_size_bytes).toBeGreaterThan(0);
    expect(manifest.database).toEqual({
      filename: "snapshot.db",
      schema_version: "0009",
      size_bytes: manifest.db_size_bytes,
    });
    expect(manifest.settings).toEqual({
      included: true,
      filename: "data/settings.json",
      secrets_policy: "secrets omitted; current local secrets are preserved on restore",
    });
    expect(manifest.checksum_algorithm).toBe("sha256");
    expect(manifest.included_files).toEqual(["snapshot.db", "data/settings.json"]);
    expect(manifest.compatibility).toEqual({
      min_app_version: MIN_RESTORE_APP_VERSION,
      restore_supported: true,
    });
    expect(manifest.created_at).toBeString();
  });

  it("POST /backup includes non-secret durable settings and checksums them", async () => {
    settingsManager.write({
      ai: {
        provider: "ollama",
        openai: { api_key: "backup-openai-secret", model: "gpt-backup" },
        ollama: { base_url: "http://localhost:11434", model: "llama3.2" },
        embeddings: { provider: "ollama", model: "nomic-embed-text" },
      },
      app: {
        autostart: true,
        theme: "dark",
        lock: { enabled: true, pin_hash: "pin-secret" },
      },
      backup: {
        local: { destination_path: "/tmp/littleimp-custom-backups" },
        schedule: { enabled: true, cron: "15 2 * * *", retention_count: 9 },
        s3: {
          endpoint: "https://s3.example.test",
          bucket: "littleimp",
          access_key: "s3-access-secret",
          secret_key: "s3-secret",
          region: "eu-central-1",
          prefix: "safe-prefix/",
        },
      },
    });

    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const res = await localOnlyApp.request("/backup", { method: "POST" });
    const { path } = await res.json() as { path: string };

    const settingsPath = join(path, "data", "settings.json");
    expect(existsSync(settingsPath)).toBeTrue();

    const backupSettings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      ai: {
        provider: string;
        openai: { api_key?: string; model: string };
        ollama: { base_url: string; model: string };
        embeddings: { provider: string; model: string };
      };
      app: { autostart: boolean; theme: string; lock: { enabled: boolean; pin_hash?: string } };
      backup: {
        local: { destination_path: string };
        schedule: { enabled: boolean; cron: string; retention_count: number };
        s3: {
          endpoint: string;
          bucket: string;
          access_key?: string;
          secret_key?: string;
          region: string;
          prefix: string;
        };
      };
    };

    expect(backupSettings.ai.provider).toBe("ollama");
    expect(backupSettings.ai.openai.model).toBe("gpt-backup");
    expect(backupSettings.ai.openai.api_key).toBeUndefined();
    expect(backupSettings.app.lock.enabled).toBeTrue();
    expect(backupSettings.app.lock.pin_hash).toBeUndefined();
    expect(backupSettings.backup.schedule).toEqual({
      enabled: true,
      cron: "15 2 * * *",
      retention_count: 9,
    });
    expect(backupSettings.backup.s3).toEqual({
      endpoint: "https://s3.example.test",
      bucket: "littleimp",
      region: "eu-central-1",
      prefix: "safe-prefix/",
    });

    const checksums = readFileSync(join(path, "checksums.sha256"), "utf8");
    expect(checksums).toContain("  snapshot.db\n");
    expect(checksums).toContain("  data/settings.json\n");
  });

  it("POST /backup returns 409 when another backup is already in progress", async () => {
    // Kick off first backup but don't await it yet
    const first = app.request("/backup", { method: "POST" });
    const second = app.request("/backup", { method: "POST" });
    const [r1, r2] = await Promise.all([first, second]);
    // One should succeed, one should be 409
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  // ─── GET /backup/list ──────────────────────────────────────────────────────

  it("GET /backup/list returns empty array when no backups exist", async () => {
    const res = await app.request("/backup/list");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: unknown[] };
    expect(json.data).toEqual([]);
  });

  it("GET /backup/list hides incomplete local backup directories", async () => {
    const backupsDir = join(dataDir, "backups");
    const incompleteDir = join(backupsDir, "incomplete-with-manifest");
    mkdirSync(incompleteDir, { recursive: true });
    writeFileSync(join(incompleteDir, "manifest.json"), JSON.stringify({
      version: 1,
      created_at: new Date().toISOString(),
      db_size_bytes: 10,
      bookmark_count: 0,
    }));

    const res = await app.request("/backup/list");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: unknown[] };
    expect(json.data).toEqual([]);
  });

  it("GET /backup/list returns created backup", async () => {
    await app.request("/backup", { method: "POST" });
    const res = await app.request("/backup/list");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: Array<{ name: string; size_bytes: number }> };
    expect(json.data).toHaveLength(1);
    expect(json.data[0].size_bytes).toBeGreaterThan(0);
    expect(json.data[0].name).toBeString();
  });

  it("GET /backup/list returns multiple backups sorted newest first", async () => {
    await app.request("/backup", { method: "POST" });
    await Bun.sleep(10); // ensure different millisecond timestamps
    await app.request("/backup", { method: "POST" });

    const res = await app.request("/backup/list");
    const json = await res.json() as { data: Array<{ created_at: string }> };
    expect(json.data).toHaveLength(2);
    // Newest first
    expect(Date.parse(json.data[0].created_at) >= Date.parse(json.data[1].created_at)).toBeTrue();
  });

  // ─── POST /restore ─────────────────────────────────────────────────────────

  it("POST /restore with a valid backup restores the database file", async () => {
    // Create backup and get its name
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;
    const snapshotPath = join(backupPath, "snapshot.db");

    // Mutate the live DB after backup so the files differ
    db.exec("CREATE TABLE _test_marker (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO _test_marker VALUES (42)");

    // Restore
    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      restored_at: string;
      bookmark_count: number;
      checksum_verified: boolean;
      rollback_path: string;
      restart_required: boolean;
    };
    expect(json.restored_at).toBeString();
    expect(json.bookmark_count).toBe(0);
    expect(json.checksum_verified).toBeTrue();
    expect(json.rollback_path).toBeString();
    expect(existsSync(join(json.rollback_path, "littleimp.db"))).toBeTrue();
    expect(json.restart_required).toBeTrue();

    // Verify the live DB file now matches the snapshot byte-for-byte
    const restoredHash = await sha256File(dbPath);
    const snapshotHash = await sha256File(snapshotPath);
    expect(restoredHash).toBe(snapshotHash);
  });

  it("POST /restore stores rollback data inside DATA_DIR when its parent is not writable", async () => {
    process.env.XDG_CONFIG_HOME = join(dataDir, "config-home");
    settingsManager.invalidate();
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;

    chmodSync(tmpDir, 0o555);
    try {
      const res = await localOnlyApp.request("/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: backupName }),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as { rollback_path: string; restart_required: boolean };
      expect(json.rollback_path.startsWith(`${join(dataDir, "restore-rollbacks")}/`)).toBeTrue();
      expect(existsSync(join(json.rollback_path, "littleimp.db"))).toBeTrue();
      expect(json.restart_required).toBeTrue();
    } finally {
      chmodSync(tmpDir, 0o755);
    }
  });

  it("POST /restore closes the live database handle until restart", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;

    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(200);

    expect(() => db.exec("CREATE TABLE _write_after_restore (id INTEGER PRIMARY KEY)")).toThrow();
  });

  it("POST /restore refuses a backup without checksums", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;

    rmSync(join(backupPath, "checksums.sha256"), { force: true });

    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("checksum");
  });

  it("POST /restore refuses unsupported backup format versions", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;
    const manifestPath = join(backupPath, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { backup_format_version: number };
    manifest.backup_format_version = 999;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("Unsupported backup format version");
  });

  it("POST /restore refuses manifests that point at unexpected payload paths", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;
    const manifestPath = join(backupPath, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      database: { filename: string };
    };
    manifest.database.filename = "data/littleimp.db";
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("Unsupported database filename");
  });

  it("POST /restore refuses backups with newer database schema versions", async () => {
    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;
    const manifestPath = join(backupPath, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      database: { schema_version: string };
    };
    manifest.database.schema_version = "9999";
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("newer than this daemon supports");
  });

  it("POST /restore restores backed-up non-secret settings without clearing current secrets", async () => {
    settingsManager.write({
      ai: {
        provider: "ollama",
        openai: { api_key: "backup-secret", model: "gpt-backup" },
        ollama: { base_url: "http://localhost:11434", model: "llama3.2" },
        embeddings: { provider: "ollama", model: "nomic-embed-text" },
      },
      backup: {
        local: { destination_path: "" },
        schedule: { enabled: true, cron: "30 4 * * *", retention_count: 12 },
        s3: {
          endpoint: "https://s3.backup.example",
          bucket: "backup-bucket",
          access_key: "backup-access",
          secret_key: "backup-secret-key",
          region: "eu-west-1",
          prefix: "backup-prefix/",
        },
      },
    });

    const localOnlyApp = createBackupRoute({ db, dbPath, dataDir, s3Config: EMPTY_S3_CONFIG });
    const backupRes = await localOnlyApp.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;

    settingsManager.write({
      ai: {
        provider: "openai",
        openai: { api_key: "current-secret", model: "gpt-current" },
        ollama: { base_url: "http://localhost:11434", model: "llama-current" },
        embeddings: { provider: "openai", model: "embed-current" },
      },
      backup: {
        local: { destination_path: "" },
        schedule: { enabled: false, cron: "0 1 * * *", retention_count: 3 },
        s3: {
          endpoint: "",
          bucket: "current-bucket",
          access_key: "current-access",
          secret_key: "current-secret-key",
          region: "us-east-1",
          prefix: "current-prefix/",
        },
      },
    });

    const res = await localOnlyApp.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(200);

    const restored = settingsManager.read();
    expect(restored.ai.provider).toBe("ollama");
    expect(restored.ai.openai.model).toBe("gpt-backup");
    expect(restored.ai.openai.api_key).toBe("current-secret");
    expect(restored.ai.ollama.model).toBe("llama3.2");
    expect(restored.ai.embeddings).toEqual({ provider: "ollama", model: "nomic-embed-text" });
    expect(restored.backup.schedule).toEqual({
      enabled: true,
      cron: "30 4 * * *",
      retention_count: 12,
    });
    expect(restored.backup.s3.access_key).toBe("current-access");
    expect(restored.backup.s3.secret_key).toBe("current-secret-key");
    expect(restored.backup.s3.bucket).toBe("backup-bucket");
    expect(restored.backup.s3.prefix).toBe("backup-prefix/");
  });

  it("POST /restore returns 422 when name field is missing", async () => {
    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
  });

  it("POST /restore returns 422 when backup name does not exist", async () => {
    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "nonexistent-backup" }),
    });
    expect(res.status).toBe(422);
  });

  it("POST /restore returns 422 for path traversal attempts", async () => {
    const traversalAttempts = ["../../etc", "../data", "/etc", "foo/../../bar"];
    for (const name of traversalAttempts) {
      const res = await app.request("/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      expect(res.status).toBe(422);
    }
  });

  it("POST /restore returns 422 when checksum is wrong (tampered snapshot)", async () => {
    const backupRes = await app.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;

    // Tamper with the snapshot file
    writeFileSync(join(backupPath, "snapshot.db"), "tampered content that will fail checksum");

    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("Checksum");
  });

  it("POST /restore returns 422 when snapshot.db is missing", async () => {
    // Create a fake backup dir inside the backups/ directory
    const backupsDir = join(dataDir, "backups");
    mkdirSync(backupsDir, { recursive: true });
    const fakeName = "fake-backup-no-snapshot";
    const fakeDir = join(backupsDir, fakeName);
    mkdirSync(fakeDir, { recursive: true });
    writeFileSync(join(fakeDir, "manifest.json"), JSON.stringify({ version: 1 }));

    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fakeName }),
    });
    expect(res.status).toBe(422);
  });
});
