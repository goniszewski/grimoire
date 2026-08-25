/**
 * Reconstruct a populated v0.5 library from a real (wiped-DB) user-uploads tree
 * and run inspect / dry-run / apply against it.
 *
 * Source observed at:
 *   /Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire/data
 * Layout: user-uploads/<ownerId>/<bookmarkId>/<file…> including nested
 * path-like filenames (e.g. "*.com/aero-v1/…") that appear in real installs.
 */
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { basename, extname, join, relative } from "path";
import { runMigrations } from "../db/migrations.js";
import { LEGACY_MIGRATE_MEDIA_LIMITS } from "../migrate/legacy-apply.js";
import {
  inspectLegacyV05Source,
  migrateLegacyV05Source,
} from "../migrate/legacy-migrate.js";

const REAL_DATA_DIR =
  "/Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire/data";
const REAL_UPLOADS = join(REAL_DATA_DIR, "user-uploads");

function walkFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      if (name === "." || name === ".." || name.startsWith("._")) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(full);
    }
  }
  walk(root);
  return out;
}

function mimeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".ico":
      return "image/x-icon";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function kindGuess(
  path: string
): "favicon" | "image" | "screenshot" {
  const ext = extname(path).toLowerCase();
  if (ext === ".ico") return "favicon";
  const size = statSync(path).size;
  if (size > LEGACY_MIGRATE_MEDIA_LIMITS.maxFaviconBytes) return "screenshot";
  if (ext === ".png" && size < 40_000) return "favicon";
  return "image";
}

async function rebuildFromRealUploads(): Promise<{
  dataDir: string;
  bookmarkCount: number;
  realBookmarkDirs: number;
  fileCount: number;
  nestedWeirdPaths: number;
}> {
  if (!existsSync(REAL_UPLOADS)) {
    throw new Error(`Real uploads not found at ${REAL_UPLOADS}`);
  }

  const dataDir = mkdtempSync(join(tmpdir(), "v05-real-rebuild-"));
  // Point uploads at the real tree (read-only use); keep DB in temp.
  const dbPath = join(dataDir, "db.sqlite");
  // Symlink user-uploads so resolveLegacySourcePaths finds it next to db.sqlite
  // when using dataDir mode. Use a directory junction via symlink.
  const { symlinkSync } = await import("fs");
  symlinkSync(REAL_UPLOADS, join(dataDir, "user-uploads"));

  const passwordHash = await Bun.password.hash("real-rebuild-secret", "argon2id");
  const bobHash = await Bun.password.hash("bob-secret", "argon2id");
  const db = new Database(dbPath);
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
    CREATE TABLE session (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
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
     VALUES (1, 'Real User', 'realuser', 'real@example.com', ?, 1, NULL, 1, ?, ?)`,
    [passwordHash, t0, t0]
  );
  db.run(
    `INSERT INTO user (id, name, username, email, password_hash, initial, disabled, is_admin, created, updated)
     VALUES (2, 'Other', 'bob', 'bob@example.com', ?, 1, NULL, 0, ?, ?)`,
    [bobHash, t0, t0]
  );
  // Lucia session row present in real installs — migrator must ignore it.
  db.run(`INSERT INTO session (id, user_id, expires_at) VALUES ('sess-1', 1, ?)`, [
    t0 + 86_400,
  ]);

  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (1, 'Imported', 'imported', 'Rebuilt from leftover uploads', '#336699', 1, NULL, NULL, 1, 'folder', 0, ?, ?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (2, 'Nested', 'nested', 'Child category', '#abcdef', 1, 1, NULL, NULL, NULL, 0, ?, ?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (3, 'BobOnly', 'bob-only', NULL, NULL, 2, NULL, NULL, NULL, NULL, 0, ?, ?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO tag (id, name, slug, owner_id, created, updated) VALUES (1, 'legacy-media', 'legacy-media', 1, ?, ?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO tag (id, name, slug, owner_id, created, updated) VALUES (2, 'pinned-batch', 'pinned-batch', 1, ?, ?)`,
    [t0, t0]
  );

  const ownerDir = join(REAL_UPLOADS, "1");
  const bookmarkDirs = readdirSync(ownerDir).filter((name) => {
    const st = statSync(join(ownerDir, name));
    return st.isDirectory() && /^\d+$/.test(name);
  });

  let fileId = 1;
  let nestedWeirdPaths = 0;
  let index = 0;

  for (const bookmarkIdStr of bookmarkDirs) {
    const bookmarkId = Number(bookmarkIdStr);
    const files = walkFiles(join(ownerDir, bookmarkIdStr));
    let iconId: number | null = null;
    let mainImageId: number | null = null;
    let screenshotId: number | null = null;

    for (const abs of files) {
      const rel = relative(REAL_UPLOADS, abs).replace(/\\/g, "/");
      if (rel.split("/").length > 3) nestedWeirdPaths += 1;
      const size = statSync(abs).size;
      const mime = mimeFor(abs);
      db.run(
        `INSERT INTO file (id, file_name, storage_type, relative_path, size, "mime-type", source, owner_id, created, updated)
         VALUES (?, ?, 'local', ?, ?, ?, 'upload', 1, ?, ?)`,
        [fileId, basename(abs), rel, size, mime, t0, t0]
      );

      const kind = kindGuess(abs);
      if (kind === "favicon" && iconId == null) iconId = fileId;
      else if (kind === "screenshot" && screenshotId == null) screenshotId = fileId;
      else if (mainImageId == null) mainImageId = fileId;
      fileId += 1;
    }

    const categoryId = index % 3 === 0 ? 2 : 1;
    const flagged = index % 5 === 0 ? 1 : null;
    const archived = index % 11 === 0 ? 1_700_000_400 : null;
    const read = index % 7 === 0 ? 1_700_000_300 : null;
    const openedTimes = index % 4;
    const note = index % 6 === 0 ? `note-for-${bookmarkId}` : null;
    const importance = index === 0 ? 3 : null;

    db.run(
      `INSERT INTO bookmark (
        id, url, domain, title, description, author, content_text, content_html, content_type,
        content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
        importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
      ) VALUES (
        ?, ?, 'example.com', ?, ?, 'legacy-author', ?, ?, 'html', '2024-01-01',
        ?, NULL, ?, NULL, ?, ?,
        ?, ?, ?, ?, 1, ?, ?, ?, ?, ?
      )`,
      [
        bookmarkId,
        `https://example.com/legacy-bookmark/${bookmarkId}`,
        `Legacy bookmark ${bookmarkId}`,
        files.length > 0 ? `${files.length} media file(s)` : null,
        index % 9 === 0 ? `content text ${bookmarkId}` : null,
        index % 9 === 0 ? `<p>${bookmarkId}</p>` : null,
        note,
        mainImageId,
        iconId,
        screenshotId,
        importance,
        flagged,
        read,
        archived,
        categoryId,
        openedTimes > 0 ? t0 + openedTimes : null,
        openedTimes,
        t0 - bookmarkId,
        t0,
      ]
    );
    db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (?, 1)`, [bookmarkId]);
    if (index % 5 === 0) {
      db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (?, 2)`, [bookmarkId]);
    }
    index += 1;
  }

  // Adversarial extras mixed into the real-media library.
  db.run(
    `INSERT INTO file (id, file_name, storage_type, relative_path, size, "mime-type", source, owner_id, created, updated)
     VALUES (?, 'remote.png', 's3', 's3/remote.png', 10, 'image/png', 'upload', 1, ?, ?)`,
    [fileId, t0, t0]
  );
  const s3FileId = fileId;
  fileId += 1;

  const maxBmId = Math.max(...bookmarkDirs.map(Number), 0);
  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      ?, 'http://127.0.0.1/private', '127.0.0.1', 'Private', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, NULL, 0, ?, ?
    )`,
    [maxBmId + 1, t0, t0]
  );
  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      ?, 'https://example.com/legacy-bookmark/${bookmarkDirs[0]}', 'example.com', 'Dup sibling', NULL, NULL, NULL, NULL, NULL, NULL, 'dup-note',
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, NULL, 0, ?, ?
    )`,
    [maxBmId + 2, t0, t0]
  );
  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      ?, 'https://example.com/s3-only', 'example.com', 'S3', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, 1, 1, NULL, 0, ?, ?
    )`,
    [maxBmId + 3, s3FileId, t0, t0]
  );
  db.run(
    `INSERT INTO bookmark (
      id, url, domain, title, description, author, content_text, content_html, content_type,
      content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
      importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
    ) VALUES (
      ?, 'https://bob.example.com/only', 'bob.example.com', 'Bob Only', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 3, NULL, 0, ?, ?
    )`,
    [maxBmId + 4, t0, t0]
  );

  db.close();
  // After normalize: N real URLs (dup collapsed) + s3 bookmark + private/LAN; bob excluded.
  const expectedCreated = bookmarkDirs.length + 2;
  return {
    dataDir,
    bookmarkCount: expectedCreated,
    realBookmarkDirs: bookmarkDirs.length,
    fileCount: fileId - 1,
    nestedWeirdPaths,
  };
}

describe("v0.5 migration against reconstructed real uploads", () => {
  it("inspects, dry-runs, and applies a kitchen-sink library from real user-uploads", async () => {
    if (!existsSync(REAL_UPLOADS)) {
      // Environment without the leftover tree — skip rather than fail CI.
      expect(true).toBe(true);
      return;
    }

    const rebuilt = await rebuildFromRealUploads();
    const targetDir = mkdtempSync(join(tmpdir(), "v05-real-target-"));
    const db = new Database(join(targetDir, "littleimp.db"));
    runMigrations(db);

    try {
      expect(rebuilt.realBookmarkDirs).toBeGreaterThan(10);
      expect(rebuilt.fileCount).toBeGreaterThan(20);
      expect(rebuilt.nestedWeirdPaths).toBeGreaterThan(0);

      const inspect = inspectLegacyV05Source({ dataDir: rebuilt.dataDir });
      expect(inspect.source).toBe("grimoire-v05-sqlite");
      expect(inspect.totals.users).toBe(2);
      expect(inspect.requiresOwnerSelection).toBe(true);

      const dry = await migrateLegacyV05Source(
        { dataDir: rebuilt.dataDir, owner: "realuser" },
        { db, dataDir: targetDir, dryRun: true, enqueueIngest: false }
      );
      expect(dry.dryRun).toBe(true);
      expect(dry.bookmarksCreated).toBe(rebuilt.bookmarkCount);
      expect(dry.bookmarksFailed).toBe(0);
      expect(dry.warnings.join("\n")).toMatch(/Not importing other owners/i);
      expect(dry.warnings.join("\n")).toMatch(/Merged duplicate URL/i);

      const summary = await migrateLegacyV05Source(
        {
          dataDir: rebuilt.dataDir,
          owner: "realuser",
          password: "real-rebuild-secret",
          requirePassword: true,
        },
        { db, dataDir: targetDir, enqueueIngest: false }
      );

      expect(summary.bookmarksCreated).toBe(rebuilt.bookmarkCount);
      expect(summary.bookmarksFailed).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/private\/LAN URL/i);
      expect(summary.tagsCreated).toBe(2);
      expect(summary.categoriesCreated).toBeGreaterThanOrEqual(2);
      expect(summary.mediaImported).toBeGreaterThan(0);
      expect(summary.warnings.join("\n")).toMatch(/remote storage_type=s3/i);
      expect(summary.warnings.join("\n")).toMatch(/importance=/i);

      const sniffedIco = db
        .query<{ c: number }, []>(
          `SELECT COUNT(*) AS c FROM bookmark_media
           WHERE media_type = 'image/x-icon' AND cache_path LIKE '%.ico'`
        )
        .get()?.c;
      expect(sniffedIco).toBeGreaterThan(0);

      const imported = db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks")
        .get()?.c;
      expect(imported).toBe(rebuilt.bookmarkCount);

      const pinned = db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks WHERE is_pinned = 1")
        .get()?.c;
      expect(pinned).toBeGreaterThan(0);

      const withNotes = db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM bookmarks WHERE notes IS NOT NULL AND notes != ''"
        )
        .get()?.c;
      expect(withNotes).toBeGreaterThan(0);

      const nestedCat = db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM categories WHERE parent_id IS NOT NULL"
        )
        .get()?.c;
      expect(nestedCat).toBeGreaterThan(0);

      const mediaRows = db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmark_media")
        .get()?.c;
      expect(mediaRows).toBe(summary.mediaImported);

      const rerun = await migrateLegacyV05Source(
        { dataDir: rebuilt.dataDir, owner: "realuser" },
        { db, dataDir: targetDir, enqueueIngest: false }
      );
      expect(rerun.bookmarksCreated).toBe(0);
      expect(rerun.bookmarksSkipped).toBeGreaterThanOrEqual(rebuilt.bookmarkCount);
    } finally {
      db.close();
      rmSync(targetDir, { recursive: true, force: true });
      rmSync(rebuilt.dataDir, { recursive: true, force: true });
    }
  });

  it("does not follow a symlinked user-uploads escape when resolving media", async () => {
    // Ensure symlink uploads next to db still reject .. traversal the same way.
    if (!existsSync(REAL_UPLOADS)) {
      expect(true).toBe(true);
      return;
    }
    const dataDir = mkdtempSync(join(tmpdir(), "v05-symlink-escape-"));
    const { symlinkSync } = await import("fs");
    symlinkSync(REAL_UPLOADS, join(dataDir, "user-uploads"));
    writeFileSync(join(dataDir, "db.sqlite"), ""); // placeholder replaced below

    const passwordHash = await Bun.password.hash("x", "argon2id");
    const db = new Database(join(dataDir, "db.sqlite"));
    db.exec(`
      CREATE TABLE user (
        id INTEGER PRIMARY KEY, name TEXT, username TEXT UNIQUE, email TEXT UNIQUE,
        password_hash TEXT, avatar_id INTEGER, settings TEXT, initial INTEGER, disabled INTEGER,
        is_admin INTEGER, created INTEGER, updated INTEGER
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
      CREATE TABLE file (
        id INTEGER PRIMARY KEY, file_name TEXT, storage_type TEXT, relative_path TEXT, size INTEGER,
        "mime-type" TEXT, source TEXT, owner_id INTEGER, created INTEGER, updated INTEGER
      );
    `);
    const t0 = 1_700_000_000;
    db.run(
      `INSERT INTO user VALUES (1,'A','a','a@b.c',?,NULL,'{}',1,NULL,0,?,?)`,
      [passwordHash, t0, t0]
    );
    db.run(
      `INSERT INTO category VALUES (1,'C','c',NULL,NULL,1,NULL,NULL,NULL,NULL,0,?,?)`,
      [t0, t0]
    );
    db.run(
      `INSERT INTO file VALUES (1,'x','local','../etc/passwd',10,'image/png','upload',1,?,?)`,
      [t0, t0]
    );
    db.run(
      `INSERT INTO bookmark (
        id,url,domain,title,description,author,content_text,content_html,content_type,content_published_date,
        note,main_image_url,main_image_id,icon_url,icon_id,screenshotId,importance,flagged,read,archived,
        owner_id,category_id,opened_last,opened_times,created,updated
      ) VALUES (1,'https://example.com/x','example.com','X',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,NULL,NULL,NULL,NULL,1,1,NULL,0,?,?)`,
      [t0, t0]
    );
    db.close();

    const targetDir = mkdtempSync(join(tmpdir(), "v05-symlink-target-"));
    const targetDb = new Database(join(targetDir, "littleimp.db"));
    runMigrations(targetDb);
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir },
        { db: targetDb, dataDir: targetDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.warnings.some((w) => /upload not found or unsafe/i.test(w))).toBe(true);
    } finally {
      targetDb.close();
      rmSync(targetDir, { recursive: true, force: true });
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
