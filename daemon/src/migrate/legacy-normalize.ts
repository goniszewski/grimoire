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

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
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

function buildCategoryPath(
  categoryId: number,
  byId: Map<number, LegacyCategory>
): string[] {
  const path: string[] = [];
  const seen = new Set<number>();
  let current: LegacyCategory | undefined = byId.get(categoryId);
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    path.unshift(current.name || current.slug || String(current.id));
    if (current.parentId == null) break;
    current = byId.get(current.parentId);
  }
  return path;
}

function normalizeCategory(
  category: LegacyCategory,
  byId: Map<number, LegacyCategory>
): NormalizedLegacyCategory {
  return {
    sourceId: String(category.id),
    name: category.name || category.slug || String(category.id),
    slug: category.slug,
    description: nonempty(category.description),
    color: nonempty(category.color),
    icon: nonempty(category.icon),
    isArchived: category.archived != null && category.archived !== 0,
    isPublic: category.public != null && category.public !== 0,
    parentSourceId: category.parentId == null ? null : String(category.parentId),
    path: buildCategoryPath(category.id, byId),
  };
}

function classifyUrl(url: string): { ok: true } | { ok: false; reason: string } {
  const parsed = parsePublicHttpUrl(url);
  if (parsed.ok) return { ok: true };
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

function mediaFromFile(
  kind: "favicon" | "image" | "screenshot",
  fileId: number | null,
  files: Map<number, LegacyFile>,
  uploadsDir: string | null,
  sourceUrl: string | null
): NormalizedLegacyBookmark["media"][number] | null {
  if (fileId == null) return null;
  const file = files.get(fileId);
  if (!file) return null;
  return {
    kind,
    filename: file.fileName || file.relativePath,
    sourceUrl,
    absolutePath: resolveLegacyUploadPath(uploadsDir, file.relativePath),
  };
}

function normalizeBookmark(
  bookmark: LegacyBookmark,
  contents: LegacyBackupContents,
  tagsById: Map<number, string>,
  categoriesById: Map<number, LegacyCategory>
):
  | { ok: true; bookmark: NormalizedLegacyBookmark }
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

  const tagNames = bookmark.tagIds
    .map((tagId) => tagsById.get(tagId))
    .filter((name): name is string => Boolean(name));

  const categoryPath = bookmark.categoryId
    ? buildCategoryPath(bookmark.categoryId, categoriesById)
    : [];

  const media: NormalizedLegacyBookmark["media"] = [];
  const favicon = mediaFromFile(
    "favicon",
    bookmark.iconId,
    contents.files,
    contents.uploadsDir,
    nonempty(bookmark.iconUrl)
  );
  if (favicon) media.push(favicon);
  const image = mediaFromFile(
    "image",
    bookmark.mainImageId,
    contents.files,
    contents.uploadsDir,
    nonempty(bookmark.mainImageUrl)
  );
  if (image) media.push(image);
  const screenshot = mediaFromFile(
    "screenshot",
    bookmark.screenshotId,
    contents.files,
    contents.uploadsDir,
    null
  );
  if (screenshot) media.push(screenshot);

  return {
    ok: true,
    bookmark: {
      sourceId: String(bookmark.id),
      url: bookmark.url,
      title: bookmark.title || bookmark.url,
      description: nonempty(bookmark.description),
      notes: nonempty(bookmark.note),
      author: nonempty(bookmark.author),
      contentText: nonempty(bookmark.contentText),
      contentHtml: nonempty(bookmark.contentHtml),
      publishedAt: nonempty(bookmark.contentPublishedDate),
      tags: tagNames,
      categoryPath,
      isPinned: bookmark.flagged != null && bookmark.flagged !== 0,
      isArchived: bookmark.archived != null && bookmark.archived !== 0,
      readAt: unixToIso(bookmark.read),
      openedCount: Math.max(0, Math.floor(bookmark.openedTimes || 0)),
      lastOpenedAt: unixToIso(bookmark.openedLast),
      faviconUrl: nonempty(bookmark.iconUrl),
      mainImageUrl: nonempty(bookmark.mainImageUrl),
      createdAt: unixToIso(bookmark.created),
      updatedAt: unixToIso(bookmark.updated),
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
  const tagsById = new Map(ownerTags.map((t) => [t.id, t.name]));

  const categories = ownerCategories.map((c) => normalizeCategory(c, categoriesById));
  categories.sort((a, b) => a.path.length - b.path.length || a.name.localeCompare(b.name));

  const tags = ownerTags.map((t) => ({
    sourceId: String(t.id),
    name: t.name,
    slug: t.slug,
  }));

  const bookmarks: NormalizedLegacyBookmark[] = [];
  const skippedBookmarks: NormalizedLegacyLibrary["skippedBookmarks"] = [];
  const warnings: string[] = [];

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
    if (bookmark.importance) {
      warnings.push(
        `Skipped legacy importance=${bookmark.importance} for ${bookmark.url}`
      );
    }
    bookmarks.push(result.bookmark);
  }

  return {
    owner: ownerSummary,
    categories,
    tags,
    bookmarks,
    skippedBookmarks,
    warnings,
  };
}
