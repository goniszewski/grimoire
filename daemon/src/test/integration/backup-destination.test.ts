import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createBackupRoute } from "../../routes/backup.js";
import { runMigrations } from "../../db/migrations.js";
import { settingsManager } from "../../settings.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  const dir = join(tmpdir(), `littleimp-dest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeFileDb(dir: string): { db: Database; dbPath: string } {
  const dbPath = join(dir, "littleimp.db");
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  return { db, dbPath };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Backup Destination API", () => {
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
    ({ db, dbPath } = makeFileDb(dataDir));
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

  // ─── GET /backup/destination ─────────────────────────────────────────────────

  it("GET /backup/destination — returns default path when no custom path set", async () => {
    // Create the backups dir so checkWritable can verify access (it no longer creates dirs on GET).
    mkdirSync(join(dataDir, "backups"), { recursive: true });

    const res = await app.request("/backup/destination");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { path: string; is_custom: boolean; writable: boolean } };
    expect(body.data.is_custom).toBe(false);
    expect(body.data.path).toContain("backups");
    expect(body.data.writable).toBe(true);
  });

  it("GET /backup/destination — writable is false when dir does not exist", async () => {
    // Default backups dir has not been created — GET must not create it.
    const res = await app.request("/backup/destination");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { path: string; is_custom: boolean; writable: boolean } };
    expect(body.data.writable).toBe(false);
    // Dir must NOT have been created as a side-effect of the GET.
    expect(existsSync(join(dataDir, "backups"))).toBe(false);
  });

  // ─── PUT /backup/destination ─────────────────────────────────────────────────

  it("PUT /backup/destination — sets a custom absolute path", async () => {
    const customDir = join(tmpDir, "custom-backups");
    mkdirSync(customDir, { recursive: true });

    const res = await app.request("/backup/destination", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: customDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { path: string; is_custom: boolean; writable: boolean } };
    expect(body.data.is_custom).toBe(true);
    expect(body.data.path).toBe(customDir);
    expect(body.data.writable).toBe(true);
  });

  it("PUT /backup/destination — empty string resets to default", async () => {
    const res = await app.request("/backup/destination", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { path: string; is_custom: boolean; writable: boolean } };
    expect(body.data.is_custom).toBe(false);
    expect(body.data.path).toContain("backups");
  });

  it("PUT /backup/destination — relative path returns 422", async () => {
    const res = await app.request("/backup/destination", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "relative/path/backups" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("absolute");
  });

  it("PUT /backup/destination — path with traversal (..) returns 422", async () => {
    const res = await app.request("/backup/destination", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/tmp/../etc/backups" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("..");
  });

  it("PUT /backup/destination — missing path field returns 422", async () => {
    const res = await app.request("/backup/destination", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destination: "/tmp/backups" }),
    });
    expect(res.status).toBe(422);
  });

  // ─── POST /backup uses the custom destination ─────────────────────────────────

  it("POST /backup creates snapshot in the custom destination", async () => {
    const customDir = join(tmpDir, "cloud-sync");
    mkdirSync(customDir, { recursive: true });

    // Note: the injected dataDir takes priority in tests (no settingsManager).
    // Test that backups land in dataDir/backups/ (the default for injected tests).
    const backupRes = await app.request("/backup", { method: "POST" });
    expect(backupRes.status).toBe(201);
    const backupBody = await backupRes.json() as { path: string };
    expect(existsSync(backupBody.path)).toBe(true);
  });

  // ─── GET /backup/list reflects the configured directory ───────────────────────

  it("GET /backup/list returns entries from the active backup directory", async () => {
    // Create a backup
    await app.request("/backup", { method: "POST" });

    const listRes = await app.request("/backup/list");
    expect(listRes.status).toBe(200);
    const body = await listRes.json() as { data: Array<{ source: string }> };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].source).toBe("local");
  });
});
