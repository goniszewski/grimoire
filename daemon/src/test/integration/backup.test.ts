import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createBackupRoute } from "../../routes/backup.js";
import { runMigrations } from "../../db/migrations.js";

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
  let tmpDir: string;
  let dataDir: string;
  let db: Database;
  let dbPath: string;
  let app: ReturnType<typeof createBackupRoute>;

  beforeEach(() => {
    tmpDir = makeTempDir();
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
  });

  // ─── POST /backup ──────────────────────────────────────────────────────────

  it("POST /backup returns 201 with path and metadata", async () => {
    const res = await app.request("/backup", { method: "POST" });
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
    const res = await app.request("/backup", { method: "POST" });
    expect(res.status).toBe(201);
    const json = await res.json() as { path: string };

    expect(existsSync(join(json.path, "snapshot.db"))).toBeTrue();
    expect(existsSync(join(json.path, "manifest.json"))).toBeTrue();
    expect(existsSync(join(json.path, "checksums.sha256"))).toBeTrue();
  });

  it("POST /backup manifest contains correct structure", async () => {
    const res = await app.request("/backup", { method: "POST" });
    const { path } = await res.json() as { path: string };
    const manifest = JSON.parse(readFileSync(join(path, "manifest.json"), "utf8")) as {
      version: number;
      created_at: string;
      db_size_bytes: number;
      bookmark_count: number;
    };
    expect(manifest.version).toBe(1);
    expect(manifest.bookmark_count).toBe(0);
    expect(manifest.db_size_bytes).toBeGreaterThan(0);
    expect(manifest.created_at).toBeString();
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
    const backupRes = await app.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };
    const backupName = backupPath.split("/").at(-1)!;
    const snapshotPath = join(backupPath, "snapshot.db");

    // Mutate the live DB after backup so the files differ
    db.exec("CREATE TABLE _test_marker (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO _test_marker VALUES (42)");

    // Restore
    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: backupName }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      restored_at: string;
      bookmark_count: number;
      checksum_verified: boolean;
      restart_required: boolean;
    };
    expect(json.restored_at).toBeString();
    expect(json.bookmark_count).toBe(0);
    expect(json.checksum_verified).toBeTrue();
    expect(json.restart_required).toBeTrue();

    // Verify the live DB file now matches the snapshot byte-for-byte
    const restoredHash = await sha256File(dbPath);
    const snapshotHash = await sha256File(snapshotPath);
    expect(restoredHash).toBe(snapshotHash);
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
