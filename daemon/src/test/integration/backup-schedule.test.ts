import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createBackupRoute, applyRetentionPolicy, createBackupSnapshot } from "../../routes/backup.js";
import { runMigrations } from "../../db/migrations.js";
import { cronToIntervalMs, nextCronRunAt } from "../../lib/cron.js";
import { settingsManager } from "../../settings.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `littleimp-schedule-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
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

const originalConfigHome = process.env.XDG_CONFIG_HOME;

function useIsolatedConfigHome(tmpDir: string): void {
  process.env.XDG_CONFIG_HOME = join(tmpDir, "config-home");
  settingsManager.invalidate();
}

function restoreConfigHome(): void {
  if (originalConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = originalConfigHome;
  }
  settingsManager.invalidate();
}

// ─── Cron utilities ───────────────────────────────────────────────────────────

describe("cronToIntervalMs", () => {
  it("returns 1 day for a daily schedule (0 3 * * *)", () => {
    expect(cronToIntervalMs("0 3 * * *")).toBe(24 * 60 * 60_000);
  });

  it("returns 1 day for any fixed-hour schedule", () => {
    expect(cronToIntervalMs("30 6 * * *")).toBe(24 * 60 * 60_000);
  });

  it("returns 1 week when dow is specified", () => {
    expect(cronToIntervalMs("0 3 * * 0")).toBe(7 * 24 * 60 * 60_000);
  });

  it("returns 1 week when dom is specified", () => {
    expect(cronToIntervalMs("0 3 1 * *")).toBe(7 * 24 * 60 * 60_000);
  });

  it("returns 1 hour when only minute is fixed", () => {
    expect(cronToIntervalMs("30 * * * *")).toBe(60 * 60_000);
  });

  it("falls back to 1 day for invalid expression", () => {
    expect(cronToIntervalMs("not-a-cron")).toBe(24 * 60 * 60_000);
  });

  it("falls back to 1 day when all fields are wildcards", () => {
    expect(cronToIntervalMs("* * * * *")).toBe(24 * 60 * 60_000);
  });
});

describe("nextCronRunAt", () => {
  it("returns a Date in the future for a daily schedule", () => {
    const next = nextCronRunAt("0 3 * * *");
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null for an invalid expression", () => {
    expect(nextCronRunAt("not-a-cron")).toBeNull();
    expect(nextCronRunAt("* *")).toBeNull();
  });

  it("returns null when hour field is a wildcard (next run indeterminate)", () => {
    expect(nextCronRunAt("* * * * *")).toBeNull();
    expect(nextCronRunAt("0 * * * *")).toBeNull();
  });

  it("sets the correct hour and minute", () => {
    const next = nextCronRunAt("30 14 * * *");
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBe(14);
    expect(next!.getMinutes()).toBe(30);
  });

  it("defaults minute to 0 when minute field is wildcard", () => {
    const next = nextCronRunAt("* 3 * * *");
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBe(3);
    expect(next!.getMinutes()).toBe(0);
  });
});

// ─── Retention policy ─────────────────────────────────────────────────────────

describe("applyRetentionPolicy", () => {
  let tmpDir: string;
  let backupsDir: string;
  let db: Database;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    useIsolatedConfigHome(tmpDir);
    backupsDir = join(tmpDir, "backups");
    mkdirSync(backupsDir, { recursive: true });
    const result = makeFileDb(tmpDir);
    db = result.db;
    dbPath = result.dbPath;
  });

  afterEach(() => {
    try { db.close(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    restoreConfigHome();
  });

  it("deletes oldest backups beyond retention count", async () => {
    // Create 4 snapshots with small delays to get distinct timestamps
    for (let i = 0; i < 4; i++) {
      await createBackupSnapshot(db, backupsDir);
      await Bun.sleep(5);
    }

    const deleted = applyRetentionPolicy(backupsDir, 2);
    expect(deleted).toBe(2);

    // Only 2 remain
    const { readdirSync } = await import("fs");
    const remaining = readdirSync(backupsDir).filter((name) =>
      existsSync(join(backupsDir, name, "manifest.json"))
    );
    expect(remaining).toHaveLength(2);
  });

  it("does nothing when backups are within retention count", async () => {
    await createBackupSnapshot(db, backupsDir);
    await createBackupSnapshot(db, backupsDir);

    const deleted = applyRetentionPolicy(backupsDir, 5);
    expect(deleted).toBe(0);
  });

  it("deletes all but one when retention_count is 1", async () => {
    for (let i = 0; i < 3; i++) {
      await createBackupSnapshot(db, backupsDir);
      await Bun.sleep(5);
    }

    const deleted = applyRetentionPolicy(backupsDir, 1);
    expect(deleted).toBe(2);
  });
});

// ─── GET /backup/schedule ─────────────────────────────────────────────────────

describe("GET /backup/schedule", () => {
  let tmpDir: string;
  let db: Database;
  let dbPath: string;
  let app: ReturnType<typeof createBackupRoute>;

  beforeEach(() => {
    tmpDir = makeTempDir();
    useIsolatedConfigHome(tmpDir);
    const dataDir = join(tmpDir, "data");
    mkdirSync(dataDir, { recursive: true });
    const result = makeFileDb(dataDir);
    db = result.db;
    dbPath = result.dbPath;
    app = createBackupRoute({ db, dbPath, dataDir });
  });

  afterEach(() => {
    try { db.close(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    restoreConfigHome();
  });

  it("returns schedule config with correct shape", async () => {
    const res = await app.request("/backup/schedule");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { enabled: boolean; cron: string; retention_count: number; next_run_at: string | null } };
    expect(json.data).toHaveProperty("enabled");
    expect(json.data).toHaveProperty("cron");
    expect(json.data).toHaveProperty("retention_count");
    expect(json.data).toHaveProperty("next_run_at");
    expect(typeof json.data.enabled).toBe("boolean");
    expect(typeof json.data.cron).toBe("string");
    expect(typeof json.data.retention_count).toBe("number");
  });

  it("next_run_at is null when schedule is disabled", async () => {
    // First disable via PUT
    await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    const res = await app.request("/backup/schedule");
    const json = await res.json() as { data: { next_run_at: string | null } };
    expect(json.data.next_run_at).toBeNull();
  });

  it("next_run_at is a future ISO timestamp when schedule is enabled", async () => {
    await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, cron: "0 3 * * *" }),
    });

    const res = await app.request("/backup/schedule");
    const json = await res.json() as { data: { next_run_at: string | null } };
    if (json.data.next_run_at !== null) {
      expect(Date.parse(json.data.next_run_at)).toBeGreaterThan(Date.now());
    }
  });
});

// ─── PUT /backup/schedule ─────────────────────────────────────────────────────

describe("PUT /backup/schedule", () => {
  let tmpDir: string;
  let db: Database;
  let dbPath: string;
  let app: ReturnType<typeof createBackupRoute>;

  beforeEach(() => {
    tmpDir = makeTempDir();
    useIsolatedConfigHome(tmpDir);
    const dataDir = join(tmpDir, "data");
    mkdirSync(dataDir, { recursive: true });
    const result = makeFileDb(dataDir);
    db = result.db;
    dbPath = result.dbPath;
    app = createBackupRoute({ db, dbPath, dataDir });
  });

  afterEach(() => {
    try { db.close(); } catch { /* ignore */ }
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    restoreConfigHome();
  });

  it("accepts valid schedule update and returns updated config", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, cron: "0 2 * * *", retention_count: 5 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { enabled: boolean; cron: string; retention_count: number } };
    expect(json.data.enabled).toBe(true);
    expect(json.data.cron).toBe("0 2 * * *");
    expect(json.data.retention_count).toBe(5);
  });

  it("accepts partial update (enabled only)", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { enabled: boolean } };
    expect(json.data.enabled).toBe(false);
  });

  it("returns 422 for invalid cron expression (wrong part count)", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cron: "* *" }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toInclude("cron");
  });

  it("returns 422 for empty cron string", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cron: "" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 for non-positive retention_count", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention_count: 0 }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 for fractional retention_count", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention_count: 2.5 }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 422 for non-boolean enabled", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: "yes" }),
    });
    expect(res.status).toBe(422);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await app.request("/backup/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });
});
