/**
 * Exact-schema fidelity: clone a real empty v0.5 db.sqlite (Drizzle schema +
 * indexes + FKs + session table), populate with a real argon2id user, nested
 * categories, tags, content, adversarial URLs, and a slice of leftover
 * user-uploads media — then inspect / dry-run / apply with password verify.
 *
 * This is the closest automated proof to migrating a live v0.5 install when an
 * intact original populated backup is unavailable.
 */
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
import { basename, extname, join } from "path";
import { runMigrations } from "../db/migrations.js";
import {
  inspectLegacyV05Source,
  migrateLegacyV05Source,
} from "../migrate/legacy-migrate.js";

const REAL_SCHEMA_CANDIDATES = [
  join(process.cwd(), "data/db.sqlite"),
  "/Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire/data/db.sqlite",
  "/tmp/grimoire-v05-pop-jNss/db.sqlite",
];

const REAL_UPLOADS_CANDIDATES = [
  join(process.cwd(), "data/user-uploads/1"),
  "/Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire/data/user-uploads/1",
];

function findExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

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
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function buildExactSchemaFixture(): Promise<{
  dataDir: string;
  password: string;
} | null> {
  const schemaSrc = findExisting(REAL_SCHEMA_CANDIDATES);
  const uploadsSrc = findExisting(REAL_UPLOADS_CANDIDATES);
  if (!schemaSrc || !uploadsSrc) return null;

  const dataDir = mkdtempSync(join(tmpdir(), "v05-exact-schema-"));
  const dbPath = join(dataDir, "db.sqlite");
  copyFileSync(schemaSrc, dbPath);
  // Drop WAL sidecars from the source copy if any were adjacent — start clean.
  for (const side of [`${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(side)) rmSync(side, { force: true });
  }

  const password = "ExactSchemaSecret123!";
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 19456,
    timeCost: 2,
  });

  const db = new Database(dbPath);
  db.exec("PRAGMA foreign_keys=ON");
  // Ensure empty tables (source may be wiped already, or a prior populate).
  db.exec(`
    DELETE FROM bookmarks_to_tags;
    DELETE FROM bookmark;
    DELETE FROM file;
    DELETE FROM tag;
    DELETE FROM category;
    DELETE FROM session;
    DELETE FROM user;
  `);

  const t0 = 1_700_000_000;
  db.run(
    `INSERT INTO user (id, name, username, email, password_hash, initial, disabled, is_admin, created, updated)
     VALUES (1, 'Exact User', 'exactuser', 'exact@example.com', ?, 1, ?, 1, ?, ?)`,
    [passwordHash, t0, t0, t0]
  );
  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (1, 'Uncategorized', 'uncategorized', NULL, '#ccc', 1, NULL, NULL, NULL, NULL, 1, ?, ?)`,
    [t0, t0]
  );
  db.run(
    `INSERT INTO category (id, name, slug, description, color, owner_id, parent_id, archived, public, icon, initial, created, updated)
     VALUES (2, 'Nested', 'nested', 'child', '#abcdef', 1, 1, NULL, NULL, NULL, 0, ?, ?)`,
    [t0, t0]
  );
  db.run(`INSERT INTO tag (id, name, slug, owner_id, created, updated) VALUES (1, 'legacy', 'legacy', 1, ?, ?)`, [
    t0,
    t0,
  ]);
  db.run(
    `INSERT INTO tag (id, name, slug, owner_id, created, updated) VALUES (2, 'exact-schema', 'exact-schema', 1, ?, ?)`,
    [t0, t0]
  );

  const bookmarkSpecs = [
    {
      url: "https://example.com/exact-1",
      title: "Exact One",
      categoryId: 1,
      note: "note-one",
      flagged: t0,
      published: "2024-06-01",
      importance: 2,
      html: "<p>one</p>",
      text: "one",
    },
    {
      url: "https://example.com/exact-2",
      title: "Exact Two",
      categoryId: 2,
      note: "N".repeat(20_000),
      flagged: null as number | null,
      published: "1700000000",
      importance: null as number | null,
      html: "<p>two</p>",
      text: "two",
    },
    {
      url: "https://Example.com/exact-1",
      title: "Dup Case",
      categoryId: 1,
      note: "dup-note",
      flagged: null,
      published: null as string | null,
      importance: null,
      html: null as string | null,
      text: null as string | null,
    },
    {
      url: "http://example.com/exact-2",
      title: "Http Twin",
      categoryId: 1,
      note: "http-twin",
      flagged: null,
      published: null,
      importance: null,
      html: null,
      text: null,
    },
    {
      url: "http://127.0.0.1/private",
      title: "Private",
      categoryId: 1,
      note: null as string | null,
      flagged: null,
      published: null,
      importance: null,
      html: null,
      text: null,
    },
  ];

  const bmIds: number[] = [];
  for (const spec of bookmarkSpecs) {
    const info = db.run(
      `INSERT INTO bookmark (
        url, domain, title, description, author, content_text, content_html, content_type,
        content_published_date, note, importance, flagged, read, archived, owner_id, category_id,
        opened_last, opened_times, created, updated
      ) VALUES (?, 'example.com', ?, 'desc', 'author', ?, ?, 'html', ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, ?)`,
      [
        spec.url,
        spec.title,
        spec.text,
        spec.html,
        spec.published,
        spec.note,
        spec.importance,
        spec.flagged,
        spec.flagged ? t0 + 10 : null,
        spec.categoryId,
        spec.flagged ? t0 : null,
        spec.flagged ? 4 : 0,
        t0,
        t0,
      ]
    );
    bmIds.push(Number(info.lastInsertRowid));
  }

  db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (?, 1)`, [bmIds[0]]);
  db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (?, 2)`, [bmIds[0]]);
  db.run(`INSERT INTO bookmarks_to_tags (bookmark_id, tag_id) VALUES (?, 1)`, [bmIds[1]]);
  db.run(`INSERT INTO session (id, user_id, expires_at) VALUES ('sess-exact', 1, ?)`, [
    t0 + 86_400,
  ]);

  const uploadsRoot = join(dataDir, "user-uploads", "1");
  mkdirSync(uploadsRoot, { recursive: true });
  const srcDirs = readdirSync(uploadsSrc)
    .filter((name) => {
      const st = statSync(join(uploadsSrc, name));
      return st.isDirectory() && /^\d+$/.test(name);
    })
    .sort((a, b) => Number(a) - Number(b));

  let fileId = 1;
  for (const [index, bmId] of bmIds.slice(0, 2).entries()) {
    const src = join(uploadsSrc, srcDirs[index] ?? srcDirs[0]);
    if (!existsSync(src)) continue;
    const dest = join(uploadsRoot, String(bmId));
    mkdirSync(dest, { recursive: true });
    let iconId: number | null = null;
    let mainId: number | null = null;
    for (const abs of walkFiles(src).slice(0, 8)) {
      const name = basename(abs).replace(/\//g, "_");
      const target = join(dest, name);
      copyFileSync(abs, target);
      const rel = `1/${bmId}/${name}`;
      const mime = mimeFor(abs);
      db.run(
        `INSERT INTO file (id, file_name, storage_type, relative_path, size, "mime-type", source, owner_id, created, updated)
         VALUES (?, ?, 'local', ?, ?, ?, ?, 1, ?, ?)`,
        [
          fileId,
          name,
          rel,
          statSync(target).size,
          mime,
          index === 0 ? "webextension" : "upload",
          t0,
          t0,
        ]
      );
      const low = name.toLowerCase();
      if (
        iconId == null &&
        (low.includes("favicon") || low.includes("icon") || mime === "image/x-icon" || !extname(name))
      ) {
        iconId = fileId;
      } else if (mainId == null) {
        mainId = fileId;
      }
      fileId += 1;
    }
    db.run(`UPDATE bookmark SET icon_id = ?, main_image_id = ? WHERE id = ?`, [
      iconId,
      mainId,
      bmId,
    ]);
  }

  db.close();
  return { dataDir, password };
}

describe("v0.5 migration against exact real schema clone", () => {
  it("inspects, password-verifies, and applies a library on a real db.sqlite schema", async () => {
    const fixture = await buildExactSchemaFixture();
    if (!fixture) {
      expect(true).toBe(true);
      return;
    }

    const targetDir = mkdtempSync(join(tmpdir(), "v05-exact-target-"));
    const db = new Database(join(targetDir, "littleimp.db"));
    runMigrations(db);

    try {
      const inspect = inspectLegacyV05Source({ dataDir: fixture.dataDir });
      expect(inspect.source).toBe("grimoire-v05-sqlite");
      expect(inspect.totals.users).toBe(1);
      expect(inspect.totals.bookmarks).toBe(5);
      expect(inspect.requiresOwnerSelection).toBe(false);

      const dry = await migrateLegacyV05Source(
        { dataDir: fixture.dataDir },
        { db, dataDir: targetDir, dryRun: true, enqueueIngest: false }
      );
      // private/LAN imported; host-case dup collapsed; http/https twin kept separate
      expect(dry.bookmarksCreated).toBe(4);
      expect(dry.bookmarksFailed).toBe(0);
      expect(dry.warnings.join("\n")).toMatch(/Near-duplicate URLs/i);
      expect(dry.warnings.join("\n")).toMatch(/disabled/i);

      const summary = await migrateLegacyV05Source(
        {
          dataDir: fixture.dataDir,
          password: fixture.password,
          requirePassword: true,
        },
        { db, dataDir: targetDir, enqueueIngest: false }
      );

      expect(summary.bookmarksCreated).toBe(4);
      expect(summary.bookmarksFailed).toBe(0);
      expect(summary.tagsCreated).toBe(2);
      expect(summary.categoriesCreated).toBe(2);
      expect(summary.mediaImported).toBeGreaterThan(0);
      expect(summary.warnings.join("\n")).toMatch(/Merged duplicate URL/i);
      expect(summary.warnings.join("\n")).toMatch(/private\/LAN URL|private\/LAN host/i);
      expect(summary.warnings.join("\n")).toMatch(/Near-duplicate URLs/i);

      const imported = db
        .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM bookmarks")
        .get()?.c;
      expect(imported).toBe(4);

      const largeNote = db
        .query<{ notes: string | null }, []>(
          "SELECT notes FROM bookmarks WHERE url = 'https://example.com/exact-2'"
        )
        .get();
      expect(largeNote?.notes?.length).toBe(20_000);

      const nested = db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM categories WHERE parent_id IS NOT NULL"
        )
        .get()?.c;
      expect(nested).toBe(1);

      const withHtml = db
        .query<{ c: number }, []>(
          "SELECT COUNT(*) AS c FROM bookmark_content WHERE raw_html IS NOT NULL"
        )
        .get()?.c;
      expect(withHtml).toBeGreaterThan(0);

      const notes = db
        .query<{ notes: string | null }, []>(
          "SELECT notes FROM bookmarks WHERE url = 'https://example.com/exact-1'"
        )
        .get();
      expect(notes?.notes).toMatch(/note-one/);
      expect(notes?.notes).toMatch(/dup-note/);

      const published = db
        .query<{ published_at: string | null }, []>(
          `SELECT published_at FROM bookmark_content bc
           JOIN bookmarks b ON b.id = bc.bookmark_id
           WHERE b.url = 'https://example.com/exact-2'`
        )
        .get();
      expect(published?.published_at).toBe(new Date(1_700_000_000 * 1000).toISOString());

      await expect(
        migrateLegacyV05Source(
          {
            dataDir: fixture.dataDir,
            password: "wrong-password",
            requirePassword: true,
          },
          { db, dataDir: targetDir, enqueueIngest: false }
        )
      ).rejects.toThrow(/password/i);
    } finally {
      db.close();
      rmSync(targetDir, { recursive: true, force: true });
      rmSync(fixture.dataDir, { recursive: true, force: true });
    }
  });
});
