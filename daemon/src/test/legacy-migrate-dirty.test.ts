/**
 * Adversarial / dirty-data coverage for v0.5 → 1.x migration.
 * These cases mirror real libraries that are incomplete, nested too deep,
 * re-run, or contain unsafe URLs — beyond the happy-path fixture.
 */
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, linkSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync, chmodSync, cpSync, readFileSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import { runMigrations } from "../db/migrations.js";
import { LEGACY_MIGRATE_MEDIA_LIMITS, legacyMediaSourceUrl } from "../migrate/legacy-apply.js";
import {
  findLegacyOwner,
  inspectLegacyV05Source,
  migrateLegacyV05Source,
  openLegacyV05Database,
  LegacySourceError,
} from "../migrate/legacy-migrate.js";
import { normalizeLegacyLibrary } from "../migrate/legacy-normalize.js";
import { resolveLegacySourcePaths } from "../migrate/legacy-paths.js";
import { findDbSqliteInTree, extractLegacyArchive, assertExtractTreeSafe } from "../migrate/legacy-archive.js";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

type DirtyOpts = {
  users?: Array<{
    id: number;
    username: string;
    email: string;
    disabled?: number | null;
    passwordHash?: string;
  }>;
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
    ownerId: number;
    parentId?: number | null;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    archived?: number | null;
    public?: number | null;
  }>;
  tags?: Array<{ id: number; name: string; slug: string; ownerId: number }>;
  files?: Array<{
    id: number;
    relativePath: string;
    ownerId: number;
    writeBytes?: Buffer | null;
    storageType?: string;
    mimeType?: string;
  }>;
  bookmarks?: Array<{
    id: number;
    url: string;
    title: string;
    ownerId: number;
    categoryId: number | null;
    tagIds?: number[];
    iconId?: number | null;
    importance?: number | null;
    note?: string | null;
    description?: string | null;
    contentHtml?: string | null;
    contentText?: string | null;
    contentType?: string | null;
    contentPublishedDate?: string | null;
    iconUrl?: string | null;
    mainImageUrl?: string | null;
    flagged?: number | null;
    archived?: number | null;
    openedTimes?: number;
  }>;
  includeFileTable?: boolean;
  withUploads?: boolean;
};

async function makeDirtyFixture(opts: DirtyOpts = {}): Promise<{
  dataDir: string;
  dbPath: string;
  uploadsDir: string;
}> {
  const dataDir = mkdtempSync(join(tmpdir(), "v05-dirty-"));
  const uploadsDir = join(dataDir, "user-uploads");
  if (opts.withUploads !== false) mkdirSync(uploadsDir, { recursive: true });

  const passwordHash =
    opts.users?.[0]?.passwordHash ??
    (await Bun.password.hash("dirty-secret", "argon2id"));

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

  if (opts.includeFileTable !== false) {
    db.exec(`
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
    `);
  }

  const t0 = 1_700_000_000;
  const users = opts.users ?? [
    { id: 1, username: "solo", email: "solo@example.com", disabled: null },
  ];
  for (const user of users) {
    db.run(
      `INSERT INTO user (id, name, username, email, password_hash, initial, disabled, is_admin, created, updated)
       VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)`,
      [
        user.id,
        user.username,
        user.username,
        user.email,
        user.passwordHash ?? passwordHash,
        user.disabled ?? null,
        t0,
        t0,
      ]
    );
  }

  const categories = opts.categories ?? [
    { id: 1, name: "Root", slug: "root", ownerId: users[0].id, parentId: null },
  ];
  for (const category of categories) {
    db.run(
      `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        category.id,
        category.name,
        category.slug,
        category.description ?? null,
        category.color ?? null,
        category.ownerId,
        category.parentId ?? null,
        category.archived ?? null,
        category.public ?? null,
        category.icon ?? null,
        t0,
        t0,
      ]
    );
  }

  for (const tag of opts.tags ?? []) {
    db.run(
      `INSERT INTO tag (id, name, slug, owner_id, created, updated) VALUES (?, ?, ?, ?, ?, ?)`,
      [tag.id, tag.name, tag.slug, tag.ownerId, t0, t0]
    );
  }

  if (opts.includeFileTable !== false) {
    for (const file of opts.files ?? []) {
      if (file.writeBytes !== null) {
        const abs = join(uploadsDir, file.relativePath);
        mkdirSync(join(abs, ".."), { recursive: true });
        writeFileSync(abs, file.writeBytes ?? TINY_PNG);
      }
      db.run(
        `INSERT INTO file (id, file_name, storage_type, relative_path, size, "mime-type", source, owner_id, created, updated)
         VALUES (?, 'icon', ?, ?, ?, ?, 'upload', ?, ?, ?)`,
        [
          file.id,
          file.storageType ?? "local",
          file.relativePath,
          file.writeBytes?.byteLength ?? TINY_PNG.byteLength,
          file.mimeType ?? "image/png",
          file.ownerId,
          t0,
          t0,
        ]
      );
    }
  }

  for (const bookmark of opts.bookmarks ?? []) {
    db.run(
      `INSERT INTO bookmark (
        id, url, domain, title, description, author, content_text, content_html, content_type,
        content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
        importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
      ) VALUES (
        ?, ?, 'example.com', ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL,
        ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?
      )`,
      [
        bookmark.id,
        bookmark.url,
        bookmark.title,
        bookmark.description ?? null,
        bookmark.contentText ?? null,
        bookmark.contentHtml ?? null,
        bookmark.contentType ?? null,
        bookmark.contentPublishedDate ?? null,
        bookmark.note ?? null,
        bookmark.mainImageUrl ?? null,
        bookmark.iconUrl ?? null,
        bookmark.iconId ?? null,
        bookmark.importance ?? null,
        bookmark.flagged ?? null,
        bookmark.archived ?? null,
        bookmark.ownerId,
        bookmark.categoryId,
        bookmark.openedTimes ?? 0,
        t0,
        t0,
      ]
    );
    for (const tagId of bookmark.tagIds ?? []) {
      db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (?, ?)`, [
        bookmark.id,
        tagId,
      ]);
    }
  }

  db.close();
  return { dataDir, dbPath: join(dataDir, "db.sqlite"), uploadsDir };
}

function freshTarget(): { dataDir: string; db: Database } {
  const dataDir = mkdtempSync(join(tmpdir(), "v05-target-"));
  const db = new Database(join(dataDir, "littleimp.db"));
  runMigrations(db);
  return { dataDir, db };
}

describe("v0.5 migration dirty user-data cases", () => {
  it("auto-selects the only user and imports an empty library safely", async () => {
    const fixture = await makeDirtyFixture({ bookmarks: [] });
    const target = freshTarget();
    try {
      const inspect = inspectLegacyV05Source({ dataDir: fixture.dataDir });
      expect(inspect.requiresOwnerSelection).toBe(false);
      expect(inspect.totals.users).toBe(1);

      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(0);
      expect(summary.bookmarksFailed).toBe(0);
      expect(summary.owner.username).toBe("solo");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("skips duplicates on re-run and merges when mergeDuplicates is set", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/once",
          title: "Once",
          ownerId: 1,
          categoryId: 1,
          note: "first",
        },
      ],
    });
    const target = freshTarget();
    try {
      const first = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(first.bookmarksCreated).toBe(1);

      const second = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(second.bookmarksCreated).toBe(0);
      expect(second.bookmarksSkipped).toBe(1);

      // Mutate source note then merge
      const src = new Database(fixture.dbPath);
      src.run(`UPDATE bookmark SET note = 'merged-note' WHERE id = 1`);
      src.close();

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ notes: string | null }, []>("SELECT notes FROM bookmarks")
        .get();
      // mergeImportDuplicate appends rather than replacing existing notes
      expect(row?.notes).toContain("first");
      expect(row?.notes).toContain("merged-note");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("dedupes duplicate URLs inside the same owner's library", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/dup",
          title: "First",
          ownerId: 1,
          categoryId: 1,
          note: "first-note",
        },
        {
          id: 2,
          url: "https://example.com/dup",
          title: "Second",
          ownerId: 1,
          categoryId: 1,
          note: "second-note",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksSkipped).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/Merged duplicate URL/i);
      const row = target.db
        .query<{ notes: string | null }, []>("SELECT notes FROM bookmarks")
        .get();
      expect(row?.notes).toContain("first-note");
      expect(row?.notes).toContain("second-note");
      const count = target.db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks")
        .get()?.c;
      expect(count).toBe(1);
      const provenance = target.db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM bookmark_provenance WHERE source = 'legacy-v05'"
        )
        .get()?.c;
      expect(provenance).toBe(1);

      const dry = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          dryRun: true,
          mergeDuplicates: true,
        }
      );
      expect(dry.bookmarksCreated).toBe(0);
      expect(dry.bookmarksMerged).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports private/LAN URLs but skips credential and non-http URLs", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/ok",
          title: "Ok",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 2,
          url: "http://192.168.1.10/lan",
          title: "LAN",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 6,
          url: "http://[::ffff:10.0.0.5]/internal",
          title: "Mapped IPv6 LAN",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 7,
          url: "http://localhost./loop",
          title: "FQDN localhost",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 3,
          url: "https://user:pass@example.com/secret",
          title: "Creds",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 4,
          url: "javascript:alert(1)",
          title: "JS",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 5,
          url: "ftp://example.com/file",
          title: "FTP",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    try {
      const contents = openLegacyV05Database({ dataDir: fixture.dataDir });
      const owner = findLegacyOwner(contents, undefined);
      const library = normalizeLegacyLibrary(contents, owner);
      const reasons = library.skippedBookmarks.map((s) => s.reason).sort();
      expect(library.bookmarks).toHaveLength(4);
      expect(library.bookmarks.some((b) => b.url.includes("192.168.1.10") && b.isPrivateHost)).toBe(
        true
      );
      expect(
        library.bookmarks.some(
          (b) => b.isPrivateHost && (b.url.includes("ffff") || b.url.includes("10.0.0.5"))
        )
      ).toBe(true);
      expect(
        library.bookmarks.some((b) => b.isPrivateHost && b.url.includes("localhost"))
      ).toBe(true);
      expect(reasons).toEqual(["credential_url", "non_http_url", "non_http_url"]);
    } finally {
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }
  });

  it("warns and soft-skips missing media, orphan tags, and missing categories", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        { id: 1, relativePath: "1/missing.png", ownerId: 1, writeBytes: null },
        { id: 99, relativePath: "1/ghost.png", ownerId: 1, writeBytes: null },
      ],
      tags: [{ id: 1, name: "kept", slug: "kept", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/messy",
          title: "Messy",
          ownerId: 1,
          categoryId: 999, // missing category
          tagIds: [1, 404], // one orphan tag
          iconId: 1, // file row exists but bytes missing
        },
        {
          id: 2,
          url: "https://example.com/ghost-file",
          title: "Ghost",
          ownerId: 1,
          categoryId: 1,
          iconId: 777, // no file row
        },
      ],
    });
    // Remove the "missing" file after insert so DB points at absent disk path
    rmSync(join(fixture.uploadsDir, "1"), { recursive: true, force: true });

    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);
      expect(summary.mediaImported).toBe(0);
      // Missing disk path + missing file-table id both count as skipped media.
      expect(summary.mediaSkipped).toBeGreaterThanOrEqual(2);
      expect(summary.warnings.some((w) => /missing\/unowned category/i.test(w))).toBe(true);
      expect(summary.warnings.some((w) => /missing\/unowned tag/i.test(w))).toBe(true);
      expect(summary.warnings.some((w) => /upload not found|file id 777/i.test(w))).toBe(true);

      const tags = target.db
        .query<{ name: string }, []>(
          `SELECT t.name FROM tags t
           JOIN bookmark_tags bt ON bt.tag_id = t.id
           JOIN bookmarks b ON b.id = bt.bookmark_id
           WHERE b.url = 'https://example.com/messy'`
        )
        .all()
        .map((r) => r.name);
      expect(tags).toEqual(["kept"]);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("truncates category trees deeper than three levels with a warning", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "L1", slug: "l1", ownerId: 1, parentId: null },
        { id: 2, name: "L2", slug: "l2", ownerId: 1, parentId: 1 },
        { id: 3, name: "L3", slug: "l3", ownerId: 1, parentId: 2 },
        { id: 4, name: "L4", slug: "l4", ownerId: 1, parentId: 3 },
        { id: 5, name: "L5", slug: "l5", ownerId: 1, parentId: 4 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/deep",
          title: "Deep",
          ownerId: 1,
          categoryId: 5,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.some((w) => /ancestors \+ leaf/i.test(w))).toBe(true);

      const depth = target.db
        .query<{ depth: number }, []>(
          `WITH RECURSIVE tree(id, depth) AS (
             SELECT id, 1 FROM categories WHERE parent_id IS NULL
             UNION ALL
             SELECT c.id, tree.depth + 1 FROM categories c JOIN tree ON c.parent_id = tree.id
           )
           SELECT MAX(depth) AS depth FROM tree`
        )
        .get()?.depth;
      expect(depth).toBe(3);

      const leaf = target.db
        .query<{ name: string }, []>(
          `SELECT c.name FROM bookmarks b
           JOIN categories c ON c.id = b.category_id
           WHERE b.url = 'https://example.com/deep'`
        )
        .get();
      expect(leaf?.name).toBe("L5");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("does not let truncated deep category metadata archive a shallow same-path leaf", async () => {
    // Shallow Work/Projects/Alpha (active) vs deep Work/Projects/Misc/Extra/Alpha
    // (archived). Truncation maps the deep leaf onto Work/Projects/Alpha — its
    // metadata must not overwrite the real shallow category.
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "Work", slug: "work", ownerId: 1, parentId: null },
        { id: 2, name: "Projects", slug: "projects", ownerId: 1, parentId: 1 },
        {
          id: 3,
          name: "Alpha",
          slug: "alpha-shallow",
          ownerId: 1,
          parentId: 2,
          archived: 0,
          color: "#00ff00",
        },
        { id: 4, name: "Misc", slug: "misc", ownerId: 1, parentId: 2 },
        { id: 5, name: "Extra", slug: "extra", ownerId: 1, parentId: 4 },
        {
          id: 6,
          name: "Alpha",
          slug: "alpha-deep",
          ownerId: 1,
          parentId: 5,
          archived: 1,
          color: "#ff0000",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/shallow-alpha",
          title: "Shallow",
          ownerId: 1,
          categoryId: 3,
        },
        {
          id: 2,
          url: "https://example.com/deep-alpha",
          title: "Deep",
          ownerId: 1,
          categoryId: 6,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);

      const alpha = target.db
        .query<{ is_archived: number; color: string | null; bookmark_count: number }, []>(
          `SELECT c.is_archived, c.color,
                  (SELECT COUNT(*) FROM bookmarks b WHERE b.category_id = c.id) AS bookmark_count
           FROM categories c
           WHERE c.name = 'Alpha'`
        )
        .get();
      expect(alpha?.is_archived).toBe(0);
      expect(alpha?.color).toBe("#00ff00");
      expect(alpha?.bookmark_count).toBe(2);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("breaks category parent cycles without hanging", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "A", slug: "a", ownerId: 1, parentId: 2 },
        { id: 2, name: "B", slug: "b", ownerId: 1, parentId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/cycle",
          title: "Cycle",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    try {
      const contents = openLegacyV05Database({ dataDir: fixture.dataDir });
      const owner = findLegacyOwner(contents, undefined);
      const library = normalizeLegacyLibrary(contents, owner);
      expect(library.bookmarks[0].categoryPath.length).toBeGreaterThan(0);
      expect(library.warnings.some((w) => /cycle/i.test(w))).toBe(true);
    } finally {
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }
  });

  it("skips oversized media while still importing the bookmark", async () => {
    const oversized = Buffer.alloc(LEGACY_MIGRATE_MEDIA_LIMITS.maxFaviconBytes + 64, 1);
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/big.png", ownerId: 1, writeBytes: oversized }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/big-icon",
          title: "Big",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBe(1);
      expect(summary.warnings.some((w) => /size .* outside allowed range/i.test(w))).toBe(true);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports a disabled owner with a warning and supports dbPath + uploadsDir", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        {
          id: 1,
          username: "ghost",
          email: "ghost@example.com",
          disabled: 1,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/ghost",
          title: "Ghost",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const paths = resolveLegacySourcePaths({
        dbPath: fixture.dbPath,
        uploadsDir: fixture.uploadsDir,
      });
      expect(paths.dbPath).toBe(fixture.dbPath);
      expect(paths.uploadsDir).toBe(fixture.uploadsDir);

      const summary = await migrateLegacyV05Source(
        { dbPath: fixture.dbPath, uploadsDir: fixture.uploadsDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.owner.disabled).toBe(true);
      expect(summary.warnings.some((w) => /disabled/i.test(w))).toBe(true);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("works when the optional file table is absent", async () => {
    const fixture = await makeDirtyFixture({
      includeFileTable: false,
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/no-files",
          title: "NoFiles",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rejects relative source paths", () => {
    expect(() => resolveLegacySourcePaths({ dataDir: "relative/data" })).toThrow(
      LegacySourceError
    );
    expect(() => resolveLegacySourcePaths({ dbPath: "./db.sqlite" })).toThrow(
      LegacySourceError
    );
  });

  it("preserves existing notes when merging duplicates and restores trashed rows", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/merge-notes",
          title: "Merge",
          ownerId: 1,
          categoryId: 1,
          note: "legacy-note",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );

      target.db.run(
        `UPDATE bookmarks
         SET notes = 'user-note', is_trashed = 1, trashed_at = '2024-01-01T00:00:00.000Z'
         WHERE url = 'https://example.com/merge-notes'`
      );

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);

      const row = target.db
        .query<{ notes: string | null; is_trashed: number }, []>(
          "SELECT notes, is_trashed FROM bookmarks WHERE url = 'https://example.com/merge-notes'"
        )
        .get();
      expect(row?.is_trashed).toBe(0);
      expect(row?.notes).toContain("user-note");
      expect(row?.notes).toContain("legacy-note");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("falls back empty titles to the URL and accepts unicode names", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "研究", slug: "yanjiu", ownerId: 1, parentId: null },
      ],
      tags: [{ id: 1, name: "日本語", slug: "nihongo", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/unicode",
          title: "",
          ownerId: 1,
          categoryId: 1,
          tagIds: [1],
        },
        {
          id: 2,
          url: "https://example.com/whitespace-title",
          title: "   \t  ",
          ownerId: 1,
          categoryId: 1,
          tagIds: [],
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);
      const rows = target.db
        .query<{ url: string; title: string }, []>(
          "SELECT url, title FROM bookmarks ORDER BY url"
        )
        .all();
      expect(rows).toEqual([
        { url: "https://example.com/unicode", title: "https://example.com/unicode" },
        {
          url: "https://example.com/whitespace-title",
          title: "https://example.com/whitespace-title",
        },
      ]);
      const cat = target.db
        .query<{ name: string }, []>("SELECT name FROM categories")
        .get();
      expect(cat?.name).toBe("研究");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("strips NUL bytes from titles and notes", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/nul",
          title: "safe\u0000title",
          ownerId: 1,
          categoryId: 1,
          note: "note\u0000body",
        },
      ],
      categories: [{ id: 1, name: "General", slug: "general", ownerId: 1 }],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const row = target.db
        .query<{ title: string; notes: string | null }, []>(
          "SELECT title, notes FROM bookmarks"
        )
        .get();
      expect(row?.title).toBe("safetitle");
      expect(row?.notes).toBe("notebody");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("drops blank tags and falls back blank category names to slug/id", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "   ", slug: "fallback-slug", ownerId: 1, parentId: null },
      ],
      tags: [
        { id: 1, name: "   ", slug: "   ", ownerId: 1 },
        { id: 2, name: "keep-me", slug: "keep-me", ownerId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/blank-meta",
          title: "Blank meta",
          ownerId: 1,
          categoryId: 1,
          tagIds: [1, 2],
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/Dropped blank tag id=1/i);
      expect(summary.warnings.join("\n")).toMatch(/missing\/unowned tag id\(s\).*1/i);
      const cat = target.db
        .query<{ name: string }, []>("SELECT name FROM categories")
        .get();
      expect(cat?.name).toBe("fallback-slug");
      const tags = target.db
        .query<{ name: string }, []>("SELECT name FROM tags ORDER BY name")
        .all()
        .map((t) => t.name);
      expect(tags).toEqual(["keep-me"]);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("verifies bcrypt password hashes from older v0.5 installs", async () => {
    // bcrypt cost 4 keeps the test fast while still exercising Bun.password.verify.
    const bcryptHash = await Bun.password.hash("bcrypt-secret", {
      algorithm: "bcrypt",
      cost: 4,
    });
    const fixture = await makeDirtyFixture({
      users: [
        {
          id: 1,
          username: "bcrypt-user",
          email: "bcrypt@example.com",
          passwordHash: bcryptHash,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/bcrypt",
          title: "Bcrypt",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        {
          dataDir: fixture.dataDir,
          password: "bcrypt-secret",
          requirePassword: true,
        },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      await expect(
        migrateLegacyV05Source(
          {
            dataDir: fixture.dataDir,
            password: "wrong",
            requirePassword: true,
          },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/password/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("warns when nonempty legacy content_type has no 1.x target", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/article-type",
          title: "Typed",
          ownerId: 1,
          categoryId: 1,
          contentType: "article",
          importance: 2,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const joined = summary.warnings.join("\n");
      expect(joined).toMatch(/content_type=article/i);
      expect(joined).toMatch(/importance=2/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("preserves richer local open metrics when re-merging", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/opens",
          title: "Opens",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks
         SET opened_count = 42, is_pinned = 1, last_opened_at = '2025-01-01T00:00:00.000Z'
         WHERE url = 'https://example.com/opens'`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );

      const row = target.db
        .query<{ opened_count: number; is_pinned: number; last_opened_at: string | null }, []>(
          "SELECT opened_count, is_pinned, last_opened_at FROM bookmarks WHERE url = 'https://example.com/opens'"
        )
        .get();
      expect(row?.opened_count).toBe(42);
      expect(row?.is_pinned).toBe(1);
      expect(row?.last_opened_at).toBe("2025-01-01T00:00:00.000Z");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rejects empty user databases on apply", async () => {
    const fixture = await makeDirtyFixture({ users: [], categories: [], bookmarks: [] });
    const db = new Database(fixture.dbPath);
    db.exec("DELETE FROM bookmark; DELETE FROM category; DELETE FROM tag; DELETE FROM user;");
    db.close();
    const target = freshTarget();
    try {
      const inspect = inspectLegacyV05Source({ dataDir: fixture.dataDir });
      expect(inspect.totals.users).toBe(0);
      await expect(
        migrateLegacyV05Source(
          { dataDir: fixture.dataDir },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/no users/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("skips S3/remote storage_type media with an explicit warning", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/remote.png",
          ownerId: 1,
          writeBytes: TINY_PNG,
          storageType: "s3",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/s3-icon",
          title: "S3",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBe(1);
      expect(summary.warnings.some((w) => /remote storage_type=s3/i.test(w))).toBe(true);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports .ico favicons and skips SVG media", async () => {
    // Minimal but valid ICO header + 1x1 PNG payload is overkill; use a tiny
    // binary named .ico — detectMediaType maps .ico → image/x-icon.
    const icoBytes = Buffer.from([0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 32, 0, 0, 0]);
    const svgBytes = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      "utf8"
    );
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/fav.ico",
          ownerId: 1,
          writeBytes: icoBytes,
          mimeType: "image/x-icon",
        },
        {
          id: 2,
          relativePath: "1/vector.svg",
          ownerId: 1,
          writeBytes: svgBytes,
          mimeType: "image/svg+xml",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/ico",
          title: "ICO",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
        {
          id: 2,
          url: "https://example.com/svg",
          title: "SVG",
          ownerId: 1,
          categoryId: 1,
          iconId: 2,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);
      expect(summary.mediaImported).toBe(1);
      expect(summary.mediaSkipped).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("reads WAL-mode databases and rejects corrupt sqlite files safely", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/wal",
          title: "WAL",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const walDb = new Database(fixture.dbPath);
    walDb.exec("PRAGMA journal_mode=WAL;");
    walDb.run(
      `INSERT INTO bookmark (
        id, url, domain, title, description, author, content_text, content_html, content_type,
        content_published_date, note, main_image_url, main_image_id, icon_url, icon_id, screenshotId,
        importance, flagged, read, archived, owner_id, category_id, opened_last, opened_times, created, updated
      ) VALUES (2, 'https://example.com/wal-live', 'example.com', 'WAL live', NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1, NULL, 0, 1700000001, 1700000001)`
    );
    expect(existsSync(`${fixture.dbPath}-wal`)).toBe(true);

    const target = freshTarget();
    try {
      const inspect = inspectLegacyV05Source({ dataDir: fixture.dataDir });
      expect(inspect.totals.bookmarks).toBe(2);
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);
    } finally {
      walDb.close();
      target.db.close();
      rmSync(target.dataDir, { recursive: true, force: true });
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }

    const corruptDir = mkdtempSync(join(tmpdir(), "v05-corrupt-"));
    writeFileSync(join(corruptDir, "db.sqlite"), "this is not a sqlite database");
    try {
      expect(() => inspectLegacyV05Source({ dataDir: corruptDir })).toThrow();
    } finally {
      rmSync(corruptDir, { recursive: true, force: true });
    }
  });

  it("applies a mid-size library without failures and supports tar.bz2 / tar.xz archives", async () => {
    const bookmarks = Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      url: `https://example.com/item-${i}`,
      title: `Item ${i}`,
      ownerId: 1,
      categoryId: 1,
      note: i % 17 === 0 ? `note-${i}` : null,
    }));
    const fixture = await makeDirtyFixture({ bookmarks });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(120);
      expect(summary.bookmarksFailed).toBe(0);

      const parent = join(fixture.dataDir, "..");
      const basename = fixture.dataDir.split("/").pop()!;
      for (const [ext, args] of [
        [".tar.bz2", ["-cjf"]],
        [".tar.xz", ["-cJf"]],
      ] as const) {
        const archivePath = join(parent, `v05-${Date.now()}${ext}`);
        const tar = spawnSync("tar", [...args, archivePath, basename], {
          cwd: parent,
          encoding: "utf8",
        });
        expect(tar.status).toBe(0);

        const archiveTarget = freshTarget();
        try {
          const archived = await migrateLegacyV05Source(
            { archivePath, owner: "solo" },
            {
              db: archiveTarget.db,
              dataDir: archiveTarget.dataDir,
              enqueueIngest: false,
            }
          );
          expect(archived.bookmarksCreated).toBe(120);
        } finally {
          archiveTarget.db.close();
          rmSync(archiveTarget.dataDir, { recursive: true, force: true });
          rmSync(archivePath, { force: true });
        }
      }
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("fails safely on a real empty v0.5 data directory with leftover uploads", async () => {
    const realDataDir = "/Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire/data";
    if (!existsSync(join(realDataDir, "db.sqlite"))) return;

    const inspect = inspectLegacyV05Source({ dataDir: realDataDir });
    expect(inspect.source).toBe("grimoire-v05-sqlite");
    expect(inspect.totals.users).toBe(0);

    const target = freshTarget();
    try {
      await expect(
        migrateLegacyV05Source(
          { dataDir: realDataDir },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/no users/i);
    } finally {
      target.db.close();
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("treats drizzle timestamp-style flagged/disabled values as set", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        {
          id: 1,
          username: "ts-user",
          email: "ts@example.com",
          disabled: 1_700_000_100, // drizzle timestamp mode when disabled
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/flagged-ts",
          title: "Flagged",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    // Set flagged/read/archived to unix timestamps like real v0.5 drizzle rows
    const db = new Database(fixture.dbPath);
    db.run(
      `UPDATE bookmark SET flagged = ?, read = ?, archived = ? WHERE id = 1`,
      [1_700_000_200, 1_700_000_300, 1_700_000_400]
    );
    db.close();

    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.owner.disabled).toBe(true);
      expect(summary.warnings.some((w) => /disabled/i.test(w))).toBe(true);
      const row = target.db
        .query<{ is_pinned: number; is_archived: number; read_at: string | null }, []>(
          "SELECT is_pinned, is_archived, read_at FROM bookmarks"
        )
        .get();
      expect(row?.is_pinned).toBe(1);
      expect(row?.is_archived).toBe(1);
      expect(row?.read_at).toBeTruthy();
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("warns that other owners' libraries are not imported", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        { id: 1, username: "alice", email: "alice@example.com" },
        { id: 2, username: "bob", email: "bob@example.com" },
      ],
      categories: [
        { id: 1, name: "AliceCat", slug: "alice-cat", ownerId: 1 },
        { id: 2, name: "BobCat", slug: "bob-cat", ownerId: 2 },
      ],
      tags: [
        { id: 1, name: "alice-tag", slug: "alice-tag", ownerId: 1 },
        { id: 2, name: "bob-tag", slug: "bob-tag", ownerId: 2 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/alice",
          title: "Alice",
          ownerId: 1,
          categoryId: 1,
          tagIds: [1],
        },
        {
          id: 2,
          url: "https://example.com/bob",
          title: "Bob",
          ownerId: 2,
          categoryId: 2,
          tagIds: [2],
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir, owner: "alice" },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/Not importing other owners' data/i);
      expect(summary.warnings.join("\n")).toMatch(/1 bookmark/);
      const urls = target.db
        .query<{ url: string }, []>("SELECT url FROM bookmarks")
        .all()
        .map((r) => r.url);
      expect(urls).toEqual(["https://example.com/alice"]);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("skips cross-owner media file references", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        { id: 1, username: "alice", email: "alice@example.com" },
        { id: 2, username: "bob", email: "bob@example.com" },
      ],
      categories: [{ id: 1, name: "AliceCat", slug: "alice-cat", ownerId: 1 }],
      files: [
        {
          id: 10,
          relativePath: "2/bob-icon.png",
          ownerId: 2,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/cross-media",
          title: "Cross",
          ownerId: 1,
          categoryId: 1,
          iconId: 10,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir, owner: "alice" },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/belongs to another owner/i);
      const media = target.db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmark_media")
        .get()?.c;
      expect(media).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("preserves local archive when merging a non-archived legacy row", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-archive",
          title: "Keep",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(`UPDATE bookmarks SET is_archived = 1 WHERE url = 'https://example.com/keep-archive'`);

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ is_archived: number }, []>(
          "SELECT is_archived FROM bookmarks WHERE url = 'https://example.com/keep-archive'"
        )
        .get();
      expect(row?.is_archived).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("preserves local unarchive when merging an archived legacy row", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-unarchive",
          title: "Unarchived",
          ownerId: 1,
          categoryId: 1,
          archived: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks SET is_archived = 0 WHERE url = 'https://example.com/keep-unarchive'`
      );

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ is_archived: number }, []>(
          "SELECT is_archived FROM bookmarks WHERE url = 'https://example.com/keep-unarchive'"
        )
        .get();
      expect(row?.is_archived).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("preserves local unpin when merging a flagged legacy row", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-unpin",
          title: "Unpin",
          ownerId: 1,
          categoryId: 1,
          flagged: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(`UPDATE bookmarks SET is_pinned = 0 WHERE url = 'https://example.com/keep-unpin'`);

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ is_pinned: number }, []>(
          "SELECT is_pinned FROM bookmarks WHERE url = 'https://example.com/keep-unpin'"
        )
        .get();
      expect(row?.is_pinned).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("preserves local pin when merging an unflagged legacy row", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-pin",
          title: "Pin",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(`UPDATE bookmarks SET is_pinned = 1 WHERE url = 'https://example.com/keep-pin'`);

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ is_pinned: number }, []>(
          "SELECT is_pinned FROM bookmarks WHERE url = 'https://example.com/keep-pin'"
        )
        .get();
      expect(row?.is_pinned).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("does not clobber local favicon_url when merging legacy media", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/legacy-icon.png", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-favicon",
          title: "Fav",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks
         SET favicon_url = 'https://cdn.example/local-favicon.ico'
         WHERE url = 'https://example.com/keep-favicon'`
      );

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ favicon_url: string | null }, []>(
          "SELECT favicon_url FROM bookmarks WHERE url = 'https://example.com/keep-favicon'"
        )
        .get();
      expect(row?.favicon_url).toBe("https://cdn.example/local-favicon.ico");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("prefers curated local favicon over remote icon_url on fresh apply", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/curated.png", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/curated-favicon",
          title: "Curated",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
          iconUrl: "https://remote.example/icon.ico",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(1);
      const row = target.db
        .query<{ favicon_url: string | null }, []>(
          "SELECT favicon_url FROM bookmarks WHERE url = 'https://example.com/curated-favicon'"
        )
        .get();
      expect(row?.favicon_url).toMatch(/^\/media\/bookmarks\//);
      expect(row?.favicon_url).not.toContain("remote.example");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps remote icon_url when curated favicon media is soft-skipped", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/bad.svg",
          ownerId: 1,
          writeBytes: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
          mimeType: "image/svg+xml",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/remote-fallback",
          title: "Fallback",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
          iconUrl: "https://remote.example/fallback.ico",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBeGreaterThanOrEqual(1);
      const row = target.db
        .query<{ favicon_url: string | null }, []>(
          "SELECT favicon_url FROM bookmarks WHERE url = 'https://example.com/remote-fallback'"
        )
        .get();
      expect(row?.favicon_url).toBe("https://remote.example/fallback.ico");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rolls back a failed bookmark and cleans orphan media files", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/icon.png", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/fail-me",
          title: "Fail",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
        {
          id: 2,
          url: "https://example.com/ok-after",
          title: "Ok",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    const { BookmarkRepository } = await import("../db/bookmark-repository.js");
    const originalCreate = BookmarkRepository.prototype.create;
    let createCalls = 0;
    BookmarkRepository.prototype.create = function (
      this: InstanceType<typeof BookmarkRepository>,
      ...args: Parameters<typeof originalCreate>
    ) {
      createCalls += 1;
      if (createCalls === 1) throw new Error("injected disk full");
      return originalCreate.apply(this, args);
    };
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksFailed).toBe(1);
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/injected disk full/i);
      const urls = target.db
        .query<{ url: string }, []>("SELECT url FROM bookmarks ORDER BY url")
        .all()
        .map((r) => r.url);
      expect(urls).toEqual(["https://example.com/ok-after"]);
      const mediaCount = target.db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmark_media")
        .get()?.c;
      expect(mediaCount).toBe(0);
      // Orphan cache files from the failed bookmark should be removed.
      const cacheRoot = join(target.dataDir, "media-cache", "bookmarks");
      if (existsSync(cacheRoot)) {
        const listing = spawnSync("find", [cacheRoot, "-type", "f"], {
          encoding: "utf8",
        });
        expect((listing.stdout || "").trim()).toBe("");
      }
    } finally {
      BookmarkRepository.prototype.create = originalCreate;
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("does not inflate categoriesReused after a mid-run bookmark failure", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/cat-ok",
          title: "Ok",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 2,
          url: "https://example.com/cat-fail",
          title: "Fail",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 3,
          url: "https://example.com/cat-ok-2",
          title: "Ok2",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    const { BookmarkRepository } = await import("../db/bookmark-repository.js");
    const originalCreate = BookmarkRepository.prototype.create;
    let createCalls = 0;
    BookmarkRepository.prototype.create = function (
      this: InstanceType<typeof BookmarkRepository>,
      ...args: Parameters<typeof originalCreate>
    ) {
      createCalls += 1;
      if (createCalls === 2) throw new Error("injected fail after first success");
      return originalCreate.apply(this, args);
    };
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);
      expect(summary.bookmarksFailed).toBe(1);
      // One category created once; siblings should hit cache, not re-count as reused.
      expect(summary.categoriesCreated).toBe(1);
      expect(summary.categoriesReused).toBe(0);
      const cats = target.db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM categories")
        .get()?.c;
      expect(cats).toBe(1);
    } finally {
      BookmarkRepository.prototype.create = originalCreate;
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("clears urlIndex after rolled-back create so same-URL siblings still import", async () => {
    // Drive applyLegacyLibrary directly: normalize collapses exact URL dupes, but a
    // mid-bookmark rollback can still leave a phantom index entry within one apply.
    const { applyLegacyLibrary } = await import("../migrate/legacy-apply.js");
    const { BookmarkRepository } = await import("../db/bookmark-repository.js");
    const target = freshTarget();
    const originalSetTags = BookmarkRepository.prototype.setTags;
    let setTagsCalls = 0;
    BookmarkRepository.prototype.setTags = function (
      this: InstanceType<typeof BookmarkRepository>,
      ...args: Parameters<typeof originalSetTags>
    ) {
      setTagsCalls += 1;
      if (setTagsCalls === 1) throw new Error("injected setTags fail after index");
      return originalSetTags.apply(this, args);
    };

    const baseBookmark = {
      description: null as string | null,
      notes: null as string | null,
      author: null as string | null,
      contentText: null as string | null,
      contentHtml: null as string | null,
      publishedAt: null as string | null,
      categoryPath: [] as string[],
      isPinned: false,
      isArchived: false,
      readAt: null as string | null,
      openedCount: 0,
      lastOpenedAt: null as string | null,
      faviconUrl: null as string | null,
      mainImageUrl: null as string | null,
      createdAt: null as string | null,
      updatedAt: null as string | null,
      isPrivateHost: false,
      media: [] as [],
    };

    try {
      const summary = await applyLegacyLibrary(
        {
          owner: {
            id: "1",
            username: "alice",
            email: "alice@example.com",
            name: "Alice",
            bookmarkCount: 2,
            categoryCount: 0,
            tagCount: 0,
            disabled: false,
          },
          categories: [],
          tags: [],
          bookmarks: [
            {
              ...baseBookmark,
              sourceId: "1",
              url: "https://example.com/dup-url",
              title: "First",
              tags: ["shared"],
            },
            {
              ...baseBookmark,
              sourceId: "2",
              url: "https://example.com/dup-url",
              title: "Second",
              tags: ["shared"],
            },
          ],
          skippedBookmarks: [],
          warnings: [],
        },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(summary.bookmarksFailed).toBe(1);
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksMerged).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/injected setTags fail/i);
      const rows = target.db
        .query<{ url: string; title: string }, []>(
          "SELECT url, title FROM bookmarks ORDER BY title"
        )
        .all();
      expect(rows).toEqual([{ url: "https://example.com/dup-url", title: "Second" }]);
    } finally {
      BookmarkRepository.prototype.setTags = originalSetTags;
      target.db.close();
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("fails the bookmark when mergeImportDuplicate returns null instead of counting merge", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/merge-gone",
          title: "Incoming",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    const { BookmarkRepository } = await import("../db/bookmark-repository.js");
    const seeded = new BookmarkRepository(target.db, { dataDir: target.dataDir }).create(
      "https://example.com/merge-gone",
      "Local",
      null
    );
    const originalMerge = BookmarkRepository.prototype.mergeImportDuplicate;
    BookmarkRepository.prototype.mergeImportDuplicate = function () {
      return null;
    };
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false, mergeDuplicates: true }
      );
      expect(summary.bookmarksFailed).toBe(1);
      expect(summary.bookmarksMerged).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/Merge target disappeared/i);
      const still = target.db
        .query<{ id: string; title: string }, [string]>(
          "SELECT id, title FROM bookmarks WHERE id = ?"
        )
        .get(seeded.id);
      expect(still?.title).toBe("Local");
    } finally {
      BookmarkRepository.prototype.mergeImportDuplicate = originalMerge;
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports bookmarks when user-uploads is missing and warns about media", async () => {
    const fixture = await makeDirtyFixture({
      withUploads: false,
      files: [{ id: 1, relativePath: "1/icon.png", ownerId: 1, writeBytes: null }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/no-uploads",
          title: "No uploads",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    // Ensure uploads dir is truly absent
    rmSync(join(fixture.dataDir, "user-uploads"), { recursive: true, force: true });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/user-uploads\/ directory not found/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("trims whitespace around imported URLs", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "  https://example.com/trimmed  ",
          title: "Trimmed",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const row = target.db.query<{ url: string }, []>("SELECT url FROM bookmarks").get();
      expect(row?.url).toBe("https://example.com/trimmed");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports extensionless ICO bytes via magic-byte sniffing", async () => {
    const icoBytes = Buffer.from([0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 32, 0, 0, 0]);
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/uuid.com/aero-v1/sc/h/leaf",
          ownerId: 1,
          writeBytes: icoBytes,
          mimeType: "application/octet-stream",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/extensionless-ico",
          title: "Ext",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(1);
      const row = target.db
        .query<{ cache_path: string; media_type: string }, []>(
          "SELECT cache_path, media_type FROM bookmark_media"
        )
        .get();
      expect(row?.media_type).toBe("image/x-icon");
      expect(row?.cache_path.endsWith(".ico")).toBe(true);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("allows hardlinked media that stays under user-uploads", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/linked.png", ownerId: 1, writeBytes: null }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/hardlink",
          title: "HL",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const original = join(fixture.uploadsDir, "1/original.png");
    mkdirSync(join(original, ".."), { recursive: true });
    writeFileSync(original, TINY_PNG);
    const linked = join(fixture.uploadsDir, "1/linked.png");
    spawnSync("ln", [original, linked], { encoding: "utf8" });
    const src = new Database(fixture.dbPath);
    src.run(`UPDATE file SET size = ? WHERE id = 1`, [TINY_PNG.byteLength]);
    src.close();

    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("skips extension-trusted non-image files (hardlink / renamed payload)", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/secret.png", ownerId: 1, writeBytes: null }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/fake-png",
          title: "Fake",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const outside = join(fixture.dataDir, "outside-secret.txt");
    writeFileSync(outside, "not-an-image-payload");
    const linked = join(fixture.uploadsDir, "1/secret.png");
    mkdirSync(join(linked, ".."), { recursive: true });
    linkSync(outside, linked);

    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/unsupported media type/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("does not archive an existing local category when reusing a legacy archived category", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "Shared", slug: "shared", ownerId: 1, archived: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/shared-cat",
          title: "Shared",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      target.db.run(
        `INSERT INTO categories (id, name, parent_id, is_archived, is_public)
         VALUES ('local-shared', 'Shared', NULL, 0, 0)`
      );

      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.categoriesReused).toBeGreaterThanOrEqual(1);

      const row = target.db
        .query<{ is_archived: number }, []>(
          "SELECT is_archived FROM categories WHERE name = 'Shared'"
        )
        .get();
      expect(row?.is_archived).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rejects ambiguous owner queries and empty password hashes", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        { id: 1, username: "alice", email: "shared@example.com" },
        { id: 2, username: "shared@example.com", email: "bob@example.com" },
      ],
      categories: [
        { id: 1, name: "A", slug: "a", ownerId: 1 },
        { id: 2, name: "B", slug: "b", ownerId: 2 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/a",
          title: "A",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 2,
          url: "https://example.com/b",
          title: "B",
          ownerId: 2,
          categoryId: 2,
        },
      ],
    });
    const target = freshTarget();
    try {
      await expect(
        migrateLegacyV05Source(
          { dataDir: fixture.dataDir, owner: "shared@example.com" },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/matched multiple users/i);

      const src = new Database(fixture.dbPath);
      src.run(`UPDATE user SET password_hash = '' WHERE id = 1`);
      src.close();
      await expect(
        migrateLegacyV05Source(
          {
            dataDir: fixture.dataDir,
            owner: "alice",
            password: "anything",
            requirePassword: true,
          },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/no password hash/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("applies cyclic categories without hanging and keeps a finite path", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "A", slug: "a", ownerId: 1, parentId: 2 },
        { id: 2, name: "B", slug: "b", ownerId: 1, parentId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/cycle-apply",
          title: "Cycle",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksFailed).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/cycle/i);
      const cats = target.db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM categories")
        .get()?.c;
      expect(cats).toBeGreaterThan(0);
      // Cycle break can emit two truncated orderings (A→B and B→A), each up to 2 nodes.
      expect(cats!).toBeLessThanOrEqual(4);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("skips zero-byte media while still creating the bookmark", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/empty.png",
          ownerId: 1,
          writeBytes: Buffer.alloc(0),
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/zero-byte",
          title: "Zero",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBeGreaterThan(0);
      expect(summary.warnings.join("\n")).toMatch(/size 0/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("dry-run after apply does not re-count already imported media as imports", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/icon.png", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/dry-media",
          title: "Dry",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const applied = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(applied.mediaImported).toBe(1);

      const drySkip = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, dryRun: true, enqueueIngest: false }
      );
      expect(drySkip.bookmarksSkipped).toBe(1);
      expect(drySkip.mediaImported).toBe(0);

      const dryMerge = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          dryRun: true,
          mergeDuplicates: true,
          enqueueIngest: false,
        }
      );
      expect(dryMerge.bookmarksMerged).toBe(1);
      expect(dryMerge.mediaImported).toBe(0);
      expect(dryMerge.mediaSkipped).toBeGreaterThan(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("legacyMediaSourceUrl is stable across remounted absolute upload paths", () => {
    const base = {
      kind: "favicon" as const,
      filename: "icon.png",
      sourceUrl: null,
      declaredMimeType: "image/png",
      stableKey: "1/icon.png",
    };
    const a = legacyMediaSourceUrl(
      { sourceId: "42" },
      { ...base, absolutePath: "/tmp/extract-a/user-uploads/1/icon.png" }
    );
    const b = legacyMediaSourceUrl(
      { sourceId: "42" },
      { ...base, absolutePath: "/var/folders/xy/extract-b/user-uploads/1/icon.png" }
    );
    expect(a).toBe(b);
    expect(a).toContain("legacy://42/favicon/");
  });

  it("--merge after copying the v0.5 data-dir does not duplicate media", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/icon.png", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/remount-media",
          title: "Remount",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const remounted = mkdtempSync(join(tmpdir(), "v05-remount-"));
    const target = freshTarget();
    try {
      const first = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(first.mediaImported).toBe(1);

      cpSync(fixture.dataDir, remounted, { recursive: true });
      const merged = await migrateLegacyV05Source(
        { dataDir: remounted },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      expect(merged.mediaImported).toBe(0);
      const mediaCount = target.db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmark_media")
        .get()?.c;
      expect(mediaCount).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(remounted, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("dry-run does not count unreadable media as importable (matches apply skip)", async () => {
    const fixture = await makeDirtyFixture({
      files: [{ id: 1, relativePath: "1/locked.png", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/locked-media",
          title: "Locked",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const mediaPath = join(fixture.dataDir, "user-uploads", "1", "locked.png");
    chmodSync(mediaPath, 0o000);
    const target = freshTarget();
    try {
      const dry = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, dryRun: true, enqueueIngest: false }
      );
      expect(dry.bookmarksCreated).toBe(1);
      expect(dry.mediaImported).toBe(0);
      expect(dry.mediaSkipped).toBeGreaterThan(0);

      const applied = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(applied.bookmarksCreated).toBe(1);
      expect(applied.mediaImported).toBe(0);
      expect(applied.mediaSkipped).toBeGreaterThan(0);
    } finally {
      try {
        chmodSync(mediaPath, 0o644);
      } catch {
        // best-effort cleanup
      }
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("dry-run counts AVIF with late brand the same as apply", async () => {
    // ftyp at 4; filler brands through offset 28; 'avif' only at offset 32.
    // A 32-byte dry-run sniff misses it; apply's 64-byte window catches it.
    const avif = Buffer.alloc(48, 0);
    avif.writeUInt32BE(48, 0);
    avif.write("ftyp", 4);
    avif.write("isom", 8);
    avif.write("iso2", 12);
    avif.write("mp41", 16);
    avif.write("mif1", 20);
    avif.write("miaf", 24);
    avif.write("HEIC", 28); // not avif — forces late brand
    avif.write("avif", 32);

    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/late-brand.bin",
          ownerId: 1,
          writeBytes: avif,
          mimeType: "application/octet-stream",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/late-avif",
          title: "Late AVIF",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const dry = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, dryRun: true, enqueueIngest: false }
      );
      expect(dry.mediaImported).toBe(1);
      expect(dry.mediaSkipped).toBe(0);

      const applied = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(applied.mediaImported).toBe(1);
      expect(applied.mediaSkipped).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("soft-skips media when the cache directory is not writable", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        { id: 1, relativePath: "1/good.png", ownerId: 1 },
        { id: 2, relativePath: "1/also.png", ownerId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/media-io",
          title: "Media IO",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const srcDb = new Database(fixture.dbPath);
    srcDb.run(`UPDATE bookmark SET main_image_id = 2 WHERE id = 1`);
    srcDb.close();

    const target = freshTarget();
    const cacheRoot = join(target.dataDir, "media-cache");
    mkdirSync(cacheRoot, { recursive: true });
    chmodSync(cacheRoot, 0o555);
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksFailed).toBe(0);
      expect(summary.mediaImported).toBe(0);
      expect(summary.mediaSkipped).toBeGreaterThanOrEqual(2);
      expect(summary.warnings.join("\n")).toMatch(/media import failed/i);
      expect(
        target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks").get()?.c
      ).toBe(1);
    } finally {
      chmodSync(cacheRoot, 0o755);
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("dry-run does not count categories/tags for skipped existing URLs", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "SkipCat", slug: "skip-cat", ownerId: 1 },
        { id: 2, name: "OnlyOnSkip", slug: "only-on-skip", ownerId: 1, parentId: 1 },
      ],
      tags: [{ id: 1, name: "skip-tag", slug: "skip-tag", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/already-here",
          title: "Already",
          ownerId: 1,
          categoryId: 2,
          tagIds: [1],
        },
      ],
    });
    const target = freshTarget();
    try {
      // Seed a local row with the same URL but no categories/tags from legacy path.
      await migrateLegacyV05Source(
        {
          dataDir: fixture.dataDir,
        },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      // Wipe taxonomy so a buggy dry-run would re-plan creates.
      target.db.run("DELETE FROM bookmark_tags");
      target.db.run("DELETE FROM tags");
      target.db.run("UPDATE bookmarks SET category_id = NULL");
      target.db.run("DELETE FROM categories");

      const dry = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, dryRun: true, enqueueIngest: false }
      );
      expect(dry.bookmarksSkipped).toBe(1);
      expect(dry.bookmarksCreated).toBe(0);
      expect(dry.categoriesCreated).toBe(0);
      expect(dry.tagsCreated).toBe(0);

      const applied = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(applied.bookmarksSkipped).toBe(1);
      expect(applied.categoriesCreated).toBe(0);
      expect(applied.tagsCreated).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("round-trips category metadata and large notes/content", async () => {
    const bigNote = "N".repeat(50_000);
    const bigHtml = `<article>${"p".repeat(20_000)}</article>`;
    const fixture = await makeDirtyFixture({
      categories: [
        {
          id: 1,
          name: "Styled",
          slug: "styled",
          ownerId: 1,
          description: "Legacy description",
          color: "#112233",
          icon: "folder",
          archived: 1,
          public: 1,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/big-content",
          title: "Big",
          ownerId: 1,
          categoryId: 1,
          note: bigNote,
          description: "desc",
          contentHtml: bigHtml,
          contentText: "plain ".repeat(5_000),
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const cat = target.db
        .query<
          {
            color: string | null;
            icon: string | null;
            description: string | null;
            is_archived: number;
            is_public: number;
          },
          []
        >(
          "SELECT color, icon, description, is_archived, is_public FROM categories WHERE name = 'Styled'"
        )
        .get();
      expect(cat).toMatchObject({
        color: "#112233",
        icon: "folder",
        description: "Legacy description",
        is_archived: 1,
        is_public: 1,
      });
      const bm = target.db
        .query<{ notes: string | null; description: string | null }, []>(
          "SELECT notes, description FROM bookmarks"
        )
        .get();
      expect(bm?.notes?.length).toBe(50_000);
      expect(bm?.description).toBe("desc");
      const content = target.db
        .query<{ raw_html: string | null; markdown: string | null }, []>(
          "SELECT raw_html, markdown FROM bookmark_content"
        )
        .get();
      expect(content?.raw_html?.length).toBe(bigHtml.length);
      expect((content?.markdown?.length ?? 0) > 10_000).toBe(true);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("prefers data/db.sqlite when an archive tree contains multiple db.sqlite files", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-multi-db-"));
    try {
      mkdirSync(join(root, "data"), { recursive: true });
      writeFileSync(join(root, "db.sqlite"), "not-a-db");
      writeFileSync(join(root, "data", "db.sqlite"), "preferred");
      const chosen = findDbSqliteInTree(root);
      expect(chosen.endsWith("/data/db.sqlite")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("finds deep data/db.sqlite instead of a shallow decoy outside data/", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-deep-db-"));
    try {
      writeFileSync(join(root, "db.sqlite"), "decoy");
      let cur = root;
      for (const part of ["a", "b", "c", "d", "e", "f", "g", "data"]) {
        cur = join(cur, part);
        mkdirSync(cur);
      }
      writeFileSync(join(cur, "db.sqlite"), "real");
      const chosen = findDbSqliteInTree(root);
      expect(chosen).toBe(join(cur, "db.sqlite"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prefers the shallowest data/db.sqlite when several exist", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-multi-data-db-"));
    try {
      mkdirSync(join(root, "nested", "data"), { recursive: true });
      mkdirSync(join(root, "data"), { recursive: true });
      writeFileSync(join(root, "nested", "data", "db.sqlite"), "deep");
      writeFileSync(join(root, "data", "db.sqlite"), "shallow");
      const chosen = findDbSqliteInTree(root);
      expect(chosen).toBe(join(root, "data", "db.sqlite"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves legacy created_at/updated_at through the bookmarks trigger", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/timestamps",
          title: "Ts",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const src = new Database(fixture.dbPath);
    src.run(`UPDATE bookmark SET created = ?, updated = ? WHERE id = 1`, [
      1_600_000_000,
      1_650_000_000,
    ]);
    src.close();
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      const row = target.db
        .query<{ created_at: string; updated_at: string }, []>(
          "SELECT created_at, updated_at FROM bookmarks"
        )
        .get();
      expect(Date.parse(row!.created_at)).toBe(1_600_000_000 * 1000);
      expect(Date.parse(row!.updated_at)).toBe(1_650_000_000 * 1000);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("on --merge takes older created_at and newer updated_at", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/merge-ts",
          title: "MergeTs",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const src = new Database(fixture.dbPath);
    // Legacy: created 2020, updated 2024
    src.run(`UPDATE bookmark SET created = ?, updated = ? WHERE id = 1`, [
      1_577_836_800,
      1_704_067_200,
    ]);
    src.close();

    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      // Bypass auto-touch trigger so we can plant older/newer local timestamps.
      target.db.exec("DROP TRIGGER IF EXISTS trg_bookmarks_updated_at");
      target.db.run(
        `UPDATE bookmarks
         SET created_at = '2022-01-01T00:00:00.000Z',
             updated_at = '2021-01-01T00:00:00.000Z'
         WHERE url = 'https://example.com/merge-ts'`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      const row = target.db
        .query<{ created_at: string; updated_at: string }, []>(
          "SELECT created_at, updated_at FROM bookmarks WHERE url = 'https://example.com/merge-ts'"
        )
        .get();
      // Older created (legacy 2020) wins; newer updated (legacy 2024) wins
      expect(Date.parse(row!.created_at)).toBe(1_577_836_800 * 1000);
      expect(Date.parse(row!.updated_at)).toBe(1_704_067_200 * 1000);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps richer local description and content when merging", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-local",
          title: "Keep",
          ownerId: 1,
          categoryId: 1,
          description: "legacy-desc",
          contentHtml: "<p>legacy</p>",
          contentText: "legacy-md",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks SET description = 'local-rich-description' WHERE url = 'https://example.com/keep-local'`
      );
      target.db.run(
        `UPDATE bookmark_content SET raw_html = '<p>local-rich</p>', markdown = 'local-rich-md'`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      const bm = target.db
        .query<{ description: string | null }, []>("SELECT description FROM bookmarks")
        .get();
      expect(bm?.description).toBe("local-rich-description");
      const content = target.db
        .query<{ raw_html: string | null; markdown: string | null }, []>(
          "SELECT raw_html, markdown FROM bookmark_content"
        )
        .get();
      expect(content?.raw_html).toBe("<p>local-rich</p>");
      expect(content?.markdown).toBe("local-rich-md");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("replaces extract-failure URL-stub content with legacy HTML on --merge", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/stub-content",
          title: "Legacy Article",
          ownerId: 1,
          categoryId: 1,
          contentHtml: "<article><p>uniquelegacystubfill body from v05</p></article>",
          contentText: "uniquelegacystubfill body from v05",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      // Simulate pipeline extract-failure stub: markdown = url, error-page raw_html.
      target.db.run(
        `UPDATE bookmark_content
         SET raw_html = '<html><body>error page</body></html>',
             markdown = 'https://example.com/stub-content'
         WHERE bookmark_id = (SELECT id FROM bookmarks WHERE url = 'https://example.com/stub-content')`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      const content = target.db
        .query<{ raw_html: string | null; markdown: string | null }, []>(
          "SELECT raw_html, markdown FROM bookmark_content"
        )
        .get();
      expect(content?.markdown).toContain("uniquelegacystubfill");
      expect(content?.raw_html).toContain("uniquelegacystubfill");
      expect(content?.raw_html).not.toContain("error page");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("replaces extract-failure title-stub content with legacy HTML on --merge", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/title-stub-content",
          title: "Imported Title",
          ownerId: 1,
          categoryId: 1,
          contentHtml: "<article><p>uniquetitlestubfill body from v05</p></article>",
          contentText: "uniquetitlestubfill body from v05",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      // Pipeline extract-failure with a real title stores markdown = title.
      target.db.run(
        `UPDATE bookmark_content
         SET raw_html = '<html><body>error page</body></html>',
             markdown = 'Imported Title'
         WHERE bookmark_id = (
           SELECT id FROM bookmarks WHERE url = 'https://example.com/title-stub-content'
         )`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      const content = target.db
        .query<{ raw_html: string | null; markdown: string | null }, []>(
          "SELECT raw_html, markdown FROM bookmark_content"
        )
        .get();
      expect(content?.markdown).toContain("uniquetitlestubfill");
      expect(content?.raw_html).toContain("uniquetitlestubfill");
      expect(content?.raw_html).not.toContain("error page");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("fills blank local description from legacy on --merge", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/fill-blank-desc",
          title: "Fill",
          ownerId: 1,
          categoryId: 1,
          description: "legacy-filled-description",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks SET description = '   ' WHERE url = 'https://example.com/fill-blank-desc'`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      const bm = target.db
        .query<{ description: string | null }, []>("SELECT description FROM bookmarks")
        .get();
      expect(bm?.description).toBe("legacy-filled-description");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps existing bookmark_content.summary searchable across --merge content upsert", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-summary-fts",
          title: "Summary",
          ownerId: 1,
          categoryId: 1,
          description: "legacydescmergefts",
          contentText: "legacy body markdown",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmark_content SET summary = 'llmsummarymergefts token' WHERE bookmark_id = (
           SELECT id FROM bookmarks WHERE url = 'https://example.com/keep-summary-fts'
         )`
      );
      // Seed FTS as post-enrich index would.
      const id = target.db
        .query<{ id: string }, []>(
          "SELECT id FROM bookmarks WHERE url = 'https://example.com/keep-summary-fts'"
        )
        .get()!.id;
      target.db.run(`DELETE FROM bookmarks_fts WHERE bookmark_id = ?`, [id]);
      target.db.run(
        `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
         VALUES (?, 'Summary', 'legacydescmergefts llmsummarymergefts token', '', 'legacy body markdown')`,
        [id]
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );

      const fts = target.db
        .query<{ summary: string | null }, [string]>(
          "SELECT summary FROM bookmarks_fts WHERE bookmark_id = ?"
        )
        .get(id);
      expect(fts?.summary).toContain("legacydescmergefts");
      expect(fts?.summary).toContain("llmsummarymergefts");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("warns when a category parent is missing or owned by another user", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        { id: 1, username: "alice", email: "alice@example.com" },
        { id: 2, username: "bob", email: "bob@example.com" },
      ],
      categories: [
        { id: 10, name: "BobParent", slug: "bob-parent", ownerId: 2 },
        { id: 1, name: "AliceChild", slug: "alice-child", ownerId: 1, parentId: 10 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/cross-parent",
          title: "X",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir, owner: "alice" },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/Category parent 10 missing\/unowned/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps local category and newer read_at on --merge", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "Legacy", slug: "legacy", ownerId: 1 },
        { id: 2, name: "Other", slug: "other", ownerId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/reorg",
          title: "Reorg",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );

      const localCat = target.db
        .query<{ id: string }, []>(
          "INSERT INTO categories (id, name, parent_id) VALUES ('local-cat', 'Local', NULL) RETURNING id"
        )
        .get();
      target.db.run(
        `UPDATE bookmarks
         SET category_id = ?, read_at = '2026-06-01T00:00:00.000Z'
         WHERE url = 'https://example.com/reorg'`,
        [localCat!.id]
      );

      // Legacy read is older unix than local ISO above.
      const src = new Database(join(fixture.dataDir, "db.sqlite"));
      src.run(`UPDATE bookmark SET read = ? WHERE id = 1`, [1_700_000_000]);
      src.close();

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );

      const row = target.db
        .query<{ category_id: string | null; read_at: string | null }, []>(
          "SELECT category_id, read_at FROM bookmarks WHERE url = 'https://example.com/reorg'"
        )
        .get();
      expect(row?.category_id).toBe(localCat!.id);
      expect(row?.read_at).toBe("2026-06-01T00:00:00.000Z");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("does not create orphan legacy categories when --merge keeps local category", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "OrphanRoot", slug: "orphan-root", ownerId: 1 },
        {
          id: 2,
          name: "OrphanLeaf",
          slug: "orphan-leaf",
          ownerId: 1,
          parentId: 1,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/keep-local-cat",
          title: "Keep Local Cat",
          ownerId: 1,
          categoryId: 2,
          note: "from-legacy",
        },
      ],
    });
    const target = freshTarget();
    try {
      target.db.run(
        `INSERT INTO categories (id, name, parent_id) VALUES ('local-keep', 'Local Keep', NULL)`
      );
      target.db.run(
        `INSERT INTO bookmarks (id, url, domain, title, status, category_id, notes, is_pinned, is_archived, is_trashed)
         VALUES ('local-bm', 'https://example.com/keep-local-cat', 'example.com', 'Local', 'saved',
                 'local-keep', 'local-note', 0, 0, 0)`
      );

      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );

      expect(summary.bookmarksMerged).toBe(1);
      expect(summary.categoriesCreated).toBe(0);
      expect(
        target.db
          .query<{ c: number }, []>(
            `SELECT COUNT(*) AS c FROM categories
             WHERE lower(name) IN ('orphanroot', 'orphanleaf')`
          )
          .get()?.c
      ).toBe(0);
      const row = target.db
        .query<{ category_id: string | null; notes: string | null }, []>(
          "SELECT category_id, notes FROM bookmarks WHERE id = 'local-bm'"
        )
        .get();
      expect(row?.category_id).toBe("local-keep");
      expect(row?.notes).toContain("local-note");
      expect(row?.notes).toContain("from-legacy");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("restores trg_bookmarks_updated_at after apply", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/trigger",
          title: "Trigger",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      const trigger = target.db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_bookmarks_updated_at'"
        )
        .get();
      expect(trigger?.name).toBe("trg_bookmarks_updated_at");

      // Body must auto-touch updated_at again (not a leftover no-op / missing trigger).
      target.db.run(
        `UPDATE bookmarks
         SET title = 'Touched', updated_at = '2000-01-01T00:00:00.000Z'
         WHERE url = 'https://example.com/trigger'`
      );
      const row = target.db
        .query<{ updated_at: string }, []>(
          "SELECT updated_at FROM bookmarks WHERE url = 'https://example.com/trigger'"
        )
        .get();
      expect(row?.updated_at).not.toBe("2000-01-01T00:00:00.000Z");
      expect(row?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("repairs a missing updated_at trigger when apply fails before commit", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/trigger-repair",
          title: "Trigger repair",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    const originalExec = target.db.exec.bind(target.db);
    let dropAttempts = 0;
    target.db.exec("DROP TRIGGER IF EXISTS trg_bookmarks_updated_at");
    target.db.exec = ((sql: string) => {
      if (/DROP TRIGGER IF EXISTS trg_bookmarks_updated_at/i.test(sql) && dropAttempts++ === 0) {
        throw new Error("injected trigger drop failure");
      }
      return originalExec(sql);
    }) as typeof target.db.exec;
    try {
      await expect(
        migrateLegacyV05Source(
          { dataDir: fixture.dataDir },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/injected trigger drop failure/i);

      const trigger = target.db
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_bookmarks_updated_at'"
        )
        .get();
      expect(trigger?.name).toBe("trg_bookmarks_updated_at");
    } finally {
      target.db.exec = originalExec;
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("does not import non-image bytes just because declared mime-type is image/png", async () => {
    // Declared mime alone must not override a failed magic-byte sniff (hardlink / rename attack).
    const opaque = Buffer.from("not-an-image-but-declared-png");
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/noext",
          ownerId: 1,
          writeBytes: opaque,
          mimeType: "image/png",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/declared-mime",
          title: "Mime",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(0);
      expect(summary.warnings.join("\n")).toMatch(/unsupported media type/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports extensionless real PNG via magic-byte sniff", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        {
          id: 1,
          relativePath: "1/noext",
          ownerId: 1,
          writeBytes: TINY_PNG,
          mimeType: "application/octet-stream",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/sniff-png",
          title: "Sniff",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.mediaImported).toBe(1);
      const row = target.db
        .query<{ media_type: string }, []>("SELECT media_type FROM bookmark_media")
        .get();
      expect(row?.media_type).toBe("image/png");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("enqueues ingest with preserveExistingContent for migrated bookmarks", async () => {
    const { JobQueue } = await import("../queue.js");
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/preserve-ingest",
          title: "Preserve",
          ownerId: 1,
          categoryId: 1,
          contentHtml: "<p>legacy html</p>",
          contentText: "legacy text",
          description: "legacy description",
        },
      ],
    });
    const target = freshTarget();
    const queue = new JobQueue(target.db);
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, queue, enqueueIngest: true }
      );
      expect(summary.bookmarksCreated).toBe(1);

      const job = target.db
        .query<{ payload: string }, []>(
          "SELECT payload FROM jobs WHERE type = 'ingest' ORDER BY created_at DESC LIMIT 1"
        )
        .get();
      expect(job).toBeTruthy();
      const payload = JSON.parse(job!.payload) as {
        preserveExistingContent?: boolean;
        bookmarkId: string;
      };
      expect(payload.preserveExistingContent).toBe(true);

      const content = target.db
        .query<{ raw_html: string | null; markdown: string | null }, []>(
          "SELECT raw_html, markdown FROM bookmark_content"
        )
        .get();
      expect(content?.raw_html).toBe("<p>legacy html</p>");
      expect(content?.markdown).toBe("legacy text");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("fills blank local category metadata when reusing a same-name category", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        {
          id: 1,
          name: "Work",
          slug: "work",
          ownerId: 1,
          color: "#abcdef",
          icon: "briefcase",
          description: "From legacy",
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/work-bm",
          title: "W",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      target.db.run(
        `INSERT INTO categories (id, name, parent_id, color, icon, description)
         VALUES ('pre', 'Work', NULL, NULL, NULL, NULL)`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );

      const cat = target.db
        .query<{ color: string | null; icon: string | null; description: string | null }, []>(
          "SELECT color, icon, description FROM categories WHERE name = 'Work'"
        )
        .get();
      expect(cat?.color).toBe("#abcdef");
      expect(cat?.icon).toBe("briefcase");
      expect(cat?.description).toBe("From legacy");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("converts unix content_published_date and collapses host-case duplicate URLs", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://Example.com/Article",
          title: "A",
          ownerId: 1,
          categoryId: 1,
          contentPublishedDate: "1700000000",
          note: "first",
        },
        {
          id: 2,
          url: "https://example.com/Article",
          title: "B",
          ownerId: 1,
          categoryId: 1,
          note: "second",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/Merged duplicate URL/i);

      const content = target.db
        .query<{ published_at: string | null }, []>(
          "SELECT published_at FROM bookmark_content"
        )
        .get();
      expect(content?.published_at).toBe(new Date(1_700_000_000 * 1000).toISOString());

      const notes = target.db
        .query<{ notes: string | null }, []>("SELECT notes FROM bookmarks")
        .get();
      expect(notes?.notes).toMatch(/first/);
      expect(notes?.notes).toMatch(/second/);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("warns on remote-only favicon/main image URLs without local files", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/remote-media",
          title: "Remote",
          ownerId: 1,
          categoryId: 1,
          iconUrl: "https://cdn.example.com/icon.png",
          mainImageUrl: "https://cdn.example.com/cover.jpg",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.warnings.join("\n")).toMatch(/Remote-only favicon URL/i);
      expect(summary.warnings.join("\n")).toMatch(/Remote-only main_image_url/i);
      const row = target.db
        .query<{ favicon_url: string | null }, []>("SELECT favicon_url FROM bookmarks")
        .get();
      expect(row?.favicon_url).toBe("https://cdn.example.com/icon.png");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rejects archives whose extracted symlink escapes the tree", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-evil-archive-"));
    try {
      const payload = join(root, "payload");
      mkdirSync(payload, { recursive: true });
      writeFileSync(join(payload, "db.sqlite"), "not-a-real-db");
      symlinkSync("/etc/passwd", join(payload, "escape-link"));
      const archivePath = join(root, "evil.tar");
      const tar = spawnSync("tar", ["-cf", archivePath, "-C", payload, "."], {
        encoding: "utf8",
      });
      expect(tar.status).toBe(0);
      expect(() => extractLegacyArchive(archivePath)).toThrow(/contains a symlink/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects archives that contain hardlinked files", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-hardlink-archive-"));
    try {
      const payload = join(root, "payload");
      mkdirSync(payload, { recursive: true });
      writeFileSync(join(payload, "db.sqlite"), "not-a-real-db");
      writeFileSync(join(payload, "a.bin"), "shared");
      linkSync(join(payload, "a.bin"), join(payload, "b.bin"));
      const archivePath = join(root, "hardlink.tar");
      const tar = spawnSync("tar", ["-cf", archivePath, "-C", payload, "."], {
        encoding: "utf8",
      });
      expect(tar.status).toBe(0);
      expect(() => extractLegacyArchive(archivePath)).toThrow(/hardlink/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("assertExtractTreeSafe refuses trees deeper than maxDepth", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-deep-tree-"));
    try {
      let cur = root;
      for (let i = 0; i < 5; i += 1) {
        cur = join(cur, `d${i}`);
        mkdirSync(cur);
      }
      writeFileSync(join(cur, "leaf.bin"), "x");
      expect(() => assertExtractTreeSafe(root, 3)).toThrow(/maximum directory depth/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("assertExtractTreeSafe refuses unreadable directories", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-unreadable-tree-"));
    const locked = join(root, "locked");
    try {
      mkdirSync(locked);
      writeFileSync(join(locked, "hidden.bin"), "secret");
      chmodSync(locked, 0o000);
      expect(() => assertExtractTreeSafe(root)).toThrow(/Cannot read extracted archive directory/i);
    } finally {
      try {
        chmodSync(locked, 0o755);
      } catch {
        // best-effort
      }
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not create orphan categories/tags when every bookmark URL is skipped", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "OrphanCat", slug: "orphan-cat", ownerId: 1 },
        { id: 2, name: "Unused", slug: "unused", ownerId: 1 },
      ],
      tags: [{ id: 1, name: "orphan-tag", slug: "orphan-tag", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "javascript:alert(1)",
          title: "JS",
          ownerId: 1,
          categoryId: 1,
          tagIds: [1],
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(0);
      expect(summary.bookmarksSkipped).toBeGreaterThanOrEqual(1);
      expect(summary.categoriesCreated).toBe(0);
      expect(summary.tagsCreated).toBe(0);
      expect(
        target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM categories").get()?.c
      ).toBe(0);
      expect(target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM tags").get()?.c).toBe(
        0
      );
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rejects blank/whitespace owner queries on multi-user databases", async () => {
    const fixture = await makeDirtyFixture({
      users: [
        { id: 1, username: "alice", email: "alice@example.com" },
        { id: 2, username: "bob", email: "bob@example.com" },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/a",
          title: "A",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    try {
      expect(() => findLegacyOwner(
        {
          users: [
            {
              id: 1,
              name: "A",
              username: "alice",
              email: "alice@example.com",
              passwordHash: "x",
              verified: true,
              disabled: null,
              isAdmin: false,
              created: 0,
              updated: 0,
            },
            {
              id: 2,
              name: "B",
              username: "bob",
              email: "bob@example.com",
              passwordHash: "x",
              verified: true,
              disabled: null,
              isAdmin: false,
              created: 0,
              updated: 0,
            },
          ],
          categories: [],
          tags: [],
          bookmarks: [],
          files: new Map(),
          uploadsDir: null,
          dbPath: fixture.dbPath,
        },
        "   "
      )).toThrow(/multiple users/i);
    } finally {
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }
  });

  it("survives category slug collisions and prefers real titles on URL duplicates", async () => {
    const fixture = await makeDirtyFixture({
      categories: [
        { id: 1, name: "Alpha", slug: "shared", ownerId: 1 },
        { id: 2, name: "Beta", slug: "shared", ownerId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/dup-title",
          title: "https://example.com/dup-title",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 2,
          url: "https://example.com/dup-title",
          title: "Real Title",
          ownerId: 1,
          categoryId: 2,
        },
      ],
    });
    const target = freshTarget();
    try {
      // Pre-seed a conflicting slug from another category name.
      target.db.run(
        `INSERT INTO categories (id, name, parent_id, slug) VALUES ('x', 'Other', NULL, 'shared')`
      );

      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksFailed).toBe(0);
      const row = target.db
        .query<{ title: string }, []>("SELECT title FROM bookmarks")
        .get();
      expect(row?.title).toBe("Real Title");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("fills URL-stub local titles when --merge brings a real title", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/fill-title",
          title: "Proper Legacy Title",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks SET title = url WHERE url = 'https://example.com/fill-title'`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );

      const row = target.db
        .query<{ title: string }, []>(
          "SELECT title FROM bookmarks WHERE url = 'https://example.com/fill-title'"
        )
        .get();
      expect(row?.title).toBe("Proper Legacy Title");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("warns on http/https near-duplicate URLs without merging them", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/twin",
          title: "HTTPS",
          ownerId: 1,
          categoryId: 1,
        },
        {
          id: 2,
          url: "http://example.com/twin",
          title: "HTTP",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(2);
      expect(summary.warnings.join("\n")).toMatch(/Near-duplicate URLs/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps the first real title when merging duplicate URLs", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/title-order",
          title: "Original Title",
          ownerId: 1,
          categoryId: 1,
          note: "first",
        },
        {
          id: 2,
          url: "https://example.com/title-order",
          title: "A Much Longer Duplicate Title",
          ownerId: 1,
          categoryId: 1,
          note: "second",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const row = target.db
        .query<{ title: string; notes: string | null }, []>(
          "SELECT title, notes FROM bookmarks WHERE url = 'https://example.com/title-order'"
        )
        .get();
      expect(row?.title).toBe("Original Title");
      expect(row?.notes).toMatch(/first/);
      expect(row?.notes).toMatch(/second/);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps both same-filename media files when collapsing duplicate URLs", async () => {
    const fixture = await makeDirtyFixture({
      files: [
        { id: 1, relativePath: "1/a/icon.ico", ownerId: 1 },
        { id: 2, relativePath: "1/b/icon.ico", ownerId: 1 },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/dup-media",
          title: "First",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
        {
          id: 2,
          url: "https://example.com/dup-media",
          title: "Second",
          ownerId: 1,
          categoryId: 1,
          iconId: 2,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.mediaImported).toBe(2);
      const media = target.db
        .query<{ source_url: string }, []>(
          "SELECT source_url FROM bookmark_media ORDER BY source_url"
        )
        .all();
      expect(media).toHaveLength(2);
      expect(media[0]?.source_url).not.toBe(media[1]?.source_url);
      expect(media.every((m) => m.source_url.startsWith("legacy://"))).toBe(true);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("restores trashed URL stubs without requiring --merge", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/trash-stub",
          title: "From Legacy",
          ownerId: 1,
          categoryId: 1,
          note: "legacy-note",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks
         SET is_trashed = 1, trashed_at = '2024-01-01T00:00:00.000Z', notes = 'stub'
         WHERE url = 'https://example.com/trash-stub'`
      );

      const restored = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(restored.bookmarksMerged).toBe(1);
      expect(restored.bookmarksSkipped).toBe(0);
      expect(restored.warnings.join("\n")).toMatch(/Restoring trashed duplicate/i);

      const row = target.db
        .query<{ is_trashed: number; notes: string | null }, []>(
          "SELECT is_trashed, notes FROM bookmarks WHERE url = 'https://example.com/trash-stub'"
        )
        .get();
      expect(row?.is_trashed).toBe(0);
      expect(row?.notes).toContain("stub");
      expect(row?.notes).toContain("legacy-note");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("preserves local archive when auto-restoring an archived+trashed URL", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/archived-trash",
          title: "Archived Trash",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks
         SET is_archived = 1,
             is_trashed = 1,
             trashed_at = '2024-01-01T00:00:00.000Z'
         WHERE url = 'https://example.com/archived-trash'`
      );

      const restored = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(restored.bookmarksMerged).toBe(1);
      const row = target.db
        .query<{ is_archived: number; is_trashed: number }, []>(
          "SELECT is_archived, is_trashed FROM bookmarks WHERE url = 'https://example.com/archived-trash'"
        )
        .get();
      expect(row?.is_trashed).toBe(0);
      expect(row?.is_archived).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("fills a null local category on --merge but never overwrites a chosen one", async () => {
    const fixture = await makeDirtyFixture({
      categories: [{ id: 1, name: "Work", slug: "work", ownerId: 1 }],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/uncat",
          title: "Uncat",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks SET category_id = NULL WHERE url = 'https://example.com/uncat'`
      );

      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );

      const row = target.db
        .query<{ name: string | null }, []>(
          `SELECT c.name FROM bookmarks b
           LEFT JOIN categories c ON c.id = b.category_id
           WHERE b.url = 'https://example.com/uncat'`
        )
        .get();
      expect(row?.name).toBe("Work");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("warns when skipping an existing active URL without --merge", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/exists",
          title: "Legacy",
          ownerId: 1,
          categoryId: 1,
          note: "should-not-apply",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      target.db.run(
        `UPDATE bookmarks SET notes = 'local-only' WHERE url = 'https://example.com/exists'`
      );

      const skipped = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(skipped.bookmarksSkipped).toBe(1);
      expect(skipped.warnings.join("\n")).toMatch(/Skipped existing URL.*--merge/i);
      const row = target.db
        .query<{ notes: string | null }, []>(
          "SELECT notes FROM bookmarks WHERE url = 'https://example.com/exists'"
        )
        .get();
      expect(row?.notes).toBe("local-only");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("matches existing mixed-case 1.x hosts to migrated lowercase URLs", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/CasePath",
          title: "From Legacy",
          ownerId: 1,
          categoryId: 1,
          note: "legacy-note",
        },
      ],
    });
    const target = freshTarget();
    try {
      // Simulate a 1.x row saved with mixed-case host (API stores raw input).
      target.db.run(
        `INSERT INTO bookmarks (id, url, domain, title, status, notes, is_pinned, is_archived, is_trashed)
         VALUES ('local-mixed', 'https://Example.com/CasePath', 'Example.com', 'Local', 'saved', 'local-note', 0, 0, 0)`
      );

      const skipped = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(skipped.bookmarksSkipped).toBe(1);
      expect(skipped.bookmarksCreated).toBe(0);
      expect(
        target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks").get()?.c
      ).toBe(1);

      const merged = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          enqueueIngest: false,
          mergeDuplicates: true,
        }
      );
      expect(merged.bookmarksMerged).toBe(1);
      expect(merged.bookmarksCreated).toBe(0);
      const row = target.db
        .query<{ url: string; notes: string | null }, []>(
          "SELECT url, notes FROM bookmarks WHERE id = 'local-mixed'"
        )
        .get();
      expect(row?.url).toBe("https://Example.com/CasePath");
      expect(row?.notes).toContain("local-note");
      expect(row?.notes).toContain("legacy-note");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("canonicalizes bare-origin URLs without a trailing slash", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://Example.COM",
          title: "Origin",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    try {
      const contents = openLegacyV05Database({ dataDir: fixture.dataDir });
      const owner = findLegacyOwner(contents, undefined);
      const library = normalizeLegacyLibrary(contents, owner);
      expect(library.bookmarks[0]?.url).toBe("https://example.com");
    } finally {
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps description searchable in FTS for description-only bookmarks after 0018", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/desc-only-fts",
          title: "DescOnly",
          ownerId: 1,
          categoryId: 1,
          description: "uniquedesconlytoken for FTS",
        },
      ],
    });
    const target = freshTarget();
    try {
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      const fts = target.db
        .query<{ summary: string | null }, []>("SELECT summary FROM bookmarks_fts LIMIT 1")
        .get();
      expect(fts?.summary).toContain("uniquedesconlytoken");
      const hits = target.db
        .query<{ c: number }, []>(
          `SELECT COUNT(*) AS c FROM bookmarks_fts WHERE bookmarks_fts MATCH 'uniquedesconlytoken'`
        )
        .get()?.c;
      expect(hits).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("keeps description searchable in FTS when only author/published metadata is migrated", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/author-only",
          title: "Author Only",
          ownerId: 1,
          categoryId: 1,
          description: "uniquedescauthoronly",
          contentPublishedDate: "2020-01-02T00:00:00.000Z",
        },
      ],
    });
    // Seed author via raw SQL — DirtyOpts has no author field.
    const srcDb = new Database(fixture.dbPath);
    srcDb.run(`UPDATE bookmark SET author = 'Ada Lovelace' WHERE id = 1`);
    srcDb.close();

    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const byDesc = target.db
        .query<{ c: number }, []>(
          `SELECT COUNT(*) AS c FROM bookmarks_fts WHERE bookmarks_fts MATCH 'uniquedescauthoronly'`
        )
        .get()?.c;
      expect(byDesc).toBe(1);
      const ftsSummary = target.db
        .query<{ summary: string | null }, []>("SELECT summary FROM bookmarks_fts LIMIT 1")
        .get()?.summary;
      expect(ftsSummary).toMatch(/uniquedescauthoronly/i);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("derives searchable markdown from HTML-only private/LAN bookmarks", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "http://192.168.0.50/docs",
          title: "LAN Docs",
          ownerId: 1,
          categoryId: 1,
          description: "uniquedescomega for FTS summary",
          contentHtml: "<h1>Router Guide</h1><p>uniquephrasegamma for LAN readers</p>",
          contentText: null,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      const content = target.db
        .query<{ markdown: string | null; raw_html: string | null }, []>(
          "SELECT markdown, raw_html FROM bookmark_content"
        )
        .get();
      expect(content?.raw_html).toContain("Router Guide");
      expect(content?.markdown).toMatch(/uniquephrasegamma/i);

      const fts = target.db
        .query<{ c: number }, []>(
          `SELECT COUNT(*) AS c FROM bookmarks_fts WHERE bookmarks_fts MATCH 'uniquephrasegamma'`
        )
        .get()?.c;
      expect(fts).toBe(1);

      const ftsSummary = target.db
        .query<{ summary: string | null }, []>(
          "SELECT summary FROM bookmarks_fts LIMIT 1"
        )
        .get()?.summary;
      expect(ftsSummary).toMatch(/uniquedescomega/i);

      const byDesc = target.db
        .query<{ c: number }, []>(
          `SELECT COUNT(*) AS c FROM bookmarks_fts WHERE bookmarks_fts MATCH 'uniquedescomega'`
        )
        .get()?.c;
      expect(byDesc).toBe(1);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("stress: kitchen-sink multi-edge library migrates without failures", async () => {
    const deepCats = [
      { id: 1, name: "L1", slug: "l1", ownerId: 1 },
      { id: 2, name: "L2", slug: "l2", ownerId: 1, parentId: 1 },
      { id: 3, name: "L3", slug: "l3", ownerId: 1, parentId: 2 },
      { id: 4, name: "L4", slug: "l4", ownerId: 1, parentId: 3 },
      { id: 5, name: "L5", slug: "l5", ownerId: 1, parentId: 4 },
    ];
    const tags = [
      { id: 1, name: "alpha", slug: "alpha", ownerId: 1 },
      { id: 2, name: "beta", slug: "beta", ownerId: 1 },
      { id: 3, name: "  ", slug: "blank", ownerId: 1 },
    ];
    const bookmarks = [
      {
        id: 1,
        url: "https://example.com/stress-1",
        title: "Public",
        ownerId: 1,
        categoryId: 5,
        tagIds: [1, 2, 3],
        note: "n1",
        flagged: 1,
        contentHtml: "<p>stress-html-body</p>",
        contentText: null,
        iconId: 1,
      },
      {
        id: 2,
        url: "http://10.0.0.8/nas",
        title: "NAS",
        ownerId: 1,
        categoryId: 1,
        tagIds: [1],
        contentHtml: "<p>nas-only-html uniquephrasenas</p>",
        contentText: null,
      },
      {
        id: 3,
        url: "https://example.com/stress-1",
        title: "Dup",
        ownerId: 1,
        categoryId: 1,
        note: "n2",
        tagIds: [2],
      },
      {
        id: 4,
        url: "https://user:pass@example.com/x",
        title: "Creds",
        ownerId: 1,
        categoryId: 1,
      },
      {
        id: 5,
        url: "https://EXAMPLE.com/Stress-2/",
        title: "Cased",
        ownerId: 1,
        categoryId: 2,
        archived: 1,
        openedTimes: 9,
      },
      ...Array.from({ length: 40 }, (_, i) => ({
        id: 100 + i,
        url: `https://example.com/bulk-${i}`,
        title: `Bulk ${i}`,
        ownerId: 1,
        categoryId: (i % 3) + 1,
        tagIds: i % 2 === 0 ? [1] : [2],
        note: i % 5 === 0 ? `note-${i}` : null,
        flagged: i % 7 === 0 ? 1 : null,
      })),
    ];
    const fixture = await makeDirtyFixture({
      categories: deepCats,
      tags,
      files: [{ id: 1, relativePath: "1/icon.png", ownerId: 1 }],
      bookmarks,
    });
    const target = freshTarget();
    try {
      const dry = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, dryRun: true, enqueueIngest: false }
      );
      expect(dry.bookmarksFailed).toBe(0);
      expect(dry.bookmarksCreated).toBeGreaterThan(40);

      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir, password: "dirty-secret", requirePassword: true },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksFailed).toBe(0);
      expect(summary.bookmarksCreated).toBe(dry.bookmarksCreated);
      expect(summary.mediaImported).toBeGreaterThanOrEqual(1);

      const leaf = target.db
        .query<{ name: string }, []>(
          `SELECT c.name FROM bookmarks b
           JOIN categories c ON c.id = b.category_id
           WHERE b.url = 'https://example.com/stress-1'`
        )
        .get();
      expect(leaf?.name).toBe("L5");

      const privateMd = target.db
        .query<{ markdown: string | null }, []>(
          `SELECT bc.markdown FROM bookmark_content bc
           JOIN bookmarks b ON b.id = bc.bookmark_id
           WHERE b.url LIKE 'http://10.0.0.8/%'`
        )
        .get();
      expect(privateMd?.markdown).toMatch(/uniquephrasenas/i);

      const rerun = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(rerun.bookmarksCreated).toBe(0);
      expect(rerun.bookmarksFailed).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("imports IDN/unicode host URLs with punycode domain", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://münchen.example/pfad",
          title: "München",
          ownerId: 1,
          categoryId: 1,
          note: "idn-note",
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksFailed).toBe(0);
      const row = target.db
        .query<{ url: string; domain: string; notes: string | null }, []>(
          "SELECT url, domain, notes FROM bookmarks"
        )
        .get();
      expect(row?.url.toLowerCase()).toContain("xn--");
      expect(row?.domain.toLowerCase()).toContain("xn--");
      expect(row?.notes).toBe("idn-note");
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("applies a zip whose data/ folder is nested under backup wrappers", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/nested-zip",
          title: "NestedZip",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const wrapRoot = mkdtempSync(join(tmpdir(), "v05-wrap-"));
    const nestedData = join(wrapRoot, "backup", "2024-01", "data");
    mkdirSync(nestedData, { recursive: true });
    cpSync(fixture.dbPath, join(nestedData, "db.sqlite"));
    cpSync(fixture.uploadsDir, join(nestedData, "user-uploads"), { recursive: true });

    const zipPath = join(wrapRoot, "nested.zip");
    const zip = spawnSync("zip", ["-qr", zipPath, "backup"], {
      cwd: wrapRoot,
      encoding: "utf8",
    });
    expect(zip.status).toBe(0);

    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { archivePath: zipPath },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(summary.bookmarksCreated).toBe(1);
      expect(summary.bookmarksFailed).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
      rmSync(wrapRoot, { recursive: true, force: true });
    }
  });

  it("does not modify source db.sqlite or create WAL sidecars beside it", async () => {
    const fixture = await makeDirtyFixture({
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/source-intact",
          title: "Intact",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    const hashFile = (path: string): string =>
      createHash("sha256").update(readFileSync(path)).digest("hex");
    const before = hashFile(fixture.dbPath);
    const sideBefore = ["-wal", "-shm", "-journal"].map((s) => existsSync(`${fixture.dbPath}${s}`));
    try {
      inspectLegacyV05Source({ dataDir: fixture.dataDir });
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          dryRun: true,
          enqueueIngest: false,
        }
      );
      await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
      );
      expect(hashFile(fixture.dbPath)).toBe(before);
      expect(["-wal", "-shm", "-journal"].map((s) => existsSync(`${fixture.dbPath}${s}`))).toEqual(
        sideBefore
      );
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("refuses symlink archives before extract without touching outside paths", () => {
    const root = mkdtempSync(join(tmpdir(), "v05-symlink-precheck-"));
    const outside = join(root, "outside-sentinel.txt");
    writeFileSync(outside, "untouched");
    try {
      const payload = join(root, "payload");
      mkdirSync(payload, { recursive: true });
      writeFileSync(join(payload, "db.sqlite"), "not-a-real-db");
      symlinkSync(outside, join(payload, "escape-link"));
      const archivePath = join(root, "evil.zip");
      const zip = spawnSync("zip", ["-qy", archivePath, "db.sqlite", "escape-link"], {
        cwd: payload,
        encoding: "utf8",
      });
      expect(zip.status).toBe(0);
      expect(() => extractLegacyArchive(archivePath)).toThrow(/contains a symlink/i);
      expect(readFileSync(outside, "utf8")).toBe("untouched");
      expect(readdirSync(root).includes("grimoire-v05-archive-")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("dry-run with media does not write media-cache files", async () => {
    const fixture = await makeDirtyFixture({
      withUploads: true,
      files: [
        {
          id: 1,
          relativePath: "icon.png",
          ownerId: 1,
          writeBytes: TINY_PNG,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/dry-media",
          title: "Dry Media",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
      ],
    });
    const target = freshTarget();
    try {
      const summary = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        {
          db: target.db,
          dataDir: target.dataDir,
          dryRun: true,
          enqueueIngest: false,
        }
      );
      expect(summary.dryRun).toBe(true);
      expect(summary.mediaImported).toBeGreaterThanOrEqual(1);
      expect(existsSync(join(target.dataDir, "media-cache"))).toBe(false);
      expect(
        target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks").get()?.c
      ).toBe(0);
    } finally {
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });

  it("rolls back the whole apply when commit fails after successful bookmarks", async () => {
    const fixture = await makeDirtyFixture({
      withUploads: true,
      files: [
        {
          id: 1,
          relativePath: "icon.png",
          ownerId: 1,
          writeBytes: TINY_PNG,
        },
      ],
      bookmarks: [
        {
          id: 1,
          url: "https://example.com/crash-1",
          title: "Crash One",
          ownerId: 1,
          categoryId: 1,
          iconId: 1,
        },
        {
          id: 2,
          url: "https://example.com/crash-2",
          title: "Crash Two",
          ownerId: 1,
          categoryId: 1,
        },
      ],
    });
    const target = freshTarget();
    const originalExec = target.db.exec.bind(target.db);
    target.db.exec = ((sql: string) => {
      if (/^\s*COMMIT\b/i.test(sql)) {
        throw new Error("injected crash before commit");
      }
      return originalExec(sql);
    }) as typeof target.db.exec;
    try {
      await expect(
        migrateLegacyV05Source(
          { dataDir: fixture.dataDir },
          { db: target.db, dataDir: target.dataDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/injected crash before commit/i);
      expect(
        target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks").get()?.c
      ).toBe(0);
      expect(
        target.db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmark_media").get()?.c
      ).toBe(0);
      const cacheRoot = join(target.dataDir, "media-cache", "bookmarks");
      if (existsSync(cacheRoot)) {
        const listing = spawnSync("find", [cacheRoot, "-type", "f"], {
          encoding: "utf8",
        });
        expect((listing.stdout || "").trim()).toBe("");
      }
    } finally {
      target.db.exec = originalExec;
      target.db.close();
      rmSync(fixture.dataDir, { recursive: true, force: true });
      rmSync(target.dataDir, { recursive: true, force: true });
    }
  });
});
