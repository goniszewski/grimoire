import { isPrivateHost } from "../lib/network.js";
import { parsePublicHttpUrl } from "../lib/public-url.js";
import { resolveLegacyUploadPath } from "./legacy-paths.js";
import type {
  LegacyBackupContents,
  LegacyBookmark,
  LegacyCategory,
  LegacyFile,
  LegacyOwnerSummary,
  LegacyUser,
  NormalizedLegacyBookmark,
  NormalizedLegacyCategory,
  NormalizedLegacyLibrary,
} from "./legacy-types.js";

/** Match Grimoire 1.x category nesting limit used by Netscape import. */
export const MAX_IMPORT_CATEGORY_LEVELS = 3;

/**
 * Truncate a deep category path while preserving the leaf name.
 * e.g. A/B/C/D/E → A/B/E when max levels is 3.
 */
export function limitImportCategoryPath(path: string[]): string[] {
  if (path.length <= MAX_IMPORT_CATEGORY_LEVELS) return path;
  return [...path.slice(0, MAX_IMPORT_CATEGORY_LEVELS - 1), path[path.length - 1]!];
}

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\0/g, "").trim() ?? "";
  return trimmed ? trimmed : null;
}

/** v0.5 timestamps are unix epoch seconds (integer). */
function unixToIso(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  // Heuristic: values that look like ms already (post-2001 in ms) — rare, but safe.
  const ms = value > 1e12 ? value : value * 1000;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalize v0.5 `content_published_date` which may be an ISO date string,
 * ISO datetime, or (rarely) a unix epoch stored as text/number.
 */
function normalizePublishedAt(value: string | null | undefined): string | null {
  const raw = nonempty(value);
  if (!raw) return null;
  // Keep plain YYYY-MM-DD as stored in typical v0.5 rows.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    return raw;
  }
  if (/^\d+$/.test(raw)) {
    return unixToIso(Number(raw));
  }
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return raw;
}

function buildCategoryPath(
  categoryId: number,
  byId: Map<number, LegacyCategory>
): { path: string[]; cycle: boolean; unresolvedParentId: number | null } {
  const path: string[] = [];
  const seen = new Set<number>();
  let current: LegacyCategory | undefined = byId.get(categoryId);
  let cycle = false;
  let unresolvedParentId: number | null = null;
  while (current) {
    if (seen.has(current.id)) {
      cycle = true;
      break;
    }
    seen.add(current.id);
    path.unshift(nonempty(current.name) || nonempty(current.slug) || String(current.id));
    if (current.parentId == null) break;
    const parent = byId.get(current.parentId);
    if (!parent) {
      unresolvedParentId = current.parentId;
      break;
    }
    current = parent;
  }
  return { path, cycle, unresolvedParentId };
}

function normalizeCategory(
  category: LegacyCategory,
  byId: Map<number, LegacyCategory>
): NormalizedLegacyCategory {
  const { path } = buildCategoryPath(category.id, byId);
  return {
    sourceId: String(category.id),
    name: nonempty(category.name) || nonempty(category.slug) || String(category.id),
    slug: category.slug,
    description: nonempty(category.description),
    color: nonempty(category.color),
    icon: nonempty(category.icon),
    isArchived: category.archived != null && category.archived !== 0,
    isPublic: category.public != null && category.public !== 0,
    parentSourceId: category.parentId == null ? null : String(category.parentId),
    path,
  };
}

function classifyUrl(
  url: string
):
  | { ok: true; href: string; isPrivateHost: boolean }
  | { ok: false; reason: string } {
  const trimmed = url.trim();
  const parsed = parsePublicHttpUrl(trimmed);
  if (parsed.ok) {
    return { ok: true, href: canonicalizeHttpUrl(parsed.url), isPrivateHost: false };
  }

  // Migration preserves private/LAN bookmarks already stored in v0.5. Credential
  // and non-http URLs stay rejected. Ingest is skipped later for private hosts.
  if (parsed.reason === "private") {
    try {
      const privateUrl = new URL(trimmed);
      if (
        (privateUrl.protocol === "http:" || privateUrl.protocol === "https:") &&
        !privateUrl.username &&
        !privateUrl.password &&
        isPrivateHost(privateUrl.hostname)
      ) {
        return {
          ok: true,
          href: canonicalizeHttpUrl(privateUrl),
          isPrivateHost: true,
        };
      }
    } catch {
      // fall through
    }
  }

  switch (parsed.reason) {
    case "private":
      return { ok: false, reason: "private_url" };
    case "credentials":
      return { ok: false, reason: "credential_url" };
    case "protocol":
      return { ok: false, reason: "non_http_url" };
    default:
      return { ok: false, reason: "invalid_url" };
  }
}

/**
 * Stable migrate URL form: lowercase host via URL parser, but avoid forcing a
 * trailing slash on bare origins so `https://example.com` matches 1.x stubs.
 */
export function canonicalizeHttpUrl(url: URL): string {
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.protocol}//${url.host}${path}${url.search}${url.hash}`;
}

/** Best-effort canonical form for duplicate detection against mixed-case 1.x rows. */
export function canonicalUrlKey(raw: string): string {
  try {
    return canonicalizeHttpUrl(new URL(raw.trim()));
  } catch {
    return raw.trim();
  }
}

function mediaStableKey(file: LegacyFile | null, fileId: number, filename: string): string {
  const relative = file?.relativePath?.trim();
  if (relative) {
    return relative.replace(/\\/g, "/").replace(/^[/]+/, "");
  }
  return `file:${fileId}:${filename}`;
}

function mediaFromFile(
  kind: "favicon" | "image" | "screenshot",
  fileId: number | null,
  files: Map<number, LegacyFile>,
  uploadsDir: string | null,
  sourceUrl: string | null,
  warnings: string[],
  bookmarkLabel: string,
  ownerId: number
): NormalizedLegacyBookmark["media"][number] | null {
  if (fileId == null) return null;

  const skippedStub = (
    filename: string,
    declaredMimeType: string | null,
    file: LegacyFile | null = null
  ): NormalizedLegacyBookmark["media"][number] => ({
    kind,
    filename,
    sourceUrl,
    absolutePath: null,
    stableKey: mediaStableKey(file, fileId, filename),
    declaredMimeType,
  });

  const file = files.get(fileId);
  if (!file) {
    warnings.push(
      `Skipped ${kind} for ${bookmarkLabel}: file id ${fileId} is missing from the v0.5 file table`
    );
    // Still count as skipped media so dry-run/apply summaries match the warning.
    return skippedStub(`missing-file-${fileId}`, null);
  }
  if (file.ownerId !== ownerId) {
    warnings.push(
      `Skipped ${kind} for ${bookmarkLabel}: file id ${fileId} belongs to another owner`
    );
    return skippedStub(file.fileName || file.relativePath, nonempty(file.mimeType), file);
  }
  const storage = file.storageType.trim().toLowerCase();
  if (storage && storage !== "local") {
    warnings.push(
      `Skipped ${kind} for ${bookmarkLabel}: remote storage_type=${file.storageType} is not imported (only local user-uploads/)`
    );
    return skippedStub(file.fileName || file.relativePath, nonempty(file.mimeType), file);
  }
  if (!uploadsDir) {
    warnings.push(
      `Skipped ${kind} for ${bookmarkLabel}: user-uploads/ directory is missing`
    );
    return skippedStub(file.fileName || file.relativePath, nonempty(file.mimeType), file);
  }
  const absolutePath = resolveLegacyUploadPath(uploadsDir, file.relativePath);
  if (!absolutePath) {
    warnings.push(
      `Skipped ${kind} for ${bookmarkLabel}: upload not found or unsafe (${file.relativePath})`
    );
  }
  const filename = file.fileName || file.relativePath;
  return {
    kind,
    filename,
    sourceUrl,
    absolutePath,
    stableKey: mediaStableKey(file, fileId, filename),
    declaredMimeType: nonempty(file.mimeType),
  };
}

function normalizeBookmark(
  bookmark: LegacyBookmark,
  contents: LegacyBackupContents,
  tagsById: Map<number, string>,
  categoriesById: Map<number, LegacyCategory>
):
  | { ok: true; bookmark: NormalizedLegacyBookmark; warnings: string[] }
  | { ok: false; sourceId: string; url: string | null; reason: string } {
  const urlCheck = classifyUrl(bookmark.url);
  if (!urlCheck.ok) {
    return {
      ok: false,
      sourceId: String(bookmark.id),
      url: bookmark.url || null,
      reason: urlCheck.reason,
    };
  }

  const tagNames: string[] = [];
  const missingTagIds: number[] = [];
  for (const tagId of bookmark.tagIds) {
    const name = tagsById.get(tagId);
    if (name) tagNames.push(name);
    else missingTagIds.push(tagId);
  }

  const built = bookmark.categoryId
    ? buildCategoryPath(bookmark.categoryId, categoriesById)
    : { path: [] as string[], cycle: false, unresolvedParentId: null as number | null };
  const categoryPath = built.path;
  const bookmarkLabel = urlCheck.href || `id=${bookmark.id}`;
  const warnings: string[] = [];

  if (built.cycle) {
    warnings.push(
      `Category cycle detected while resolving path for ${bookmarkLabel}; imported path stops before the loop`
    );
  }
  if (built.unresolvedParentId != null) {
    warnings.push(
      `Category parent ${built.unresolvedParentId} missing/unowned while resolving ${bookmarkLabel}; imported path is truncated`
    );
  }
  const media: NormalizedLegacyBookmark["media"] = [];
  const favicon = mediaFromFile(
    "favicon",
    bookmark.iconId,
    contents.files,
    contents.uploadsDir,
    nonempty(bookmark.iconUrl),
    warnings,
    bookmarkLabel,
    bookmark.ownerId
  );
  if (favicon) media.push(favicon);
  const image = mediaFromFile(
    "image",
    bookmark.mainImageId,
    contents.files,
    contents.uploadsDir,
    nonempty(bookmark.mainImageUrl),
    warnings,
    bookmarkLabel,
    bookmark.ownerId
  );
  if (image) media.push(image);
  const screenshot = mediaFromFile(
    "screenshot",
    bookmark.screenshotId,
    contents.files,
    contents.uploadsDir,
    null,
    warnings,
    bookmarkLabel,
    bookmark.ownerId
  );
  if (screenshot) media.push(screenshot);

  if (missingTagIds.length > 0) {
    warnings.push(
      `Dropped ${missingTagIds.length} missing/unowned tag id(s) for ${bookmarkLabel}: ${missingTagIds.join(", ")}`
    );
  }
  if (bookmark.categoryId != null && categoryPath.length === 0) {
    warnings.push(
      `Bookmark ${bookmarkLabel} references missing/unowned category ${bookmark.categoryId}; importing uncategorized`
    );
  }
  const limitedCategoryPath = limitImportCategoryPath(categoryPath);
  if (categoryPath.length > MAX_IMPORT_CATEGORY_LEVELS) {
    const dropped = categoryPath.slice(
      MAX_IMPORT_CATEGORY_LEVELS - 1,
      categoryPath.length - 1
    );
    warnings.push(
      `Category path for ${bookmarkLabel} has ${categoryPath.length} levels; ` +
        `Grimoire 1.x keeps ancestors + leaf (${limitedCategoryPath.join(" / ")})` +
        (dropped.length ? `; dropped middle: ${dropped.join(" / ")}` : "")
    );
  }
  if (urlCheck.isPrivateHost) {
    warnings.push(
      `Imported private/LAN URL for ${bookmarkLabel}; post-migrate ingest will be skipped`
    );
  }

  const hasLocalFavicon = media.some((m) => m.kind === "favicon" && m.absolutePath);
  const hasLocalImage = media.some((m) => m.kind === "image" && m.absolutePath);
  if (nonempty(bookmark.iconUrl) && !hasLocalFavicon && bookmark.iconId == null) {
    warnings.push(
      `Remote-only favicon URL for ${bookmarkLabel} will be stored as favicon_url (not downloaded)`
    );
  }
  if (nonempty(bookmark.mainImageUrl) && !hasLocalImage && bookmark.mainImageId == null) {
    warnings.push(
      `Remote-only main_image_url for ${bookmarkLabel} is not imported (no local file id)`
    );
  }

  return {
    ok: true,
    warnings,
    bookmark: {
      sourceId: String(bookmark.id),
      url: urlCheck.href,
      title: nonempty(bookmark.title) ?? urlCheck.href,
      description: nonempty(bookmark.description),
      notes: nonempty(bookmark.note),
      author: nonempty(bookmark.author),
      contentText: nonempty(bookmark.contentText),
      contentHtml: nonempty(bookmark.contentHtml),
      publishedAt: normalizePublishedAt(bookmark.contentPublishedDate),
      tags: tagNames,
      categoryPath: limitedCategoryPath,
      isPinned: bookmark.flagged != null && bookmark.flagged !== 0,
      isArchived: bookmark.archived != null && bookmark.archived !== 0,
      readAt: unixToIso(bookmark.read),
      openedCount: Math.max(0, Math.floor(bookmark.openedTimes || 0)),
      lastOpenedAt: unixToIso(bookmark.openedLast),
      faviconUrl: nonempty(bookmark.iconUrl),
      mainImageUrl: nonempty(bookmark.mainImageUrl),
      createdAt: unixToIso(bookmark.created),
      updatedAt: unixToIso(bookmark.updated),
      isPrivateHost: urlCheck.isPrivateHost,
      media,
    },
  };
}

export function normalizeLegacyLibrary(
  contents: LegacyBackupContents,
  owner: LegacyUser
): NormalizedLegacyLibrary {
  const ownerSummary: LegacyOwnerSummary = {
    id: String(owner.id),
    username: owner.username,
    email: owner.email,
    name: owner.name,
    bookmarkCount: contents.bookmarks.filter((b) => b.ownerId === owner.id).length,
    categoryCount: contents.categories.filter((c) => c.ownerId === owner.id).length,
    tagCount: contents.tags.filter((t) => t.ownerId === owner.id).length,
    disabled: owner.disabled != null && owner.disabled !== 0,
  };

  const ownerCategories = contents.categories.filter((c) => c.ownerId === owner.id);
  const ownerTags = contents.tags.filter((t) => t.ownerId === owner.id);
  const ownerBookmarks = contents.bookmarks.filter((b) => b.ownerId === owner.id);

  const categoriesById = new Map(ownerCategories.map((c) => [c.id, c]));
  const tagsById = new Map<number, string>();
  for (const tag of ownerTags) {
    const name = nonempty(tag.name) ?? nonempty(tag.slug);
    if (name) tagsById.set(tag.id, name);
  }

  const categories = ownerCategories.map((c) => normalizeCategory(c, categoriesById));
  categories.sort((a, b) => a.path.length - b.path.length || a.name.localeCompare(b.name));

  const tags = ownerTags.flatMap((t) => {
    const name = tagsById.get(t.id);
    if (!name) return [];
    return [{ sourceId: String(t.id), name, slug: t.slug }];
  });

  const bookmarks: NormalizedLegacyBookmark[] = [];
  const skippedBookmarks: NormalizedLegacyLibrary["skippedBookmarks"] = [];
  const warnings: string[] = [];
  if (ownerSummary.disabled) {
    warnings.push(
      `Selected v0.5 user "${owner.username}" is marked disabled; importing their library anyway`
    );
  }
  const otherBookmarks = contents.bookmarks.length - ownerBookmarks.length;
  const otherCategories = contents.categories.length - ownerCategories.length;
  const otherTags = contents.tags.length - ownerTags.length;
  if (otherBookmarks > 0 || otherCategories > 0 || otherTags > 0) {
    const userIds = new Set(contents.users.map((u) => u.id));
    const orphanBookmarks = contents.bookmarks.filter((b) => !userIds.has(b.ownerId)).length;
    const namedOther = Math.max(0, otherBookmarks - orphanBookmarks);
    if (orphanBookmarks > 0) {
      warnings.push(
        `Skipped ${orphanBookmarks} bookmark(s) with owner_id not matching any v0.5 user`
      );
    }
    if (namedOther > 0 || otherCategories > 0 || otherTags > 0) {
      warnings.push(
        `Not importing other owners' data: ${namedOther} bookmark(s), ${otherCategories} categor(ies), ${otherTags} tag(s). Re-run with --owner to import another library.`
      );
    }
  }
  if (!contents.uploadsDir) {
    const hasMediaRefs = ownerBookmarks.some(
      (b) => b.iconId != null || b.mainImageId != null || b.screenshotId != null
    );
    if (hasMediaRefs) {
      warnings.push(
        "user-uploads/ directory not found; local media references will be skipped"
      );
    }
  }
  for (const tag of ownerTags) {
    if (!tagsById.has(tag.id)) {
      warnings.push(`Dropped blank tag id=${tag.id} (empty name/slug)`);
    }
  }

  for (const category of categories) {
    if (category.path.length > MAX_IMPORT_CATEGORY_LEVELS) {
      const limited = limitImportCategoryPath(category.path);
      warnings.push(
        `Category "${category.name}" path has ${category.path.length} levels; ` +
          `Grimoire 1.x keeps ancestors + leaf (${limited.join(" / ")})`
      );
    }
  }

  for (const bookmark of ownerBookmarks) {
    const result = normalizeBookmark(bookmark, contents, tagsById, categoriesById);
    if (!result.ok) {
      skippedBookmarks.push({
        sourceId: result.sourceId,
        url: result.url,
        reason: result.reason,
      });
      continue;
    }
    warnings.push(...result.warnings);
    if (bookmark.importance) {
      warnings.push(
        `Skipped legacy importance=${bookmark.importance} for ${bookmark.url}`
      );
    }
    if (bookmark.contentType?.trim()) {
      warnings.push(
        `Skipped legacy content_type=${bookmark.contentType.trim()} for ${bookmark.url}`
      );
    }
    bookmarks.push(result.bookmark);
  }

  const collapsed = collapseDuplicateUrls(bookmarks, warnings);
  warnNearDuplicateUrls(collapsed, warnings);

  return {
    owner: ownerSummary,
    categories,
    tags,
    bookmarks: collapsed,
    skippedBookmarks,
    warnings,
  };
}

/** Merge same-URL rows within one owner's library so notes/tags/media are not dropped. */
function collapseDuplicateUrls(
  bookmarks: NormalizedLegacyBookmark[],
  warnings: string[]
): NormalizedLegacyBookmark[] {
  const byUrl = new Map<string, NormalizedLegacyBookmark>();
  for (const bookmark of bookmarks) {
    const existing = byUrl.get(bookmark.url);
    if (!existing) {
      byUrl.set(bookmark.url, bookmark);
      continue;
    }
    warnings.push(
      `Merged duplicate URL in source library: ${bookmark.url} (ids ${existing.sourceId}, ${bookmark.sourceId})`
    );
    byUrl.set(bookmark.url, mergeNormalizedBookmarks(existing, bookmark));
  }
  return [...byUrl.values()];
}

/**
 * Warn when bookmarks look like the same page under different schemes or
 * trailing-slash variants (not auto-merged — UNIQUE url is exact-string).
 */
function warnNearDuplicateUrls(
  bookmarks: NormalizedLegacyBookmark[],
  warnings: string[]
): void {
  const byKey = new Map<string, NormalizedLegacyBookmark[]>();
  for (const bookmark of bookmarks) {
    let key: string;
    try {
      const u = new URL(bookmark.url);
      const path = u.pathname.replace(/\/+$/, "") || "/";
      key = `${u.hostname.toLowerCase()}${path}`;
    } catch {
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push(bookmark);
    byKey.set(key, list);
  }
  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    const urls = [...new Set(group.map((b) => b.url))];
    if (urls.length < 2) continue;
    warnings.push(
      `Near-duplicate URLs kept as separate bookmarks (scheme/slash differ): ${urls.join(" | ")}`
    );
  }
}

function mergeNormalizedBookmarks(
  a: NormalizedLegacyBookmark,
  b: NormalizedLegacyBookmark
): NormalizedLegacyBookmark {
  const notes =
    a.notes && b.notes
      ? a.notes.includes(b.notes)
        ? a.notes
        : b.notes.includes(a.notes)
          ? b.notes
          : `${a.notes}\n\n${b.notes}`
      : a.notes ?? b.notes;
  const tags = [...new Set([...a.tags, ...b.tags])];
  const media = [...a.media];
  for (const item of b.media) {
    const key = `${item.kind}:${item.stableKey || item.filename}`;
    if (!media.some((m) => `${m.kind}:${m.stableKey || m.filename}` === key)) {
      media.push(item);
    }
  }
  const pickLonger = (x: string | null, y: string | null): string | null => {
    if (!x) return y;
    if (!y) return x;
    return y.length > x.length ? y : x;
  };
  const pickTitle = (x: string, y: string, url: string): string => {
    const xStub = !x.trim() || x === url;
    const yStub = !y.trim() || y === url;
    if (xStub && !yStub) return y;
    if (yStub && !xStub) return x;
    if (xStub && yStub) return x || y || url;
    // Both are real titles — keep the first (older) bookmark's title.
    return x;
  };
  return {
    ...a,
    title: pickTitle(a.title, b.title, a.url),
    description: pickLonger(a.description, b.description),
    notes,
    author: a.author ?? b.author,
    contentText: pickLonger(a.contentText, b.contentText),
    contentHtml: pickLonger(a.contentHtml, b.contentHtml),
    publishedAt: a.publishedAt ?? b.publishedAt,
    tags,
    categoryPath: a.categoryPath.length >= b.categoryPath.length ? a.categoryPath : b.categoryPath,
    isPinned: a.isPinned || b.isPinned,
    isArchived: a.isArchived || b.isArchived,
    readAt:
      a.readAt && b.readAt
        ? a.readAt >= b.readAt
          ? a.readAt
          : b.readAt
        : a.readAt ?? b.readAt,
    openedCount: Math.max(a.openedCount, b.openedCount),
    lastOpenedAt:
      a.lastOpenedAt && b.lastOpenedAt
        ? a.lastOpenedAt >= b.lastOpenedAt
          ? a.lastOpenedAt
          : b.lastOpenedAt
        : a.lastOpenedAt ?? b.lastOpenedAt,
    faviconUrl: a.faviconUrl ?? b.faviconUrl,
    mainImageUrl: a.mainImageUrl ?? b.mainImageUrl,
    createdAt:
      a.createdAt && b.createdAt
        ? a.createdAt <= b.createdAt
          ? a.createdAt
          : b.createdAt
        : a.createdAt ?? b.createdAt,
    updatedAt:
      a.updatedAt && b.updatedAt
        ? a.updatedAt >= b.updatedAt
          ? a.updatedAt
          : b.updatedAt
        : a.updatedAt ?? b.updatedAt,
    isPrivateHost: a.isPrivateHost || b.isPrivateHost,
    media,
  };
}
