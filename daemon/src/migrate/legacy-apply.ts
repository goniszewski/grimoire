import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { extname, join } from "path";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { ensureBookmarksUpdatedAtTrigger } from "../db/bookmarks-updated-at-trigger.js";
import { CategoryRepository } from "../db/category-repository.js";
import { TagRepository } from "../db/tag-repository.js";
import type { JobQueue } from "../queue.js";
import { combineFtsSummary } from "../lib/fts-summary.js";
import { cleanupOrphanBookmarkMedia } from "../media/cleanup-orphan-bookmark-media.js";
import { limitImportCategoryPath, canonicalUrlKey } from "./legacy-normalize.js";
import type {
  LegacyApplySummary,
  NormalizedLegacyBookmark,
  NormalizedLegacyLibrary,
} from "./legacy-types.js";
import type { BookmarkRow } from "../db/types.js";

/**
 * Index local bookmarks by migrate-canonical URL so mixed-case 1.x hosts
 * (`https://Example.com/x`) match migrated lowercase hosts.
 */
function buildCanonicalUrlIndex(db: Database): Map<string, BookmarkRow> {
  const index = new Map<string, BookmarkRow>();
  const rows = db.query<BookmarkRow, []>("SELECT * FROM bookmarks").all();
  for (const row of rows) {
    const key = canonicalUrlKey(row.url);
    if (!index.has(key)) index.set(key, row);
  }
  return index;
}

function findExistingByCanonicalUrl(
  bookmarkRepo: BookmarkRepository,
  urlIndex: Map<string, BookmarkRow>,
  url: string
): BookmarkRow | null {
  const exact = bookmarkRepo.findByUrl(url);
  if (exact) return exact;
  return urlIndex.get(canonicalUrlKey(url)) ?? null;
}

const MEDIA_CACHE_DIR = "media-cache";

/** Local-copy caps for migrate (higher than live fetch limits — files already on disk). */
export const LEGACY_MIGRATE_MEDIA_LIMITS = {
  maxFaviconBytes: 1024 * 1024,
  maxImageBytes: 10 * 1024 * 1024,
  maxScreenshotBytes: 25 * 1024 * 1024,
} as const;

function sourceHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

/** Stable cache identity for migrated media (survives eviction preference + dedupe). */
export function legacyMediaSourceUrl(
  bookmark: Pick<NormalizedLegacyBookmark, "sourceId">,
  item: NormalizedLegacyBookmark["media"][number]
): string {
  const pathKey = item.stableKey || item.filename;
  return `legacy://${bookmark.sourceId}/${item.kind}/${sourceHash(pathKey)}/${item.filename}`;
}

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

function detectMediaTypeByExtension(path: string): string | null {
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
    case ".svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

/** Sniff common image magic bytes (used for extensionless v0.5 upload paths). */
function sniffImageMediaType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // ISO BMFF (AVIF/HEIF): size + 'ftyp' + major/compatible brands
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const end = Math.min(bytes.length, 64);
    for (let i = 8; i + 4 <= end; i += 4) {
      const brand = String.fromCharCode(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  // ICO / CUR: reserved=0, type=1 (icon) or 2 (cursor)
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    (bytes[2] === 0x01 || bytes[2] === 0x02) &&
    bytes[3] === 0x00
  ) {
    return "image/x-icon";
  }
  return null;
}

function isSupportedImageMediaType(mediaType: string | null | undefined): mediaType is string {
  return Boolean(mediaType && mediaType.startsWith("image/") && !mediaType.includes("svg"));
}

function normalizeDeclaredImageMime(declared: string | null | undefined): string | null {
  if (!declared) return null;
  const mime = declared.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  return isSupportedImageMediaType(mime) ? mime : null;
}

function detectMediaType(
  path: string,
  bytes?: Uint8Array,
  declaredMime?: string | null
): string {
  // When bytes are available, trust magic-byte sniff over extension so a
  // hardlinked / renamed non-image (e.g. secret.bin → icon.png) cannot import.
  if (bytes && bytes.byteLength > 0) {
    const sniffed = sniffImageMediaType(bytes);
    if (isSupportedImageMediaType(sniffed)) return sniffed;
    return sniffed ?? "application/octet-stream";
  }
  return (
    detectMediaTypeByExtension(path) ??
    normalizeDeclaredImageMime(declaredMime) ??
    "application/octet-stream"
  );
}

function extensionForMediaType(mediaType: string, sourcePath: string): string {
  const fromPath = extname(sourcePath);
  if (fromPath) return fromPath;
  switch (mediaType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    case "image/x-icon":
      return ".ico";
    default:
      return ".img";
  }
}

function maxBytesFor(kind: "favicon" | "image" | "screenshot"): number {
  if (kind === "favicon") return LEGACY_MIGRATE_MEDIA_LIMITS.maxFaviconBytes;
  if (kind === "screenshot") return LEGACY_MIGRATE_MEDIA_LIMITS.maxScreenshotBytes;
  return LEGACY_MIGRATE_MEDIA_LIMITS.maxImageBytes;
}

/**
 * Copy local v0.5 media into the 1.x cache. Fully synchronous so it can run
 * inside a SAVEPOINT without yielding the shared SQLite connection.
 * Per-item failures soft-skip so one bad file does not abort the bookmark.
 */
function importLocalMedia(
  db: Database,
  dataDir: string,
  bookmarkId: string,
  bookmark: NormalizedLegacyBookmark,
  summary: LegacyApplySummary
): string[] {
  const bookmarkDir = join(MEDIA_CACHE_DIR, "bookmarks", bookmarkId);
  try {
    mkdirSync(resolveCachePath(dataDir, bookmarkDir), { recursive: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    for (const item of bookmark.media) {
      summary.mediaSkipped += 1;
      summary.warnings.push(
        `Skipped ${item.kind} for ${bookmark.url}: media import failed (${detail})`
      );
    }
    return [];
  }
  const writtenPaths: string[] = [];

  let imageOrder = 0;
  for (const item of bookmark.media) {
    const pathsBefore = writtenPaths.length;
    try {
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

      const bytes = new Uint8Array(readFileSync(item.absolutePath));
      const mediaType = detectMediaType(item.absolutePath, bytes, item.declaredMimeType);
      if (!isSupportedImageMediaType(mediaType)) {
        summary.mediaSkipped += 1;
        summary.warnings.push(
          `Skipped ${item.kind} for ${bookmark.url}: unsupported media type ${mediaType} (${item.filename})`
        );
        continue;
      }

      const sourceUrl = legacyMediaSourceUrl(bookmark, item);
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
        `${item.kind}-${displayOrder}-${sourceHash(item.stableKey || item.absolutePath || item.filename)}${extensionForMediaType(mediaType, item.absolutePath)}`
      );
      const absoluteCache = resolveCachePath(dataDir, cachePath);
      writtenPaths.push(absoluteCache);
      writeFileSync(absoluteCache, bytes);

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
        // Promote curated local file over blank or the remote legacy icon_url, but do
        // not clobber a different user-chosen primary (e.g. CDN URL set after import).
        db.query(
          `UPDATE bookmarks
           SET favicon_url = CASE
             WHEN favicon_url IS NULL OR favicon_url = ? THEN ?
             ELSE favicon_url
           END
           WHERE id = ?`
        ).run(bookmark.faviconUrl, url, bookmarkId);
      } else if (item.kind === "screenshot") {
        db.query(
          "UPDATE bookmarks SET screenshot_url = COALESCE(screenshot_url, ?) WHERE id = ?"
        ).run(url, bookmarkId);
      }

      summary.mediaImported += 1;
    } catch (err) {
      while (writtenPaths.length > pathsBefore) {
        const orphan = writtenPaths.pop();
        if (!orphan) break;
        try {
          unlinkSync(orphan);
        } catch {
          // best-effort orphan cleanup
        }
      }
      summary.mediaSkipped += 1;
      const detail = err instanceof Error ? err.message : String(err);
      summary.warnings.push(
        `Skipped ${item.kind} for ${bookmark.url}: media import failed (${detail})`
      );
    }
  }

  return writtenPaths;
}

function htmlToSearchableMarkdown(html: string): string {
  const strip = (value: string): string =>
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();

  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${strip(t)}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${strip(t)}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${strip(t)}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${strip(t)}\n`)
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n${strip(t)}\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function rebuildBookmarkFts(db: Database, bookmarkId: string): void {
  const contentRow = db
    .query<{ markdown: string | null; summary: string | null }, [string]>(
      "SELECT markdown, summary FROM bookmark_content WHERE bookmark_id = ?"
    )
    .get(bookmarkId);
  const row = db
    .query<{ title: string | null; description: string | null }, [string]>(
      "SELECT title, description FROM bookmarks WHERE id = ?"
    )
    .get(bookmarkId);
  const tags =
    db
      .query<{ tags: string | null }, [string]>(
        `SELECT GROUP_CONCAT(t.name, ' ') AS tags
         FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?`
      )
      .get(bookmarkId)?.tags ?? "";
  const ftsSummary = combineFtsSummary(row?.description, contentRow?.summary);
  db.run(`DELETE FROM bookmarks_fts WHERE bookmark_id = ?`, [bookmarkId]);
  db.run(
    `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
     VALUES (?, ?, ?, ?, ?)`,
    [bookmarkId, row?.title ?? "", ftsSummary, tags, contentRow?.markdown ?? ""]
  );
}

function upsertBookmarkContent(
  db: Database,
  bookmarkId: string,
  bookmark: NormalizedLegacyBookmark,
  options?: { preferExisting?: boolean }
): void {
  if (!bookmark.contentHtml && !bookmark.contentText && !bookmark.author && !bookmark.publishedAt) {
    return;
  }

  const markdown =
    bookmark.contentText ??
    (bookmark.contentHtml ? htmlToSearchableMarkdown(bookmark.contentHtml) : null);
  if (!markdown && !bookmark.contentHtml && !bookmark.author && !bookmark.publishedAt) {
    return;
  }

  const preferExisting = options?.preferExisting === true;
  if (preferExisting) {
    const existing = db
      .query<{ raw_html: string | null; markdown: string | null }, [string]>(
        "SELECT raw_html, markdown FROM bookmark_content WHERE bookmark_id = ?"
      )
      .get(bookmarkId);
    const existingTitle =
      db
        .query<{ title: string | null }, [string]>(
          "SELECT title FROM bookmarks WHERE id = ?"
        )
        .get(bookmarkId)
        ?.title?.trim() ?? "";

    const existingMarkdown = existing?.markdown?.trim() ?? "";
    // Pipeline extract-failure stubs store markdown = existingTitle ?? url.
    // Those are not "richer local content" — allow legacy HTML/text to fill on --merge.
    const markdownIsStub =
      !existingMarkdown ||
      existingMarkdown === bookmark.url.trim() ||
      (existingTitle.length > 0 && existingMarkdown === existingTitle);
    const nextMarkdown = markdownIsStub
      ? (markdown ?? existing?.markdown ?? null)
      : (existing?.markdown ?? markdown);
    const nextHtml = markdownIsStub
      ? (bookmark.contentHtml ?? existing?.raw_html ?? null)
      : (existing?.raw_html ?? bookmark.contentHtml ?? null);

    db.query(
      `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown, author, published_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(bookmark_id) DO UPDATE SET
         raw_html = excluded.raw_html,
         markdown = excluded.markdown,
         author = COALESCE(bookmark_content.author, excluded.author),
         published_at = COALESCE(bookmark_content.published_at, excluded.published_at)`
    ).run(bookmarkId, nextHtml, nextMarkdown, bookmark.author, bookmark.publishedAt);
  } else {
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
      markdown,
      bookmark.author,
      bookmark.publishedAt
    );
  }

  // Content triggers may set FTS summary from bookmark_content.summary alone;
  // rebuild so description tokens stay searchable too.
  rebuildBookmarkFts(db, bookmarkId);
}

function applyParityFields(
  db: Database,
  bookmarkId: string,
  bookmark: NormalizedLegacyBookmark,
  options?: { skipNotes?: boolean; mergeExisting?: boolean }
): void {
  if (options?.mergeExisting) {
  // Prefer preserving richer 1.x activity state when re-merging a URL that
  // already exists in the local library (e.g. user opened it after first import).
  // Pin/archive are left untouched so local unpin/unarchive survives --merge.
    db.query(
      `UPDATE bookmarks
       SET description = CASE
             WHEN description IS NULL OR trim(description) = '' THEN COALESCE(?, description)
             ELSE description
           END,
           read_at = CASE
             WHEN read_at IS NULL THEN ?
             WHEN ? IS NULL THEN read_at
             WHEN read_at >= ? THEN read_at
             ELSE ?
           END,
           notes = CASE WHEN ? THEN notes ELSE COALESCE(?, notes) END,
           opened_count = MAX(opened_count, ?),
           last_opened_at = CASE
             WHEN last_opened_at IS NULL THEN ?
             WHEN ? IS NULL THEN last_opened_at
             WHEN last_opened_at >= ? THEN last_opened_at
             ELSE ?
           END,
           favicon_url = COALESCE(favicon_url, ?),
           created_at = CASE
             WHEN created_at IS NULL THEN ?
             WHEN ? IS NULL THEN created_at
             WHEN created_at <= ? THEN created_at
             ELSE ?
           END,
           updated_at = CASE
             WHEN updated_at IS NULL THEN ?
             WHEN ? IS NULL THEN updated_at
             WHEN updated_at >= ? THEN updated_at
             ELSE ?
           END,
           title = CASE
             WHEN title IS NULL OR trim(title) = '' OR title = url THEN COALESCE(?, title)
             ELSE title
           END
       WHERE id = ?`
    ).run(
      bookmark.description,
      bookmark.readAt,
      bookmark.readAt,
      bookmark.readAt,
      bookmark.readAt,
      options?.skipNotes ? 1 : 0,
      bookmark.notes,
      bookmark.openedCount,
      bookmark.lastOpenedAt,
      bookmark.lastOpenedAt,
      bookmark.lastOpenedAt,
      bookmark.lastOpenedAt,
      bookmark.faviconUrl,
      bookmark.createdAt,
      bookmark.createdAt,
      bookmark.createdAt,
      bookmark.createdAt,
      bookmark.updatedAt,
      bookmark.updatedAt,
      bookmark.updatedAt,
      bookmark.updatedAt,
      bookmark.title,
      bookmarkId
    );
    // Migration 0018 made bookmarks UPDATE title-only in FTS; sync summary now.
    rebuildBookmarkFts(db, bookmarkId);
    return;
  }

  db.query(
    `UPDATE bookmarks
     SET description = COALESCE(?, description),
         is_pinned = ?,
         is_archived = ?,
         read_at = ?,
         notes = CASE WHEN ? THEN notes ELSE COALESCE(?, notes) END,
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
    options?.skipNotes ? 1 : 0,
    bookmark.notes,
    bookmark.openedCount,
    bookmark.lastOpenedAt,
    bookmark.faviconUrl,
    bookmark.createdAt,
    bookmark.updatedAt,
    bookmarkId
  );
  // Description-only imports never hit upsertBookmarkContent; index description here.
  rebuildBookmarkFts(db, bookmarkId);
}

function ensureCategoryPath(
  path: string[],
  categoryRepo: CategoryRepository,
  cache: Map<string, string>,
  stats: { created: number; reused: number },
  metadataByPath: Map<string, NormalizedLegacyLibrary["categories"][number]>,
  touchedKeys?: Set<string>
): string | null {
  if (path.length === 0) return null;
  const limited = limitImportCategoryPath(path);
  let parentId: string | null = null;
  const built: string[] = [];

  const remember = (key: string, id: string): void => {
    cache.set(key, id);
    touchedKeys?.add(key);
  };

  for (const name of limited) {
    const cleaned = name.trim();
    if (!cleaned) continue;
    built.push(cleaned);
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
          c.name.trim().toLowerCase() === cleaned.toLowerCase() &&
          (c.parent_id ?? null) === parentId
      );

    if (existing) {
      const meta = metadataByPath.get(key);
      if (meta) {
        // Fill blanks only — do not overwrite local category customization.
        const patch: {
          color?: string | null;
          icon?: string | null;
          description?: string | null;
          slug?: string | null;
        } = {};
        if (!existing.color && meta.color) patch.color = meta.color;
        if (!existing.icon && meta.icon) patch.icon = meta.icon;
        if (!existing.description && meta.description) patch.description = meta.description;
        // Never flip local archive/public flags on reuse — that can hide or publish
        // an existing 1.x category during migrate.
        // Skip slug fill-on-reuse: global unique index can fail the whole bookmark.
        if (Object.keys(patch).length > 0) {
          categoryRepo.update(existing.id, patch);
        }
      }
      remember(key, existing.id);
      parentId = existing.id;
      stats.reused += 1;
      continue;
    }

    const meta = metadataByPath.get(key);
    let created;
    try {
      created = categoryRepo.create(cleaned, parentId, {
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
        description: meta?.description ?? null,
        // Slug is globally unique in 1.x; omit on conflict risk and let 1.x
        // derive display identity from name + parent.
        slug: meta?.slug || null,
        is_archived: meta?.isArchived ? 1 : 0,
        is_public: meta?.isPublic ? 1 : 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/UNIQUE|unique/i.test(message)) throw err;
      created = categoryRepo.create(cleaned, parentId, {
        color: meta?.color ?? null,
        icon: meta?.icon ?? null,
        description: meta?.description ?? null,
        slug: null,
        is_archived: meta?.isArchived ? 1 : 0,
        is_public: meta?.isPublic ? 1 : 0,
      });
    }
    remember(key, created.id);
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
  // Prefer sniff over extension so renamed/hardlinked non-images are not planned.
  // Match apply: unreadable files are skipped (importLocalMedia catch), not planned
  // via extension/declared MIME — otherwise dry-run over-counts mediaImported.
  try {
    const fd = openSync(item.absolutePath, "r");
    try {
      // Match sniffImageMediaType's AVIF brand window (scans through 64 bytes).
      const header = Buffer.alloc(64);
      const n = readSync(fd, header, 0, 64, 0);
      const sniffed = sniffImageMediaType(header.subarray(0, n));
      if (isSupportedImageMediaType(sniffed)) return true;
      if (n > 0) return false;
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
  return isSupportedImageMediaType(
    detectMediaTypeByExtension(item.absolutePath) ??
      normalizeDeclaredImageMime(item.declaredMimeType)
  );
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
  const limited = limitImportCategoryPath(path);
  let parentId: string | null = null;
  const built: string[] = [];

  for (const name of limited) {
    const cleaned = name.trim();
    if (!cleaned) continue;
    built.push(cleaned);
    const key = pathKey(built);
    const cached = cache.get(key);
    if (cached) {
      parentId = cached;
      continue;
    }

    const existing = categoryRepo.findByNameAndParent(cleaned, parentId);
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
  summary: LegacyApplySummary,
  options?: { db?: Database; existingBookmarkId?: string | null }
): void {
  for (const item of bookmark.media) {
    if (!mediaWouldImport(item)) {
      summary.mediaSkipped += 1;
      continue;
    }
    const existingBookmarkId = options?.existingBookmarkId;
    if (existingBookmarkId && options?.db) {
      const sourceUrl = legacyMediaSourceUrl(bookmark, item);
      const existingMedia = options.db
        .query<{ id: string }, [string, string, string]>(
          `SELECT id FROM bookmark_media
           WHERE bookmark_id = ? AND kind = ? AND source_url = ?`
        )
        .get(existingBookmarkId, item.kind, sourceUrl);
      if (existingMedia) {
        summary.mediaSkipped += 1;
        continue;
      }
    }
    summary.mediaImported += 1;
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

  // Only plan taxonomy referenced by importable bookmarks — avoid counting
  // orphan categories/tags when every bookmark is skipped.
  const plannedUrls = new Set<string>();
  const plannedTags = new Set<string>();
  const urlIndex = buildCanonicalUrlIndex(deps.db);

  for (const bookmark of library.bookmarks) {
    const existingRow = findExistingByCanonicalUrl(bookmarkRepo, urlIndex, bookmark.url);
    const plannedDup = plannedUrls.has(bookmark.url);
    const mergeExistingRow =
      Boolean(existingRow) &&
      (mergeDuplicates || existingRow!.is_trashed === 1);

    if (existingRow && !mergeExistingRow) {
      summary.bookmarksSkipped += 1;
      summary.warnings.push(
        `Skipped existing URL ${bookmark.url} (pass --merge to combine notes/tags/media)`
      );
      continue;
    }

    // Match apply: only plan taxonomy for bookmarks that will create or merge.
    planCategoryPath(bookmark.categoryPath, categoryRepo, categoryCache, categoryStats);

    for (const tagName of bookmark.tags) {
      const key = tagName.trim().toLowerCase();
      if (!key || plannedTags.has(key)) continue;
      plannedTags.add(key);
      if (tagRepo.findByName(tagName)) summary.tagsReused += 1;
      else summary.tagsCreated += 1;
    }

    if (mergeExistingRow) {
      if (existingRow!.is_trashed === 1 && !mergeDuplicates) {
        summary.warnings.push(
          `Restoring trashed duplicate for ${bookmark.url} during migrate (equivalent to --merge for trash)`
        );
      }
      summary.bookmarksMerged += 1;
      countMediaPlan(bookmark, summary, {
        db: deps.db,
        existingBookmarkId: existingRow!.id,
      });
      continue;
    }

    if (plannedDup) {
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

  return applyLegacyLibraryWithWrites(library, deps);
}

async function applyLegacyLibraryWithWrites(
  library: NormalizedLegacyLibrary,
  deps: LegacyApplyDeps
): Promise<LegacyApplySummary> {
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
  const metadataByPath = new Map<string, NormalizedLegacyLibrary["categories"][number]>();
  for (const category of library.categories) {
    const fullKey = pathKey(category.path);
    metadataByPath.set(fullKey, category);
    const limitedKey = pathKey(limitImportCategoryPath(category.path));
    if (limitedKey === fullKey) continue;
    // Categories are sorted short→long. A deep leaf truncated to the same
    // 3-level key must not overwrite a real shallow category's archive/public
    // flags (or color/icon/slug).
    if (!metadataByPath.has(limitedKey)) {
      metadataByPath.set(limitedKey, category);
    }
  }
  const seenTags = new Set<string>();

  const pendingIngest: Array<{ bookmarkId: string; url: string }> = [];
  const applyMediaPaths: string[] = [];
  let txnOpen = false;

  try {
    deps.db.exec("BEGIN IMMEDIATE");
    txnOpen = true;
    // Keep filesystem cleanup and trigger changes under the same write lock.
    // This prevents another process from deleting media belonging to an
    // uncommitted bookmark or restoring the trigger while this apply is active.
    cleanupOrphanBookmarkMedia(deps.db, deps.dataDir);
    // Preserve legacy updated_at values written by applyParityFields.
    deps.db.exec("DROP TRIGGER IF EXISTS trg_bookmarks_updated_at");
    // Build the canonical lookup after acquiring the write lock so a second
    // process cannot commit a differently-cased duplicate between the scan and
    // this transaction.
    const urlIndex = buildCanonicalUrlIndex(deps.db);

    for (let index = 0; index < library.bookmarks.length; index += 1) {
      const bookmark = library.bookmarks[index];
      const existing = findExistingByCanonicalUrl(bookmarkRepo, urlIndex, bookmark.url);
      const mergeExisting =
        Boolean(existing) &&
        (mergeDuplicates || existing!.is_trashed === 1);
      if (existing && !mergeExisting) {
        summary.bookmarksSkipped += 1;
        summary.warnings.push(
          `Skipped existing URL ${bookmark.url} (pass --merge to combine notes/tags/media)`
        );
        continue;
      }
      if (existing && existing.is_trashed === 1 && !mergeDuplicates) {
        summary.warnings.push(
          `Restoring trashed duplicate for ${bookmark.url} during migrate (equivalent to --merge for trash)`
        );
      }

      const sp = savepointName(index);
      const mediaBefore = { imported: summary.mediaImported, skipped: summary.mediaSkipped };
      const categoryStatsBefore = { created: categoryStats.created, reused: categoryStats.reused };
      const tagsBefore = { created: summary.tagsCreated, reused: summary.tagsReused };
      const seenTagsBefore = new Set(seenTags);
      const writtenMediaPaths: string[] = [];
      // Track index inserts so a rolled-back create cannot leave a phantom merge target.
      let indexedUrlKey: string | null = null;
      const categoryKeysTouched = new Set<string>();
      beginSavepoint(deps.db, sp);
      try {
        const needsCategoryPath =
          !(existing && mergeExisting) || existing.category_id == null;
        const categoryId = needsCategoryPath
          ? ensureCategoryPath(
              bookmark.categoryPath,
              categoryRepo,
              categoryCache,
              categoryStats,
              metadataByPath,
              categoryKeysTouched
            )
          : null;

        for (const tagName of bookmark.tags) {
          const key = tagName.trim().toLowerCase();
          if (!key || seenTags.has(key)) continue;
          seenTags.add(key);
          const existingTag = tagRepo.findByName(tagName);
          if (existingTag) summary.tagsReused += 1;
          else {
            tagRepo.upsert(tagName);
            summary.tagsCreated += 1;
          }
        }

        let bookmarkId: string;
        let createdNew = false;

        if (existing && mergeExisting) {
          const merged = bookmarkRepo.mergeImportDuplicate(existing.id, {
            tags: bookmark.tags,
            // Fill category only when local has none — never overwrite a chosen category.
            category_id: existing.category_id == null ? categoryId : undefined,
            notes: bookmark.notes,
            // Restore from trash only. Local archive/unarchive is left untouched on merge
            // (applyParityFields(mergeExisting) does not write is_archived).
            restore: existing.is_trashed === 1,
          });
          if (!merged) {
            // Stale urlIndex (prior rollback) or concurrent delete — do not count as merged.
            urlIndex.delete(canonicalUrlKey(bookmark.url));
            throw new Error(`Merge target disappeared for ${bookmark.url}`);
          }
          bookmarkId = existing.id;
          // Notes were already merged by mergeImportDuplicate — do not overwrite them.
          // Also preserve richer local activity metrics when re-merging.
          applyParityFields(deps.db, bookmarkId, bookmark, {
            skipNotes: true,
            mergeExisting: true,
          });
          upsertBookmarkContent(deps.db, bookmarkId, bookmark, { preferExisting: true });
        } else {
          const created = bookmarkRepo.create(bookmark.url, bookmark.title, categoryId);
          bookmarkId = created.id;
          createdNew = true;
          indexedUrlKey = canonicalUrlKey(created.url);
          urlIndex.set(indexedUrlKey, created);
          if (bookmark.tags.length > 0) {
            bookmarkRepo.setTags(bookmarkId, bookmark.tags);
          }
          applyParityFields(deps.db, bookmarkId, bookmark);
          upsertBookmarkContent(deps.db, bookmarkId, bookmark);
        }

        // Mark the row explicitly so later Retry jobs can distinguish migrated
        // content from content produced by an ordinary live pipeline run.
        deps.db
          .query(
            `INSERT OR IGNORE INTO bookmark_provenance (bookmark_id, source)
             VALUES (?, 'legacy-v05')`
          )
          .run(bookmarkId);

        writtenMediaPaths.push(
          ...importLocalMedia(deps.db, deps.dataDir, bookmarkId, bookmark, summary)
        );
        releaseSavepoint(deps.db, sp);
        applyMediaPaths.push(...writtenMediaPaths);

        if (createdNew) {
          summary.bookmarksCreated += 1;
          if (enqueueIngest && deps.queue) {
            if (bookmark.isPrivateHost) {
              summary.warnings.push(
                `Skipped ingest for ${bookmark.url}: private/LAN host (SSRF protection)`
              );
            } else {
              // Even when curated uploads failed import, still enqueue ingest so
              // HTML/markdown/FTS can be filled. Empty media cache may gain live
              // media; successfully imported legacy:// rows stay protected.
              pendingIngest.push({ bookmarkId, url: bookmark.url });
            }
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
        if (indexedUrlKey) {
          urlIndex.delete(indexedUrlKey);
        }
        for (const path of writtenMediaPaths) {
          try {
            unlinkSync(path);
          } catch {
            // best-effort orphan cleanup
          }
        }
        // Counters mutated inside the savepoint must be restored after rollback.
        summary.mediaImported = mediaBefore.imported;
        summary.mediaSkipped = mediaBefore.skipped;
        categoryStats.created = categoryStatsBefore.created;
        categoryStats.reused = categoryStatsBefore.reused;
        summary.tagsCreated = tagsBefore.created;
        summary.tagsReused = tagsBefore.reused;
        for (const key of seenTags) {
          if (!seenTagsBefore.has(key)) seenTags.delete(key);
        }
        // Drop only cache entries touched inside this failed bookmark so prior
        // successful category mappings remain (avoids re-counting categoriesReused).
        for (const key of categoryKeysTouched) {
          categoryCache.delete(key);
        }
        summary.bookmarksFailed += 1;
        summary.warnings.push(
          `Failed ${bookmark.url}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Restore the normal trigger before releasing the SQLite write lock. If
    // the transaction rolls back, SQLite also rolls back the temporary drop.
    ensureBookmarksUpdatedAtTrigger(deps.db);
    deps.db.exec("COMMIT");
    txnOpen = false;
  } catch (err) {
    if (txnOpen) {
      try {
        deps.db.exec("ROLLBACK");
      } catch {
        // connection may already be closed
      }
      txnOpen = false;
    }
    for (const path of applyMediaPaths) {
      try {
        unlinkSync(path);
      } catch {
        // best-effort
      }
    }
    repairAfterRollback(deps.db, deps.dataDir);
    throw err;
  }

  for (const job of pendingIngest) {
    // Preserve migrated HTML/description/notes; live fetch may still fill blanks.
    deps.queue?.enqueue("ingest", {
      bookmarkId: job.bookmarkId,
      url: job.url,
      preserveExistingContent: true,
    });
  }

  summary.categoriesCreated = categoryStats.created;
  summary.categoriesReused = categoryStats.reused;
  return summary;
}

function repairAfterRollback(db: Database, dataDir: string): void {
  let repairTxnOpen = false;
  try {
    // Reacquire the write lock before inspecting the filesystem or repairing
    // the trigger. Another process may have started an apply after rollback.
    db.exec("BEGIN IMMEDIATE");
    repairTxnOpen = true;
    cleanupOrphanBookmarkMedia(db, dataDir);
    ensureBookmarksUpdatedAtTrigger(db);
    db.exec("COMMIT");
    repairTxnOpen = false;
  } catch {
    if (repairTxnOpen) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // best-effort; daemon boot repairs schema/media leftovers
      }
    }
  }
}
