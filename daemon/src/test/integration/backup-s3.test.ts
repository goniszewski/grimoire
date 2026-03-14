/**
 * TASK-037: Remote Backup (S3) — unit tests.
 *
 * The S3 client is mocked via Bun's module-level mock so no real network calls
 * are made.  We test:
 *  - POST /backup uploads to S3 when config is present
 *  - POST /backup skips S3 cleanly when config is absent
 *  - GET /backup/list?include_remote=true merges local + remote entries
 *  - GET /backup/list?include_remote=true returns 422 when S3 not configured
 *  - POST /restore with source:"remote" downloads and restores
 *  - POST /restore with source:"remote" returns 422 when S3 not configured
 *  - POST /settings/test-s3 returns 200 on success and 422 on failure
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runMigrations } from "../../db/migrations.js";

// ─── Mock S3 helpers ─────────────────────────────────────────────────────────
//
// We replace the s3 module's exported functions with in-memory stubs so that
// all S3 calls are intercepted without touching the network.

const mockUploads: Array<{ key: string; bytes: number }> = [];
const mockRemoteObjects: Array<{ key: string; size_bytes: number; last_modified: string }> = [];
let mockS3ShouldFail = false;
/** Per-key download data. Use `mockDownloadByKey.set(key, data)` to set per-key responses. */
const mockDownloadByKey = new Map<string, Uint8Array>();

mock.module("../../lib/s3.js", () => ({
  s3ConfigPresent: (s3: { bucket: string; access_key: string; secret_key: string }) =>
    !!(s3.bucket && s3.access_key && s3.secret_key),

  uploadToS3: async (
    _s3cfg: unknown,
    key: string,
    data: Uint8Array
  ): Promise<string> => {
    if (mockS3ShouldFail) throw new Error("mock S3 upload error");
    mockUploads.push({ key, bytes: data.length });
    return `s3://test-bucket/${key}`;
  },

  downloadFromS3: async (_s3cfg: unknown, key: string): Promise<Uint8Array> => {
    if (mockS3ShouldFail) throw new Error("mock S3 download error");
    const data = mockDownloadByKey.get(key);
    if (!data) throw new Error(`S3 object not found: ${key}`);
    return data;
  },

  listS3Objects: async (): Promise<typeof mockRemoteObjects> => {
    if (mockS3ShouldFail) throw new Error("mock S3 list error");
    return [...mockRemoteObjects];
  },

  testS3Connection: async (): Promise<void> => {
    if (mockS3ShouldFail) throw new Error("mock S3 connection error");
  },
}));

// Import route AFTER mocking so the mock is in effect
const { createBackupRoute } = await import("../../routes/backup.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  const dir = join(tmpdir(), `littleimp-s3-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

/** An S3 config that passes s3ConfigPresent(). */
const S3_CONFIG = {
  endpoint: "",
  bucket: "test-bucket",
  access_key: "test-access-key",
  secret_key: "test-secret-key",
  region: "us-east-1",
  prefix: "little-imp-backups/",
};

/** An S3 config with missing credentials (s3ConfigPresent() → false). */
const S3_CONFIG_EMPTY = {
  endpoint: "",
  bucket: "",
  access_key: "",
  secret_key: "",
  region: "us-east-1",
  prefix: "little-imp-backups/",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Backup S3 API", () => {
  let tmpDir: string;
  let dataDir: string;
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    dataDir = join(tmpDir, "data");
    mkdirSync(dataDir, { recursive: true });

    const result = makeFileDb(dataDir);
    db = result.db;
    dbPath = result.dbPath;

    // Reset mock state
    mockUploads.length = 0;
    mockRemoteObjects.length = 0;
    mockS3ShouldFail = false;
    mockDownloadByKey.clear();
  });

  afterEach(() => {
    try { db.close(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ─── POST /backup + S3 ───────────────────────────────────────────────────

  it("POST /backup uploads to S3 when config is present and returns remote_url", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    const res = await app.request("/backup", { method: "POST" });
    expect(res.status).toBe(201);

    const json = await res.json() as { remote_url?: string; path: string };
    expect(json.remote_url).toBeString();
    expect(json.remote_url).toStartWith("s3://test-bucket/");

    // Snapshot + checksum file both uploaded
    expect(mockUploads).toHaveLength(2);
    expect(mockUploads.some((u) => u.key.endsWith("snapshot.db"))).toBeTrue();
    expect(mockUploads.some((u) => u.key.endsWith("checksums.sha256"))).toBeTrue();
  });

  it("POST /backup skips S3 cleanly when config is absent — still returns 201", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG_EMPTY });
    const res = await app.request("/backup", { method: "POST" });
    expect(res.status).toBe(201);

    const json = await res.json() as { remote_url?: string };
    expect(json.remote_url).toBeUndefined();
    expect(mockUploads).toHaveLength(0);
  });

  it("POST /backup still returns 201 (local backup) when S3 upload fails", async () => {
    mockS3ShouldFail = true;
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    const res = await app.request("/backup", { method: "POST" });
    expect(res.status).toBe(201);

    const json = await res.json() as { remote_url?: string; path: string };
    expect(json.remote_url).toBeUndefined();
    expect(json.path).toBeString();
  });

  // ─── GET /backup/list?include_remote=true ─────────────────────────────────

  it("GET /backup/list?include_remote=true merges local and remote entries", async () => {
    mockRemoteObjects.push({
      key: "little-imp-backups/remote-snapshot/snapshot.db",
      size_bytes: 12345,
      last_modified: new Date(Date.now() - 1000).toISOString(),
    });

    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });

    // Create a local backup first
    await app.request("/backup", { method: "POST" });

    const res = await app.request("/backup/list?include_remote=true");
    expect(res.status).toBe(200);

    const json = await res.json() as { data: Array<{ source: string }> };
    expect(json.data.length).toBeGreaterThanOrEqual(2);

    const sources = json.data.map((e) => e.source);
    expect(sources).toContain("local");
    expect(sources).toContain("remote");
  });

  it("GET /backup/list?include_remote=true returns 422 when S3 not configured", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG_EMPTY });
    const res = await app.request("/backup/list?include_remote=true");
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("S3");
  });

  it("GET /backup/list without include_remote returns only local entries", async () => {
    mockRemoteObjects.push({
      key: "little-imp-backups/remote-snapshot/snapshot.db",
      size_bytes: 12345,
      last_modified: new Date().toISOString(),
    });

    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    await app.request("/backup", { method: "POST" });

    const res = await app.request("/backup/list");
    expect(res.status).toBe(200);

    const json = await res.json() as { data: Array<{ source: string }> };
    for (const entry of json.data) {
      expect(entry.source).toBe("local");
    }
  });

  // ─── POST /restore with source:"remote" ──────────────────────────────────

  it("POST /restore with source:remote downloads and restores successfully", async () => {
    // Create a real local backup so we can use its files as the "remote" content
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    const backupRes = await app.request("/backup", { method: "POST" });
    const { path: backupPath } = await backupRes.json() as { path: string };

    const snapshotKey = "little-imp-backups/some-snapshot/snapshot.db";
    const checksumKey = "little-imp-backups/some-snapshot/checksums.sha256";

    mockDownloadByKey.set(snapshotKey, await Bun.file(join(backupPath, "snapshot.db")).bytes());
    mockDownloadByKey.set(checksumKey, await Bun.file(join(backupPath, "checksums.sha256")).bytes());

    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "remote", key: snapshotKey }),
    });
    expect(res.status).toBe(200);

    const json = await res.json() as {
      restored_at: string;
      restart_required: boolean;
    };
    expect(json.restored_at).toBeString();
    expect(json.restart_required).toBeTrue();

    // Verify the live DB file was replaced
    expect(existsSync(dbPath)).toBeTrue();
  });

  it("POST /restore with source:remote returns 422 when S3 not configured", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG_EMPTY });
    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "remote", key: "little-imp-backups/foo/snapshot.db" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("S3");
  });

  it("POST /restore with source:remote returns 422 when key is missing", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    const res = await app.request("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "remote" }),
    });
    expect(res.status).toBe(422);
  });

  // ─── POST /settings/test-s3 ───────────────────────────────────────────────

  it("POST /settings/test-s3 returns 200 when connection succeeds", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    const res = await app.request("/settings/test-s3", { method: "POST" });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBeTrue();
  });

  it("POST /settings/test-s3 returns 422 when S3 not configured", async () => {
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG_EMPTY });
    const res = await app.request("/settings/test-s3", { method: "POST" });
    expect(res.status).toBe(422);
  });

  it("POST /settings/test-s3 returns 422 when connection fails", async () => {
    mockS3ShouldFail = true;
    const app = createBackupRoute({ db, dbPath, dataDir, s3Config: S3_CONFIG });
    const res = await app.request("/settings/test-s3", { method: "POST" });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("S3 connection failed");
  });
});
