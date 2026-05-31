import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { isPrivateHost } from "../lib/network.js";
import type { BookmarkMediaKind, BookmarkMediaRow } from "../db/types.js";

export interface BookmarkMediaCandidate {
  kind: BookmarkMediaKind;
  sourceUrl: string;
  alt?: string | null;
}

export interface BookmarkMediaCandidates {
  favicon: BookmarkMediaCandidate | null;
  screenshot: BookmarkMediaCandidate | null;
  images: BookmarkMediaCandidate[];
}

export interface BookmarkMediaItem {
  id: string;
  kind: BookmarkMediaKind;
  url: string;
  source_url: string;
  media_type: string;
  size_bytes: number;
  alt: string | null;
}

export interface BookmarkMediaSet {
  favicon: BookmarkMediaItem | null;
  screenshot: BookmarkMediaItem | null;
  images: BookmarkMediaItem[];
}

export const MEDIA_CACHE_LIMITS = {
  maxFaviconBytes: 128 * 1024,
  maxScreenshotBytes: 2 * 1024 * 1024,
  maxImageBytes: 1024 * 1024,
  maxImagesPerBookmark: 6,
  maxTotalBytes: 250 * 1024 * 1024,
} as const;

const MEDIA_CACHE_DIR = "media-cache";
const MEDIA_FETCH_TIMEOUT_MS = 15_000;
const MEDIA_FETCH_MAX_REDIRECTS = 5;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attrValue(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function resolveSafeMediaUrl(pageUrl: string, rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  const decoded = decodeHtmlEntities(rawUrl.trim());
  if (!decoded || decoded.startsWith("data:") || decoded.startsWith("blob:")) return null;

  try {
    const resolved = new URL(decoded, pageUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    if (isPrivateHost(resolved.hostname)) return null;
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

function firstMetaContent(html: string, ...names: string[]): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const name of names) {
    for (const tag of metas) {
      const metaName = attrValue(tag, "property") ?? attrValue(tag, "name");
      if (metaName?.toLowerCase() === name.toLowerCase()) {
        const content = attrValue(tag, "content");
        if (content) return content;
      }
    }
  }
  return null;
}

function mainImageHtml(html: string): string {
  const article =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  return article ?? html;
}

export function extractBookmarkMediaCandidates(pageUrl: string, html: string): BookmarkMediaCandidates {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  let favicon: BookmarkMediaCandidate | null = null;
  for (const tag of linkTags) {
    const rel = attrValue(tag, "rel")?.toLowerCase() ?? "";
    if (!rel.split(/\s+/).some((part) => part === "icon" || part === "shortcut" || part === "apple-touch-icon")) {
      continue;
    }
    const sourceUrl = resolveSafeMediaUrl(pageUrl, attrValue(tag, "href"));
    if (sourceUrl) {
      favicon = { kind: "favicon", sourceUrl };
      break;
    }
  }
  if (!favicon) {
    favicon = {
      kind: "favicon",
      sourceUrl: new URL("/favicon.ico", pageUrl).toString(),
    };
  }

  const screenshotUrl = resolveSafeMediaUrl(
    pageUrl,
    firstMetaContent(html, "og:image", "og:image:url", "twitter:image", "twitter:image:src")
  );

  const images: BookmarkMediaCandidate[] = [];
  const seen = new Set<string>();
  for (const tag of mainImageHtml(html).match(/<img\b[^>]*>/gi) ?? []) {
    const sourceUrl = resolveSafeMediaUrl(pageUrl, attrValue(tag, "src"));
    if (!sourceUrl || seen.has(sourceUrl) || sourceUrl === screenshotUrl) continue;
    seen.add(sourceUrl);
    images.push({
      kind: "image",
      sourceUrl,
      alt: attrValue(tag, "alt")?.trim() || null,
    });
    if (images.length >= MEDIA_CACHE_LIMITS.maxImagesPerBookmark) break;
  }

  return {
    favicon,
    screenshot: screenshotUrl ? { kind: "screenshot", sourceUrl: screenshotUrl, alt: "Page preview" } : null,
    images,
  };
}

function mediaUrl(row: Pick<BookmarkMediaRow, "bookmark_id" | "id">): string {
  return `/media/bookmarks/${row.bookmark_id}/${row.id}`;
}

function rowToItem(row: BookmarkMediaRow): BookmarkMediaItem {
  return {
    id: row.id,
    kind: row.kind,
    url: mediaUrl(row),
    source_url: row.source_url,
    media_type: row.media_type,
    size_bytes: row.size_bytes,
    alt: row.alt,
  };
}

export function listBookmarkMedia(db: Database, bookmarkId: string): BookmarkMediaSet {
  const rows = db
    .query<BookmarkMediaRow, [string]>(
      "SELECT * FROM bookmark_media WHERE bookmark_id = ? ORDER BY kind, display_order, created_at"
    )
    .all(bookmarkId);
  const items = rows.map(rowToItem);

  return {
    favicon: items.find((item) => item.kind === "favicon") ?? null,
    screenshot: items.find((item) => item.kind === "screenshot") ?? null,
    images: items.filter((item) => item.kind === "image"),
  };
}

function cacheRoot(dataDir: string): string {
  return resolve(dataDir, MEDIA_CACHE_DIR);
}

function resolveCachePath(dataDir: string, cachePath: string): string {
  const root = cacheRoot(dataDir);
  const absolute = resolve(dataDir, cachePath);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error(`Unsafe media cache path: ${cachePath}`);
  }
  return absolute;
}

function maxBytesFor(kind: BookmarkMediaKind): number {
  if (kind === "favicon") return MEDIA_CACHE_LIMITS.maxFaviconBytes;
  if (kind === "screenshot") return MEDIA_CACHE_LIMITS.maxScreenshotBytes;
  return MEDIA_CACHE_LIMITS.maxImageBytes;
}

function safeHttpMediaUrl(value: string, base?: URL): URL | null {
  let parsed: URL;
  try {
    parsed = base ? new URL(value, base) : new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (isPrivateHost(parsed.hostname)) return null;
  parsed.hash = "";
  return parsed;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function isAllowedCachedImageType(mediaType: string): boolean {
  const normalized = mediaType.split(";")[0]?.toLowerCase().trim() ?? "";
  return normalized.startsWith("image/") && !normalized.includes("svg");
}

function extensionFor(mediaType: string, sourceUrl: string): string {
  const type = mediaType.split(";")[0]?.toLowerCase().trim();
  if (type === "image/png") return ".png";
  if (type === "image/jpeg" || type === "image/jpg") return ".jpg";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "image/avif") return ".avif";
  if (type === "image/x-icon" || type === "image/vnd.microsoft.icon") return ".ico";

  try {
    const ext = new URL(sourceUrl).pathname.match(/\.(png|jpe?g|webp|gif|avif|ico)$/i)?.[0];
    return ext?.toLowerCase() ?? ".img";
  } catch {
    return ".img";
  }
}

function sourceHash(sourceUrl: string): string {
  return createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);
}

async function readResponseBytes(response: Response, limit: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function fetchMedia(candidate: BookmarkMediaCandidate): Promise<{
  bytes: Uint8Array;
  mediaType: string;
  finalUrl: string;
} | null> {
  let source = safeHttpMediaUrl(candidate.sourceUrl);
  if (!source) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);
  let response: Response | null = null;
  try {
    for (let redirectCount = 0; redirectCount <= MEDIA_FETCH_MAX_REDIRECTS; redirectCount += 1) {
      response = await fetch(source.toString(), {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,*/*;q=0.2",
          "User-Agent": "Mozilla/5.0 (compatible; LittleImp/0.0; +https://github.com/goniszewski/little-imp)",
        },
        redirect: "manual",
        signal: controller.signal,
      });

      if (!isRedirectStatus(response.status)) break;

      const nextUrl = safeHttpMediaUrl(response.headers.get("location") ?? "", source);
      await response.body?.cancel();
      if (!nextUrl) return null;
      source = nextUrl;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!response) return null;

  const finalUrl = safeHttpMediaUrl(response.url || source.toString());
  if (!finalUrl) return null;

  if (!response.ok) return null;

  const mediaType = response.headers.get("content-type") ?? "";
  const normalizedType = mediaType.split(";")[0]?.toLowerCase().trim() ?? "";
  if (!isAllowedCachedImageType(normalizedType)) return null;

  const limit = maxBytesFor(candidate.kind);
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > limit) return null;

  const bytes = await readResponseBytes(response, limit);
  if (!bytes || bytes.byteLength === 0) return null;

  return { bytes, mediaType: normalizedType, finalUrl: finalUrl.toString() };
}

function removeMediaRowsSync(db: Database, dataDir: string, rows: BookmarkMediaRow[]): void {
  for (const row of rows) {
    rmSync(resolveCachePath(dataDir, row.cache_path), { force: true });
    db.query("DELETE FROM bookmark_media WHERE id = ?").run(row.id);
    if (row.kind === "favicon") {
      db.query("UPDATE bookmarks SET favicon_url = NULL WHERE id = ? AND favicon_url = ?")
        .run(row.bookmark_id, mediaUrl(row));
    } else if (row.kind === "screenshot") {
      db.query("UPDATE bookmarks SET screenshot_url = NULL WHERE id = ? AND screenshot_url = ?")
        .run(row.bookmark_id, mediaUrl(row));
    }
  }
}

export async function deleteBookmarkMediaCache(
  db: Database,
  dataDir: string,
  bookmarkIds: string[]
): Promise<void> {
  if (bookmarkIds.length === 0) return;
  const placeholders = bookmarkIds.map(() => "?").join(",");
  const rows = db
    .query<BookmarkMediaRow, string[]>(
      `SELECT * FROM bookmark_media WHERE bookmark_id IN (${placeholders})`
    )
    .all(...bookmarkIds);
  removeMediaRowsSync(db, dataDir, rows);
}

export function deleteBookmarkMediaCacheSync(
  db: Database,
  dataDir: string,
  bookmarkIds: string[]
): void {
  if (bookmarkIds.length === 0) return;
  const placeholders = bookmarkIds.map(() => "?").join(",");
  const rows = db
    .query<BookmarkMediaRow, string[]>(
      `SELECT * FROM bookmark_media WHERE bookmark_id IN (${placeholders})`
    )
    .all(...bookmarkIds);
  removeMediaRowsSync(db, dataDir, rows);
}

async function enforceTotalCacheLimit(db: Database, dataDir: string): Promise<void> {
  const rows = db
    .query<BookmarkMediaRow, []>("SELECT * FROM bookmark_media ORDER BY created_at ASC")
    .all();
  let total = rows.reduce((sum, row) => sum + row.size_bytes, 0);
  const toRemove: BookmarkMediaRow[] = [];
  for (const row of rows) {
    if (total <= MEDIA_CACHE_LIMITS.maxTotalBytes) break;
    toRemove.push(row);
    total -= row.size_bytes;
  }
  removeMediaRowsSync(db, dataDir, toRemove);
}

export async function cacheBookmarkMedia(
  db: Database,
  opts: {
    bookmarkId: string;
    dataDir: string;
    candidates: BookmarkMediaCandidates;
  }
): Promise<BookmarkMediaSet> {
  const bookmark = db
    .query<{ id: string }, [string]>("SELECT id FROM bookmarks WHERE id = ?")
    .get(opts.bookmarkId);
  if (!bookmark) return { favicon: null, screenshot: null, images: [] };

  await deleteBookmarkMediaCache(db, opts.dataDir, [opts.bookmarkId]);

  const candidates = [
    opts.candidates.favicon,
    opts.candidates.screenshot,
    ...opts.candidates.images.slice(0, MEDIA_CACHE_LIMITS.maxImagesPerBookmark),
  ].filter((candidate): candidate is BookmarkMediaCandidate => candidate !== null);

  const bookmarkDir = join(MEDIA_CACHE_DIR, "bookmarks", opts.bookmarkId);
  await mkdir(resolveCachePath(opts.dataDir, bookmarkDir), { recursive: true });

  let imageOrder = 0;
  const insertedSourceKeys = new Set<string>();
  for (const candidate of candidates) {
    const fetched = await fetchMedia(candidate);
    if (!fetched) continue;

    const sourceKey = `${candidate.kind}\0${fetched.finalUrl}`;
    if (insertedSourceKeys.has(sourceKey)) continue;
    insertedSourceKeys.add(sourceKey);

    const id = randomUUID();
    const displayOrder = candidate.kind === "image" ? imageOrder++ : 0;
    const cachePath = join(
      bookmarkDir,
      `${candidate.kind}-${displayOrder}-${sourceHash(fetched.finalUrl)}${extensionFor(fetched.mediaType, fetched.finalUrl)}`
    );
    await Bun.write(resolveCachePath(opts.dataDir, cachePath), fetched.bytes);

    db.query(
      `INSERT INTO bookmark_media
         (id, bookmark_id, kind, source_url, cache_path, media_type, size_bytes, alt, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      opts.bookmarkId,
      candidate.kind,
      fetched.finalUrl,
      cachePath,
      fetched.mediaType,
      fetched.bytes.byteLength,
      candidate.alt ?? null,
      displayOrder
    );

    const url = `/media/bookmarks/${opts.bookmarkId}/${id}`;
    if (candidate.kind === "favicon") {
      db.query("UPDATE bookmarks SET favicon_url = ? WHERE id = ?").run(url, opts.bookmarkId);
    } else if (candidate.kind === "screenshot") {
      db.query("UPDATE bookmarks SET screenshot_url = ? WHERE id = ?").run(url, opts.bookmarkId);
    }
  }

  await enforceTotalCacheLimit(db, opts.dataDir);
  return listBookmarkMedia(db, opts.bookmarkId);
}

export function getBookmarkMediaFile(
  db: Database,
  dataDir: string,
  bookmarkId: string,
  mediaId: string
): { path: string; mediaType: string; sizeBytes: number } | null {
  const row = db
    .query<BookmarkMediaRow, [string, string]>(
      `SELECT bm.*
       FROM bookmark_media bm
       JOIN bookmarks b ON b.id = bm.bookmark_id
       WHERE bm.bookmark_id = ?
         AND bm.id = ?
         AND b.is_trashed = 0`
    )
    .get(bookmarkId, mediaId);
  if (!row) return null;

  const path = resolveCachePath(dataDir, row.cache_path);
  if (!existsSync(path)) return null;

  return { path, mediaType: row.media_type, sizeBytes: row.size_bytes };
}
