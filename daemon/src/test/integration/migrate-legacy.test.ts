import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

async function makeV05DataDir(): Promise<{ dataDir: string; cleanup: () => void; password: string }> {
  const dataDir = mkdtempSync(join(tmpdir(), "migrate-route-"));
  mkdirSync(join(dataDir, "user-uploads"), { recursive: true });
  const password = "route-secret";
  const passwordHash = await Bun.password.hash(password, "argon2id");
  const db = new Database(join(dataDir, "db.sqlite"));
  const t0 = 1_700_000_000;
  db.exec(`
    CREATE TABLE user (
      id INTEGER PRIMARY KEY, name TEXT, username TEXT, email TEXT, password_hash TEXT,
      avatar_id INTEGER, settings TEXT, initial INTEGER, disabled INTEGER, is_admin INTEGER,
      created INTEGER, updated INTEGER
    );
    CREATE TABLE category (
      id INTEGER PRIMARY KEY, name TEXT, slug TEXT, description TEXT, color TEXT,
      owner_id INTEGER, parent_id INTEGER, archived INTEGER, public INTEGER, icon TEXT,
      initial INTEGER, created INTEGER, updated INTEGER
    );
    CREATE TABLE tag (
      id INTEGER PRIMARY KEY, name TEXT, slug TEXT, owner_id INTEGER, created INTEGER, updated INTEGER
    );
    CREATE TABLE bookmark (
      id INTEGER PRIMARY KEY, url TEXT, domain TEXT, title TEXT, description TEXT, author TEXT,
      content_text TEXT, content_html TEXT, content_type TEXT, content_published_date TEXT, note TEXT,
      main_image_url TEXT, main_image_id INTEGER, icon_url TEXT, icon_id INTEGER, screenshotId INTEGER,
      importance INTEGER, flagged INTEGER, read INTEGER, archived INTEGER, owner_id INTEGER,
      category_id INTEGER, opened_last INTEGER, opened_times INTEGER, created INTEGER, updated INTEGER
    );
    CREATE TABLE bookmarks_to_tags (bookmark_id INTEGER, tag_id INTEGER, PRIMARY KEY (bookmark_id, tag_id));
  `);
  db.run(
    `INSERT INTO user VALUES (1,'Ada','ada','ada@example.com',?,NULL,'{}',1,NULL,1,?,?)`,
    [passwordHash, t0, t0]
  );
  db.run(
    `INSERT INTO category VALUES (1,'General','general',NULL,NULL,1,NULL,NULL,NULL,NULL,0,?,?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO bookmark VALUES (
      1,'https://example.com/x','example.com','X',NULL,NULL,NULL,NULL,NULL,NULL,'note',
      NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,1,NULL,0,?,?
    )`,
    [t0, t0]
  );
  db.close();
  return {
    dataDir,
    password,
    cleanup: () => rmSync(dataDir, { recursive: true, force: true }),
  };
}

describe("legacy migrate routes (v0.5)", () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  let dataDir: string;
  let fixture: Awaited<ReturnType<typeof makeV05DataDir>>;

  beforeEach(async () => {
    db = makeTestDb();
    dataDir = mkdtempSync(join(tmpdir(), "migrate-app-"));
    app = createApp({
      db,
      queue: new JobQueue(db),
      startTime: new Date(),
      version: "test",
      staticDir: false,
      dataDir,
    });
    fixture = await makeV05DataDir();
  });

  afterEach(() => {
    fixture?.cleanup();
    rmSync(dataDir, { recursive: true, force: true });
    db.close();
  });

  it("POST /migrate/legacy/inspect summarizes a v0.5 data dir", async () => {
    const res = await app.request("/migrate/legacy/inspect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataDir: fixture.dataDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.source).toBe("grimoire-v05-sqlite");
    expect(body.data.totals.bookmarks).toBe(1);
    expect(body.data.users[0].username).toBe("ada");
  });

  it("POST /migrate/legacy/apply imports with password verification", async () => {
    const res = await app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataDir: fixture.dataDir,
        owner: "ada",
        password: fixture.password,
        requirePassword: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.bookmarksCreated).toBe(1);
    expect(body.data.dryRun).toBe(false);
    expect(body.data.owner.username).toBe("ada");

    const count = db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks").get()?.c;
    expect(count).toBe(1);
  });

  it("POST /migrate/legacy/apply dryRun does not write bookmarks", async () => {
    const res = await app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataDir: fixture.dataDir,
        owner: "ada",
        dryRun: true,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.dryRun).toBe(true);
    expect(body.data.bookmarksCreated).toBe(1);
    expect(body.data.warnings.join(" ")).toMatch(/dry run/i);

    const count = db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks").get()?.c;
    expect(count).toBe(0);
  });

  it("POST /migrate/legacy/apply returns 409 when another apply is in progress", async () => {
    const first = app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataDir: fixture.dataDir,
        owner: "ada",
        password: fixture.password,
        requirePassword: true,
      }),
    });
    const second = app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataDir: fixture.dataDir,
        owner: "ada",
        password: fixture.password,
        requirePassword: true,
      }),
    });
    const [r1, r2] = await Promise.all([first, second]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
  });

  it("POST /migrate/legacy/apply rejects bad passwords", async () => {
    const res = await app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataDir: fixture.dataDir,
        owner: "ada",
        password: "nope",
        requirePassword: true,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /migrate/legacy/apply returns 422 when owner selection is required", async () => {
    const multi = await makeV05DataDir();
    const db = new Database(join(multi.dataDir, "db.sqlite"));
    const t0 = 1_700_000_000;
    const passwordHash = await Bun.password.hash("x", "argon2id");
    db.run(
      `INSERT INTO user VALUES (2,'Bob','bob','bob@example.com',?,NULL,'{}',1,NULL,0,?,?)`,
      [passwordHash, t0, t0]
    );
    db.close();

    try {
      const res = await app.request("/migrate/legacy/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataDir: multi.dataDir }),
      });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(String(body.detail)).toMatch(/multiple users/i);
    } finally {
      multi.cleanup();
    }
  });

  it("POST /migrate/legacy/apply returns 401 when requirePassword is set without a password", async () => {
    const res = await app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataDir: fixture.dataDir,
        owner: "ada",
        requirePassword: true,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /migrate/legacy/apply returns 207 when bookmarksFailed > 0", async () => {
    db.exec(`
      CREATE TRIGGER trg_inject_migrate_fail
      BEFORE INSERT ON bookmarks
      BEGIN
        SELECT RAISE(ABORT, 'injected migrate failure');
      END;
    `);

    const res = await app.request("/migrate/legacy/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataDir: fixture.dataDir, owner: "ada" }),
    });
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.data.bookmarksFailed).toBeGreaterThan(0);
  });
});
