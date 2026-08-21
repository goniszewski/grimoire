import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { runMigrations } from "../db/migrations.js";
import { JobQueue } from "../queue.js";
import {
  findLegacyOwner,
  inspectLegacyV05Source,
  migrateLegacyV05Source,
  openLegacyV05Database,
  verifyLegacyOwnerPassword,
  LegacyAuthError,
  LegacySourceError,
} from "../migrate/legacy-migrate.js";
import { normalizeLegacyLibrary } from "../migrate/legacy-normalize.js";
import { resolveLegacyUploadPath } from "../migrate/legacy-paths.js";

async function makeV05Fixture(): Promise<{
  dataDir: string;
  password: string;
  username: string;
}> {
  const dataDir = mkdtempSync(join(tmpdir(), "v05-fixture-"));
  const uploadsDir = join(dataDir, "user-uploads");
  mkdirSync(join(uploadsDir, "1", "1"), { recursive: true });

  const password = "migrate-secret";
  const passwordHash = await Bun.password.hash(password, "argon2id");

  const db = new Database(join(dataDir, "db.sqlite"));
  db.exec(`
    CREATE TABLE user (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_id INTEGER,
      settings TEXT DEFAULT '{}' NOT NULL,
      initial INTEGER DEFAULT 0 NOT NULL,
      disabled INTEGER,
      is_admin INTEGER DEFAULT 0 NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE file (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      file_name TEXT NOT NULL,
      storage_type TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      size INTEGER,
      "mime-type" TEXT NOT NULL,
      source TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE category (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      color TEXT,
      owner_id INTEGER NOT NULL,
      parent_id INTEGER,
      archived INTEGER,
      public INTEGER,
      icon TEXT,
      initial INTEGER DEFAULT 0 NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE bookmark (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      author TEXT,
      content_text TEXT,
      content_html TEXT,
      content_type TEXT,
      content_published_date TEXT,
      note TEXT,
      main_image_url TEXT,
      main_image_id INTEGER,
      icon_url TEXT,
      icon_id INTEGER,
      screenshotId INTEGER,
      importance INTEGER,
      flagged INTEGER,
      read INTEGER,
      archived INTEGER,
      owner_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      opened_last INTEGER,
      opened_times INTEGER DEFAULT 0 NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE bookmarks_to_tags (
      bookmark_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (bookmark_id, tag_id)
    );
  `);

  const t0 = 1_700_000_000;
  db.run(
    `INSERT INTO user (id, name, username, email, password_hash, initial, disabled, is_admin, created, updated)
     VALUES (1, 'Alice', 'alice', 'alice@example.com', ?, 1, NULL, 1, ?, ?)`,
    [passwordHash, t0, t0]
  );
  db.run(
    `INSERT INTO user (id, name, username, email, password_hash, initial, disabled, is_admin, created, updated)
     VALUES (2, 'Bob', 'bob', 'bob@example.com', ?, 1, NULL, 0, ?, ?)`,
    [passwordHash, t0, t0]
  );

  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (1, 'Research', 'research', 'Research notes', '#112233', 1, NULL, NULL, NULL, 'book', 0, ?, ?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (2, 'Papers', 'papers', NULL, NULL, 1, 1, NULL, NULL, NULL, 0, ?, ?)`,
    [t0, t0]
  );

  db.run(
    `INSERT INTO tag (id, name, slug, owner_id, created, updated) VALUES (1, 'sqlite', 'sqlite', 1, ?, ?)`,
    [t0, t0]
  );

  writeFileSync(
    join(uploadsDir, "1", "1", "icon.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    )
  );
  db.run(
    `INSERT INTO file (id, file_name, storage_type, relative_path, size, "mime-type", source, owner_id, created, updated)
     VALUES (1, 'icon', 'local', '1/1/icon.png', 68, 'image/png', 'upload', 1, ?, ?)`,
    [t0, t0]
  );

  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      1, 'https://example.com/article', 'example.com', 'Example Article', 'A description', 'Ada',
      'Hello', '<p>Hello</p>', 'html', '2024-01-15', 'Personal note', NULL, NULL,
      'https://example.com/icon.png', 1, NULL,
      2, ?, ?, NULL, 1, 2, ?, 7, ?, ?
    )`,
    [t0 + 100, t0 + 200, t0 + 300, t0, t0]
  );
  db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (1, 1)`);

  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      2, 'https://bob.example.com/only', 'bob.example.com', 'Bob Only', NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, 2, 1, NULL, 0, ?, ?
    )`,
    [t0, t0]
  );
  // Bob needs a category for FK in real schema; our fixture allows category 1 owned by alice — use bob category
  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (3, 'BobCat', 'bobcat', NULL, NULL, 2, NULL, NULL, NULL, NULL, 0, ?, ?)`,
    [t0, t0]
  );
  db.run(`UPDATE bookmark SET category_id = 3 WHERE id = 2`);

  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      3, 'http://127.0.0.1/private', '127.0.0.1', 'Private', NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, 1, 1, NULL, 0, ?, ?
    )`,
    [t0, t0]
  );
  db.close();

  return { dataDir, password, username: "alice" };
}

describe("Grimoire v0.5 SQLite migration", () => {
  let fixture: Awaited<ReturnType<typeof makeV05Fixture>>;

  beforeAll(async () => {
    fixture = await makeV05Fixture();
  });

  afterAll(() => {
    if (fixture?.dataDir) rmSync(fixture.dataDir, { recursive: true, force: true });
  });

  it("inspects users and totals from a v0.5 data directory", () => {
    const result = inspectLegacyV05Source({ dataDir: fixture.dataDir });
    expect(result.source).toBe("grimoire-v05-sqlite");
    expect(result.requiresOwnerSelection).toBe(true);
    expect(result.totals.users).toBe(2);
    expect(result.totals.bookmarks).toBe(3);
    expect(result.users.map((u) => u.username).sort()).toEqual(["alice", "bob"]);
    expect(result.users.find((u) => u.username === "alice")?.bookmarkCount).toBe(2);
  });

  it("verifies owner password and rejects bad passwords", async () => {
    const contents = openLegacyV05Database({ dataDir: fixture.dataDir });
    const owner = findLegacyOwner(contents, "alice");
    await verifyLegacyOwnerPassword(owner, fixture.password);
    await expect(verifyLegacyOwnerPassword(owner, "wrong")).rejects.toBeInstanceOf(LegacyAuthError);
  });

  it("normalizes parity fields, media paths, and imports private URLs with a warning", () => {
    const contents = openLegacyV05Database({ dataDir: fixture.dataDir });
    const owner = findLegacyOwner(contents, "alice");
    const library = normalizeLegacyLibrary(contents, owner);
    expect(library.bookmarks).toHaveLength(2);
    expect(library.skippedBookmarks).toHaveLength(0);
    expect(library.bookmarks.some((b) => b.isPrivateHost)).toBe(true);
    expect(library.warnings.some((w) => /private\/LAN URL/i.test(w))).toBe(true);

    const bm = library.bookmarks.find((b) => !b.isPrivateHost)!;
    expect(bm.isPinned).toBe(true);
    expect(bm.readAt).toContain("2023");
    expect(bm.openedCount).toBe(7);
    expect(bm.notes).toBe("Personal note");
    expect(bm.publishedAt).toBe("2024-01-15");
    expect(bm.categoryPath).toEqual(["Research", "Papers"]);
    expect(bm.tags).toEqual(["sqlite"]);
    expect(bm.media.some((m) => m.kind === "favicon" && m.absolutePath)).toBe(true);

    expect(resolveLegacyUploadPath(contents.uploadsDir, "1/1/icon.png")).toBeTruthy();
    expect(resolveLegacyUploadPath(contents.uploadsDir, "../etc/passwd")).toBeNull();

    const symlinkProbe = mkdtempSync(join(tmpdir(), "v05-symlink-"));
    try {
      const linkPath = join(symlinkProbe, "escape-link.png");
      symlinkSync("/etc/passwd", linkPath);
      expect(resolveLegacyUploadPath(symlinkProbe, "escape-link.png")).toBeNull();
    } finally {
      rmSync(symlinkProbe, { recursive: true, force: true });
    }
  });

  it("applies a selected owner's library into a fresh Grimoire database", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "v05-apply-"));
    const db = new Database(join(dataDir, "littleimp.db"));
    runMigrations(db);
    const queue = new JobQueue(db);

    try {
      const summary = await migrateLegacyV05Source(
        {
          dataDir: fixture.dataDir,
          owner: "alice",
          password: fixture.password,
          requirePassword: true,
        },
        { db, dataDir, queue, enqueueIngest: false }
      );

      expect(summary.bookmarksCreated).toBe(2);
      expect(summary.bookmarksSkipped).toBe(0);
      expect(summary.dryRun).toBe(false);
      expect(summary.categoriesCreated).toBeGreaterThanOrEqual(2);
      expect(summary.tagsCreated).toBe(1);
      expect(summary.mediaImported).toBeGreaterThanOrEqual(1);
      expect(summary.warnings.some((w) => /private\/LAN URL/i.test(w))).toBe(true);

      const row = db
        .query<{
          title: string;
          is_pinned: number;
          notes: string | null;
          opened_count: number;
          read_at: string | null;
        }, []>(
          "SELECT title, is_pinned, notes, opened_count, read_at FROM bookmarks WHERE title = 'Example Article'"
        )
        .get();
      expect(row?.title).toBe("Example Article");
      expect(row?.is_pinned).toBe(1);
      expect(row?.notes).toBe("Personal note");
      expect(row?.opened_count).toBe(7);
      expect(row?.read_at).toBeTruthy();

      const privateRow = db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM bookmarks WHERE url LIKE 'http://127.0.0.1/%'"
        )
        .get();
      expect(privateRow?.c).toBe(1);

      const content = db
        .query<{ markdown: string | null; author: string | null; published_at: string | null }, []>(
          "SELECT markdown, author, published_at FROM bookmark_content"
        )
        .get();
      expect(content?.markdown).toBe("Hello");
      expect(content?.author).toBe("Ada");
      expect(content?.published_at).toBe("2024-01-15");
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("dry-run reports planned counts without writing", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "v05-dry-"));
    const db = new Database(join(dataDir, "littleimp.db"));
    runMigrations(db);

    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir, owner: "alice" },
        { db, dataDir, dryRun: true, enqueueIngest: false }
      );

      expect(summary.dryRun).toBe(true);
      expect(summary.bookmarksCreated).toBe(2);
      expect(summary.bookmarksSkipped).toBe(0);
      expect(summary.categoriesCreated).toBeGreaterThanOrEqual(2);
      expect(summary.tagsCreated).toBe(1);
      expect(summary.mediaImported).toBeGreaterThanOrEqual(1);
      expect(summary.warnings.some((w) => /dry run/i.test(w))).toBe(true);

      const bookmarkCount = db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks")
        .get()?.c;
      const categoryCount = db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM categories")
        .get()?.c;
      const tagCount = db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM tags").get()?.c;
      expect(bookmarkCount).toBe(0);
      expect(categoryCount).toBe(0);
      expect(tagCount).toBe(0);
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("requires owner selection for multi-user databases", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "v05-fail-"));
    const db = new Database(":memory:");
    try {
      await expect(
        migrateLegacyV05Source(
          { dataDir: fixture.dataDir },
          { db, dataDir, enqueueIngest: false }
        )
      ).rejects.toBeInstanceOf(LegacySourceError);
    } finally {
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("rejects PocketBase-shaped databases with a clear error", () => {
    const dir = mkdtempSync(join(tmpdir(), "not-v05-"));
    const db = new Database(join(dir, "db.sqlite"));
    db.exec("CREATE TABLE users (id TEXT); CREATE TABLE bookmarks (id TEXT);");
    db.close();
    try {
      expect(() => inspectLegacyV05Source({ dataDir: dir })).toThrow(/PocketBase/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects non-v0.5 databases", () => {
    const dir = mkdtempSync(join(tmpdir(), "not-v05-"));
    const db = new Database(join(dir, "db.sqlite"));
    db.exec("CREATE TABLE unrelated (id TEXT);");
    db.close();
    try {
      expect(() => inspectLegacyV05Source({ dataDir: dir })).toThrow(LegacySourceError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects archives with path-traversal members", () => {
    const parent = mkdtempSync(join(tmpdir(), "v05-slip-"));
    const evilZip = join(parent, "evil.zip");
    // Craft a zip whose member path escapes via ../ (Info-ZIP accepts this in the listing).
    const zip = spawnSync(
      "python3",
      [
        "-c",
        [
          "import zipfile, sys",
          "z = zipfile.ZipFile(sys.argv[1], 'w')",
          "z.writestr('../escape.txt', 'nope')",
          "z.writestr('db.sqlite', 'not-a-real-db')",
          "z.close()",
        ].join("; "),
        evilZip,
      ],
      { encoding: "utf8" }
    );
    expect(zip.status).toBe(0);
    try {
      expect(() => inspectLegacyV05Source({ archivePath: evilZip })).toThrow(/unsafe path|zip-slip/i);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("inspects and applies from zip and tar.gz archives of the data folder", async () => {
    const zipPath = join(fixture.dataDir, "..", `v05-${Date.now()}.zip`);
    const tarGzPath = join(fixture.dataDir, "..", `v05-${Date.now()}.tar.gz`);
    const parent = join(fixture.dataDir, "..");
    const dataBasename = fixture.dataDir.split("/").pop()!;

    const zip = spawnSync("zip", ["-qr", zipPath, dataBasename], {
      cwd: parent,
      encoding: "utf8",
    });
    expect(zip.status).toBe(0);

    const tar = spawnSync("tar", ["-czf", tarGzPath, dataBasename], {
      cwd: parent,
      encoding: "utf8",
    });
    expect(tar.status).toBe(0);

    try {
      const zipInspect = inspectLegacyV05Source({ archivePath: zipPath });
      expect(zipInspect.source).toBe("grimoire-v05-sqlite");
      expect(zipInspect.totals.bookmarks).toBe(3);

      const tarInspect = inspectLegacyV05Source({ archivePath: tarGzPath });
      expect(tarInspect.totals.users).toBe(2);

      const outDir = mkdtempSync(join(tmpdir(), "v05-archive-apply-"));
      const db = new Database(join(outDir, "littleimp.db"));
      runMigrations(db);
      try {
        const summary = await migrateLegacyV05Source(
          { archivePath: zipPath, owner: "alice" },
          { db, dataDir: outDir, enqueueIngest: false }
        );
        expect(summary.bookmarksCreated).toBe(2);
        expect(summary.mediaImported).toBeGreaterThanOrEqual(1);
      } finally {
        db.close();
        rmSync(outDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(zipPath, { force: true });
      rmSync(tarGzPath, { force: true });
    }
  });
});
