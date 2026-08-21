import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "crypto";
import { existsSync, statSync } from "fs";
import { mkdir } from "fs/promises";
import { extname, join } from "path";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { TagRepository } from "../db/tag-repository.js";
import { MEDIA_CACHE_LIMITS } from "../media/bookmark-media.js";
import type { JobQueue } from "../queue.js";
import type {
  LegacyApplySummary,
  NormalizedLegacyBookmark,
  NormalizedLegacyLibrary,
} from "./legacy-types.js";

const MEDIA_CACHE_DIR = "media-cache";
const MAX_IMPORT_CATEGORY_LEVELS = 3;

export interface LegacyApplyDeps {
  db: Database;
  dataDir: string;
  queue?: JobQueue;
  /** When true, merge into existing URLs instead of skipping. Default: skip. */
  mergeDuplicates?: boolean;
  /** When false, skip enqueueing ingest jobs. Default: true. */
  enqueueIngest?: boolean;
  /** When true, compute the apply summary without writing to the library. */
  dryRun?: boolean;
}

function pathKey(path: string[]): string {
  return path.map((p) => p.trim().toLowerCase()).join("\0");
}

function resolveCachePath(dataDir: string, relativePath: string): string {
  return join(dataDir, relativePath);
}

function mediaUrl(bookmarkId: string, mediaId: string): string {
  return `/media/bookmarks/${bookmarkId}/${mediaId}`;
}

function detectMediaType(path: string): string {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function maxBytesFor(kind: "favicon" | "image" | "screenshot"): number {
  if (kind === "favicon") return MEDIA_CACHE_LIMITS.maxFaviconBytes;
  if (kind === "screenshot") return MEDIA_CACHE_LIMITS.maxScreenshotBytes;
  return MEDIA_CACHE_LIMITS.maxImageBytes;
}

function sourceHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function importLocalMedia(
  db: Database,
  dataDir: string,
  bookmarkId: string,
  bookmark: NormalizedLegacyBookmark,
  summary: LegacyApplySummary
): Promise<void> {
  const bookmarkDir = join(MEDIA_CACHE_DIR, "bookmarks", bookmarkId);
  await mkdir(resolveCachePath(dataDir, bookmarkDir), { recursive: true });

  let imageOrder = 0;
  for (const item of bookmark.media) {
    if (!item.absolutePath || !existsSync(item.absolutePath)) {
      summary.mediaSkipped += 1;
      continue;
    }

    let sizeBytes = 0;
    try {
      sizeBytes = statSync(item.absolutePath).size;
    } catch {
      summary.mediaSkipped += 1;
      continue;
    }

    if (sizeBytes <= 0 || sizeBytes > maxBytesFor(item.kind)) {
      summary.mediaSkipped += 1;
      summary.warnings.push(
        `Skipped ${item.kind} for ${bookmark.url}: size ${sizeBytes} outside allowed range`
      );
      continue;
    }

    const bytes = new Uint8Array(await Bun.file(item.absolutePath).arrayBuffer());
    const mediaType = detectMediaType(item.absolutePath);
    if (!mediaType.startsWith("image/") || mediaType.includes("svg")) {
      summary.mediaSkipped += 1;
      continue;
    }

    const sourceUrl = item.sourceUrl ?? `legacy://${bookmark.sourceId}/${item.filename}`;
    const existingMedia = db
      .query<{ id: string }, [string, string, string]>(
        `SELECT id FROM bookmark_media
         WHERE bookmark_id = ? AND kind = ? AND source_url = ?`
      )
      .get(bookmarkId, item.kind, sourceUrl);
    if (existingMedia) {
      summary.mediaSkipped += 1;
      continue;
    }

    const id = randomUUID();
    const displayOrder = item.kind === "image" ? imageOrder++ : 0;
    const cachePath = join(
      bookmarkDir,
      `${item.kind}-${displayOrder}-${sourceHash(item.absolutePath)}${extname(item.absolutePath) || ".img"}`
    );
    await Bun.write(resolveCachePath(dataDir, cachePath), bytes);

    db.query(
      `INSERT INTO bookmark_media
         (id, bookmark_id, kind, source_url, cache_path, media_type, size_bytes, alt, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      bookmarkId,
      item.kind,
      sourceUrl,
      cachePath,
      mediaType,
      bytes.byteLength,
      null,
      displayOrder
    );

    const url = mediaUrl(bookmarkId, id);
    if (item.kind === "favicon") {
      db.query("UPDATE bookmarks SET favicon_url = ? WHERE id = ?").run(url, bookmarkId);
    } else if (item.kind === "screenshot") {
      db.query("UPDATE bookmarks SET screenshot_url = ? WHERE id = ?").run(url, bookmarkId);
    }

    summary.mediaImported += 1;
  }
}

function upsertBookmarkContent(
  db: Database,
  bookmarkId: string,
  bookmark: NormalizedLegacyBookmark
): void {
  if (!bookmark.contentHtml && !bookmark.contentText && !bookmark.author && !bookmark.publishedAt) {
    return;
  }

  db.query(
    `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown, author, published_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(bookmark_id) DO UPDATE SET
       raw_html = COALESCE(excluded.raw_html, bookmark_content.raw_html),
       markdown = COALESCE(excluded.markdown, bookmark_content.markdown),
       author = COALESCE(excluded.author, bookmark_content.author),
       published_at = COALESCE(excluded.published_at, bookmark_content.published_at)`
  ).run(
    bookmarkId,
    bookmark.contentHtml,
    bookmark.contentText,
    bookmark.author,
    bookmark.publishedAt
  );
}

function applyParityFields(
  db: Database,
  bookmarkId: string,
  bookmark: NormalizedLegacyBookmark
): void {
  db.query(
    `UPDATE bookmarks
     SET description = COALESCE(?, description),
         is_pinned = ?,
         is_archived = ?,
         read_at = ?,
         notes = COALESCE(?, notes),
         opened_count = ?,
         last_opened_at = ?,
         favicon_url = COALESCE(favicon_url, ?),
         created_at = COALESCE(?, created_at),
         updated_at = COALESCE(?, updated_at)
     WHERE id = ?`
  ).run(
    bookmark.description,
    bookmark.isPinned ? 1 : 0,
    bookmark.isArchived ? 1 : 0,
    bookmark.readAt,
    bookmark.notes,
    bookmark.openedCount,
    bookmark.lastOpenedAt,
    bookmark.faviconUrl,
    bookmark.createdAt,
    bookmark.updatedAt,
    bookmarkId
  );
}

function ensureCategoryPath(
  path: string[],
  categoryRepo: CategoryRepository,
  cache: Map<string, string>,
  stats: { created: number; reused: number },
  metadataByPath: Map<string, NormalizedLegacyLibrary["categories"][number]>
): string | null {
  if (path.length === 0) return null;
  const limited = path.slice(0, MAX_IMPORT_CATEGORY_LEVELS);
  let parentId: string | null = null;
  const built: string[] = [];

  for (const name of limited) {
    built.push(name);
    const key = pathKey(built);
    const cached = cache.get(key);
    if (cached) {
      parentId = cached;
      continue;
    }

    const existing = categoryRepo
      .listFlat()
      .find(
        (c) =>
          c.name.trim().toLowerCase() === name.trim().toLowerCase() &&
          (c.parent_id ?? null) === parentId
      );

    if (existing) {
      cache.set(key, existing.id);
      parentId = existing.id;
      stats.reused += 1;
      continue;
    }

    const meta = metadataByPath.get(key);
    const created = categoryRepo.create(name, parentId, {
      color: meta?.color ?? null,
      icon: meta?.icon ?? null,
      description: meta?.description ?? null,
      slug: meta?.slug || null,
      is_archived: meta?.isArchived ? 1 : 0,
      is_public: meta?.isPublic ? 1 : 0,
    });
    cache.set(key, created.id);
    parentId = created.id;
    stats.created += 1;
  }

  return parentId;
}

function savepointName(index: number): string {
  return `legacy_migrate_bm_${index}`;
}

function beginSavepoint(db: Database, name: string): void {
  db.exec(`SAVEPOINT ${name}`);
}

function releaseSavepoint(db: Database, name: string): void {
  db.exec(`RELEASE SAVEPOINT ${name}`);
}

function rollbackSavepoint(db: Database, name: string): void {
  db.exec(`ROLLBACK TO SAVEPOINT ${name}`);
  db.exec(`RELEASE SAVEPOINT ${name}`);
}

function emptySummary(
  owner: NormalizedLegacyLibrary["owner"],
  dryRun: boolean,
  warnings: string[]
): LegacyApplySummary {
  return {
    owner,
    dryRun,
    categoriesCreated: 0,
    categoriesReused: 0,
    tagsCreated: 0,
    tagsReused: 0,
    bookmarksCreated: 0,
    bookmarksMerged: 0,
    bookmarksSkipped: 0,
    bookmarksFailed: 0,
    mediaImported: 0,
    mediaSkipped: 0,
    warnings,
  };
}

function mediaWouldImport(item: NormalizedLegacyBookmark["media"][number]): boolean {
  if (!item.absolutePath || !existsSync(item.absolutePath)) return false;
  let sizeBytes = 0;
  try {
    sizeBytes = statSync(item.absolutePath).size;
  } catch {
    return false;
  }
  if (sizeBytes <= 0 || sizeBytes > maxBytesFor(item.kind)) return false;
  const mediaType = detectMediaType(item.absolutePath);
  return mediaType.startsWith("image/") && !mediaType.includes("svg");
}

/**
 * Plan category path creation without writing. Uses synthetic IDs for
 * not-yet-created nodes so sibling paths share planned parents correctly.
 */
function planCategoryPath(
  path: string[],
  categoryRepo: CategoryRepository,
  cache: Map<string, string>,
  stats: { created: number; reused: number }
): void {
  if (path.length === 0) return;
  const limited = path.slice(0, MAX_IMPORT_CATEGORY_LEVELS);
  let parentId: string | null = null;
  const built: string[] = [];

  for (const name of limited) {
    built.push(name);
    const key = pathKey(built);
    const cached = cache.get(key);
    if (cached) {
      parentId = cached;
      continue;
    }

    const existing = categoryRepo.findByNameAndParent(name, parentId);
    if (existing) {
      cache.set(key, existing.id);
      parentId = existing.id;
      stats.reused += 1;
      continue;
    }

    const plannedId = `dry-run:${key}`;
    cache.set(key, plannedId);
    parentId = plannedId;
    stats.created += 1;
  }
}

function countMediaPlan(
  bookmark: NormalizedLegacyBookmark,
  summary: LegacyApplySummary
): void {
  for (const item of bookmark.media) {
    if (mediaWouldImport(item)) summary.mediaImported += 1;
    else summary.mediaSkipped += 1;
  }
}

function simulateLegacyLibrary(
  library: NormalizedLegacyLibrary,
  deps: LegacyApplyDeps
): LegacyApplySummary {
  const bookmarkRepo = new BookmarkRepository(deps.db, { dataDir: deps.dataDir });
  const categoryRepo = new CategoryRepository(deps.db);
  const tagRepo = new TagRepository(deps.db);
  const mergeDuplicates = deps.mergeDuplicates === true;

  const summary = emptySummary(library.owner, true, [
    "Dry run — no changes were written to the local library.",
    ...library.warnings,
  ]);
  summary.bookmarksSkipped = library.skippedBookmarks.length;

  for (const skipped of library.skippedBookmarks) {
    summary.warnings.push(
      `Skipped bookmark ${skipped.sourceId}${skipped.url ? ` (${skipped.url})` : ""}: ${skipped.reason}`
    );
  }

  const categoryCache = new Map<string, string>();
  const categoryStats = { created: 0, reused: 0 };

  for (const category of library.categories) {
    planCategoryPath(category.path, categoryRepo, categoryCache, categoryStats);
  }

  for (const tag of library.tags) {
    if (tagRepo.findByName(tag.name)) summary.tagsReused += 1;
    else summary.tagsCreated += 1;
  }

  // Track URLs that would be created during this dry-run so later duplicates
  // within the same library are counted as merge/skip against the planned set.
  const plannedUrls = new Set<string>();

  for (const bookmark of library.bookmarks) {
    planCategoryPath(bookmark.categoryPath, categoryRepo, categoryCache, categoryStats);

    const existing = bookmarkRepo.findByUrl(bookmark.url) || plannedUrls.has(bookmark.url);
    if (existing) {
      if (!mergeDuplicates) {
        summary.bookmarksSkipped += 1;
        continue;
      }
      summary.bookmarksMerged += 1;
      countMediaPlan(bookmark, summary);
      continue;
    }

    plannedUrls.add(bookmark.url);
    summary.bookmarksCreated += 1;
    countMediaPlan(bookmark, summary);
  }

  summary.categoriesCreated = categoryStats.created;
  summary.categoriesReused = categoryStats.reused;
  return summary;
}

export async function applyLegacyLibrary(
  library: NormalizedLegacyLibrary,
  deps: LegacyApplyDeps
): Promise<LegacyApplySummary> {
  if (deps.dryRun) {
    return simulateLegacyLibrary(library, deps);
  }

  const bookmarkRepo = new BookmarkRepository(deps.db, { dataDir: deps.dataDir });
  const categoryRepo = new CategoryRepository(deps.db);
  const tagRepo = new TagRepository(deps.db);
  const mergeDuplicates = deps.mergeDuplicates === true;
  const enqueueIngest = deps.enqueueIngest !== false;

  const summary = emptySummary(library.owner, false, [...library.warnings]);
  summary.bookmarksSkipped = library.skippedBookmarks.length;

  for (const skipped of library.skippedBookmarks) {
    summary.warnings.push(
      `Skipped bookmark ${skipped.sourceId}${skipped.url ? ` (${skipped.url})` : ""}: ${skipped.reason}`
    );
  }

  const categoryCache = new Map<string, string>();
  const categoryStats = { created: 0, reused: 0 };
  const metadataByPath = new Map(
    library.categories.map((c) => [pathKey(c.path), c] as const)
  );

  for (const category of library.categories) {
    ensureCategoryPath(
      category.path,
      categoryRepo,
      categoryCache,
      categoryStats,
      metadataByPath
    );
  }
  summary.categoriesCreated = categoryStats.created;
  summary.categoriesReused = categoryStats.reused;

  for (const tag of library.tags) {
    const existing = tagRepo.findByName(tag.name);
    if (existing) summary.tagsReused += 1;
    else {
      tagRepo.upsert(tag.name);
      summary.tagsCreated += 1;
    }
  }

  const pendingIngest: Array<{ bookmarkId: string; url: string }> = [];

  for (let index = 0; index < library.bookmarks.length; index += 1) {
    const bookmark = library.bookmarks[index];
    const existing = bookmarkRepo.findByUrl(bookmark.url);
    if (existing && !mergeDuplicates) {
      summary.bookmarksSkipped += 1;
      continue;
    }

    const sp = savepointName(index);
    const mediaBefore = { imported: summary.mediaImported, skipped: summary.mediaSkipped };
    const categoryStatsBefore = { created: categoryStats.created, reused: categoryStats.reused };
    beginSavepoint(deps.db, sp);
    try {
      const categoryId = ensureCategoryPath(
        bookmark.categoryPath,
        categoryRepo,
        categoryCache,
        categoryStats,
        metadataByPath
      );

      let bookmarkId: string;
      let createdNew = false;

      if (existing) {
        bookmarkRepo.mergeImportDuplicate(existing.id, {
          tags: bookmark.tags,
          category_id: categoryId,
          notes: bookmark.notes,
          restore: existing.is_trashed === 1 || existing.is_archived === 1,
        });
        bookmarkId = existing.id;
        applyParityFields(deps.db, bookmarkId, bookmark);
        upsertBookmarkContent(deps.db, bookmarkId, bookmark);
      } else {
        const created = bookmarkRepo.create(bookmark.url, bookmark.title, categoryId);
        bookmarkId = created.id;
        createdNew = true;
        if (bookmark.tags.length > 0) {
          bookmarkRepo.setTags(bookmarkId, bookmark.tags);
        }
        applyParityFields(deps.db, bookmarkId, bookmark);
        upsertBookmarkContent(deps.db, bookmarkId, bookmark);
      }

      await importLocalMedia(deps.db, deps.dataDir, bookmarkId, bookmark, summary);
      releaseSavepoint(deps.db, sp);

      if (createdNew) {
        summary.bookmarksCreated += 1;
        if (enqueueIngest && deps.queue) {
          pendingIngest.push({ bookmarkId, url: bookmark.url });
        }
      } else {
        summary.bookmarksMerged += 1;
      }
    } catch (err) {
      try {
        rollbackSavepoint(deps.db, sp);
      } catch {
        // If rollback fails (connection closed), surface the original error below.
      }
      // Counters mutated inside the savepoint must be restored after rollback.
      summary.mediaImported = mediaBefore.imported;
      summary.mediaSkipped = mediaBefore.skipped;
      categoryStats.created = categoryStatsBefore.created;
      categoryStats.reused = categoryStatsBefore.reused;
      // Category cache may reference rows rolled back with this bookmark — clear it.
      categoryCache.clear();
      summary.bookmarksFailed += 1;
      summary.warnings.push(
        `Failed ${bookmark.url}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  for (const job of pendingIngest) {
    deps.queue?.enqueue("ingest", { bookmarkId: job.bookmarkId, url: job.url });
  }

  summary.categoriesCreated = categoryStats.created;
  summary.categoriesReused = categoryStats.reused;
  return summary;
}
