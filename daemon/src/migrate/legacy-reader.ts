import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveLegacySourcePaths, resolveLegacyUploadPath, LegacySourceError } from "./legacy-paths.js";
import type {
  LegacyBackupContents,
  LegacyBookmark,
  LegacyCategory,
  LegacyFile,
  LegacyInspectResult,
  LegacyOwnerSummary,
  LegacyTag,
  LegacyUser,
} from "./legacy-types.js";

/**
 * Serialize the source database into a temp dir so inspect/apply never create
 * or mutate files next to the user's v0.5 database.
 */
function openSourceDbSnapshot(dbPath: string): {
  db: Database;
  cleanup: () => void;
} {
  const dir = mkdtempSync(join(tmpdir(), "grimoire-v05-src-"));
  const snapshotPath = join(dir, "db.sqlite");

  const cleanup = (): void => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort temp cleanup
    }
  };

  let source: Database | undefined;
  let readTransactionOpen = false;
  try {
    // Serialize the source from one read transaction. This includes committed
    // WAL pages in one SQLite image instead of racing separate sidecar copies.
    source = new Database(dbPath, { readonly: true });
    source.exec("BEGIN;");
    readTransactionOpen = true;
    const bytes = source.serialize();
    source.exec("COMMIT;");
    readTransactionOpen = false;
    writeFileSync(snapshotPath, bytes, { mode: 0o600 });

    // Open the disposable snapshot read-write so WAL -shm can be created beside
    // the copy. query_only still blocks mutations; the user's source path is untouched.
    const db = new Database(snapshotPath);
    return { db, cleanup };
  } catch (err) {
    if (readTransactionOpen) {
      try {
        source?.exec("ROLLBACK;");
      } catch {
        // best-effort transaction cleanup
      }
    }
    cleanup();
    throw err;
  } finally {
    source?.close();
  }
}

function asString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = asNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }
  return false;
}

function tableExists(db: Database, name: string): boolean {
  const row = db
    .query<{ name: string }, [string]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(name);
  return Boolean(row);
}

function assertV05Schema(db: Database): void {
  // PocketBase-era DBs use plural collection tables; reject before the v0.5 required-table check
  // so callers get a clear message instead of a generic "missing user/bookmark/…" error.
  if (tableExists(db, "users") && tableExists(db, "bookmarks") && !tableExists(db, "user")) {
    throw new LegacySourceError(
      "This looks like a PocketBase data.db. Grimoire 1.x migrate only supports v0.5 SQLite."
    );
  }

  const required = ["user", "bookmark", "category", "tag", "bookmarks_to_tags"];
  const missing = required.filter((name) => !tableExists(db, name));
  if (missing.length > 0) {
    throw new LegacySourceError(
      `Not a Grimoire v0.5 SQLite database (missing tables: ${missing.join(", ")}). ` +
        "This migrator only supports v0.5 data/db.sqlite — not PocketBase backups."
    );
  }
}

function readUsers(db: Database): LegacyUser[] {
  const rows = db.query<Record<string, unknown>, []>("SELECT * FROM user").all();
  return rows.map((row) => ({
    id: asNumber(row.id),
    name: asString(row.name),
    username: asString(row.username),
    email: asString(row.email),
    passwordHash: asString(row.password_hash),
    // v0.5 schema stores "verified" in a column named `initial`
    verified: asBool(row.initial ?? row.verified),
    disabled: asNullableNumber(row.disabled),
    isAdmin: asBool(row.is_admin),
    created: asNumber(row.created),
    updated: asNumber(row.updated),
  }));
}

function readCategories(db: Database): LegacyCategory[] {
  const rows = db.query<Record<string, unknown>, []>("SELECT * FROM category").all();
  return rows.map((row) => ({
    id: asNumber(row.id),
    name: asString(row.name),
    slug: asString(row.slug),
    description: row.description == null ? null : asString(row.description),
    color: row.color == null ? null : asString(row.color),
    icon: row.icon == null ? null : asString(row.icon),
    initial: asBool(row.initial),
    archived: asNullableNumber(row.archived),
    public: asNullableNumber(row.public),
    parentId: asNullableNumber(row.parent_id),
    ownerId: asNumber(row.owner_id),
    created: asNumber(row.created),
    updated: asNumber(row.updated),
  }));
}

function readTags(db: Database): LegacyTag[] {
  const rows = db.query<Record<string, unknown>, []>("SELECT * FROM tag").all();
  return rows.map((row) => ({
    id: asNumber(row.id),
    name: asString(row.name),
    slug: asString(row.slug),
    ownerId: asNumber(row.owner_id),
    created: asNumber(row.created),
    updated: asNumber(row.updated),
  }));
}

function readFiles(db: Database): Map<number, LegacyFile> {
  const map = new Map<number, LegacyFile>();
  if (!tableExists(db, "file")) return map;
  const rows = db.query<Record<string, unknown>, []>("SELECT * FROM file").all();
  for (const row of rows) {
    const id = asNumber(row.id);
    map.set(id, {
      id,
      fileName: asString(row.file_name),
      storageType: asString(row.storage_type),
      relativePath: asString(row.relative_path),
      size: asNullableNumber(row.size),
      mimeType: asString(row["mime-type"] ?? row.mime_type),
      source: asString(row.source),
      ownerId: asNumber(row.owner_id),
    });
  }
  return map;
}

function readBookmarkTagMap(db: Database): Map<number, number[]> {
  const map = new Map<number, number[]>();
  const rows = db
    .query<{ bookmark_id: number; tag_id: number }, []>(
      "SELECT bookmark_id, tag_id FROM bookmarks_to_tags"
    )
    .all();
  for (const row of rows) {
    const list = map.get(row.bookmark_id) ?? [];
    list.push(row.tag_id);
    map.set(row.bookmark_id, list);
  }
  return map;
}

function readBookmarks(db: Database): LegacyBookmark[] {
  const tagMap = readBookmarkTagMap(db);
  const rows = db.query<Record<string, unknown>, []>("SELECT * FROM bookmark").all();
  return rows.map((row) => {
    const id = asNumber(row.id);
    return {
      id,
      url: asString(row.url),
      domain: asString(row.domain),
      title: asString(row.title),
      description: row.description == null ? null : asString(row.description),
      author: row.author == null ? null : asString(row.author),
      contentHtml: row.content_html == null ? null : asString(row.content_html),
      contentText: row.content_text == null ? null : asString(row.content_text),
      contentType: row.content_type == null ? null : asString(row.content_type),
      contentPublishedDate:
        row.content_published_date == null ? null : asString(row.content_published_date),
      note: row.note == null ? null : asString(row.note),
      mainImageUrl: row.main_image_url == null ? null : asString(row.main_image_url),
      mainImageId: asNullableNumber(row.main_image_id),
      iconUrl: row.icon_url == null ? null : asString(row.icon_url),
      iconId: asNullableNumber(row.icon_id),
      screenshotId: asNullableNumber(row.screenshotId ?? row.screenshot_id),
      importance: asNullableNumber(row.importance),
      flagged: asNullableNumber(row.flagged),
      read: asNullableNumber(row.read),
      archived: asNullableNumber(row.archived),
      openedLast: asNullableNumber(row.opened_last),
      openedTimes: asNumber(row.opened_times, 0),
      ownerId: asNumber(row.owner_id),
      categoryId: asNullableNumber(row.category_id),
      created: asNumber(row.created),
      updated: asNumber(row.updated),
      tagIds: tagMap.get(id) ?? [],
    };
  });
}

function countMediaReferences(bookmarks: LegacyBookmark[]): number {
  let count = 0;
  for (const bookmark of bookmarks) {
    if (bookmark.iconId) count += 1;
    if (bookmark.mainImageId) count += 1;
    if (bookmark.screenshotId) count += 1;
  }
  return count;
}

export function buildOwnerSummaries(contents: LegacyBackupContents): LegacyOwnerSummary[] {
  return contents.users.map((user) => ({
    id: String(user.id),
    username: user.username,
    email: user.email,
    name: user.name,
    bookmarkCount: contents.bookmarks.filter((b) => b.ownerId === user.id).length,
    categoryCount: contents.categories.filter((c) => c.ownerId === user.id).length,
    tagCount: contents.tags.filter((t) => t.ownerId === user.id).length,
    disabled: user.disabled != null && user.disabled !== 0,
  }));
}

export function inspectLegacyBackup(contents: LegacyBackupContents): LegacyInspectResult {
  const users = buildOwnerSummaries(contents);
  return {
    source: "grimoire-v05-sqlite",
    dbPath: contents.dbPath,
    uploadsDir: contents.uploadsDir,
    users,
    totals: {
      users: contents.users.length,
      categories: contents.categories.length,
      tags: contents.tags.length,
      bookmarks: contents.bookmarks.length,
      mediaFilesReferenced: countMediaReferences(contents.bookmarks),
    },
    requiresOwnerSelection: contents.users.length > 1,
  };
}

export function openLegacyV05Database(input: {
  dataDir?: string;
  dbPath?: string;
  uploadsDir?: string;
  archivePath?: string;
}): LegacyBackupContents {
  const paths = resolveLegacySourcePaths(input);
  let snapshotCleanup: (() => void) | undefined;
  try {
    const snapshot = openSourceDbSnapshot(paths.dbPath);
    snapshotCleanup = snapshot.cleanup;
    const db = snapshot.db;
    try {
      // Defense in depth: refuse mutations even if a later query regresses.
      db.exec("PRAGMA query_only = ON;");
      assertV05Schema(db);
      const combinedCleanup = (): void => {
        snapshotCleanup?.();
        snapshotCleanup = undefined;
        paths.cleanup?.();
      };
      return {
        dbPath: paths.dbPath,
        uploadsDir: paths.uploadsDir,
        users: readUsers(db),
        categories: readCategories(db),
        tags: readTags(db),
        bookmarks: readBookmarks(db),
        files: readFiles(db),
        cleanup: combinedCleanup,
      };
    } finally {
      db.close();
    }
  } catch (err) {
    snapshotCleanup?.();
    paths.cleanup?.();
    throw err;
  }
}

export { resolveLegacyUploadPath, LegacySourceError };
