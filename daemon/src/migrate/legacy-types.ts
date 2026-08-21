/**
 * Grimoire v0.5 (SQLite / Drizzle) source shapes.
 * On-disk layout: data/db.sqlite + data/user-uploads/
 */

export interface LegacyUser {
  id: number;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  disabled: number | null;
  isAdmin: boolean;
  created: number;
  updated: number;
}

export interface LegacyCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  initial: boolean;
  archived: number | null;
  public: number | null;
  parentId: number | null;
  ownerId: number;
  created: number;
  updated: number;
}

export interface LegacyTag {
  id: number;
  name: string;
  slug: string;
  ownerId: number;
  created: number;
  updated: number;
}

export interface LegacyFile {
  id: number;
  fileName: string;
  storageType: string;
  relativePath: string;
  size: number | null;
  mimeType: string;
  source: string;
  ownerId: number;
}

export interface LegacyBookmark {
  id: number;
  url: string;
  domain: string;
  title: string;
  description: string | null;
  author: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentType: string | null;
  contentPublishedDate: string | null;
  note: string | null;
  mainImageUrl: string | null;
  mainImageId: number | null;
  iconUrl: string | null;
  iconId: number | null;
  screenshotId: number | null;
  importance: number | null;
  flagged: number | null;
  read: number | null;
  archived: number | null;
  openedLast: number | null;
  openedTimes: number;
  ownerId: number;
  categoryId: number | null;
  created: number;
  updated: number;
  tagIds: number[];
}

export interface LegacyBackupContents {
  dbPath: string;
  uploadsDir: string | null;
  users: LegacyUser[];
  categories: LegacyCategory[];
  tags: LegacyTag[];
  bookmarks: LegacyBookmark[];
  files: Map<number, LegacyFile>;
  /** Invoke after inspect/apply when the source was an extracted archive. */
  cleanup?: () => void;
}

export interface LegacyOwnerSummary {
  id: string;
  username: string;
  email: string;
  name: string;
  bookmarkCount: number;
  categoryCount: number;
  tagCount: number;
  disabled: boolean;
}

export interface LegacyInspectResult {
  source: "grimoire-v05-sqlite";
  dbPath: string;
  uploadsDir: string | null;
  users: LegacyOwnerSummary[];
  totals: {
    users: number;
    categories: number;
    tags: number;
    bookmarks: number;
    mediaFilesReferenced: number;
  };
  requiresOwnerSelection: boolean;
}

export interface NormalizedLegacyBookmark {
  sourceId: string;
  url: string;
  title: string;
  description: string | null;
  notes: string | null;
  author: string | null;
  contentText: string | null;
  contentHtml: string | null;
  publishedAt: string | null;
  tags: string[];
  categoryPath: string[];
  isPinned: boolean;
  isArchived: boolean;
  readAt: string | null;
  openedCount: number;
  lastOpenedAt: string | null;
  faviconUrl: string | null;
  mainImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /**
   * True when the URL targets a private/LAN/loopback host. Migrated into SQLite
   * for data fidelity, but post-migrate ingest is skipped (SSRF).
   */
  isPrivateHost: boolean;
  media: Array<{
    kind: "favicon" | "image" | "screenshot";
    filename: string;
    sourceUrl: string | null;
    absolutePath: string | null;
    /**
     * Stable v0.5 identity for legacy:// source_url hashing (usually relative_path).
     * Must not include host absolute paths so remount/re-extract --merge dedupes.
     */
    stableKey: string;
    /** Declared v0.5 `file."mime-type"` when present; used as fallback after sniff. */
    declaredMimeType: string | null;
  }>;
}

export interface NormalizedLegacyCategory {
  sourceId: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  isPublic: boolean;
  parentSourceId: string | null;
  path: string[];
}

export interface NormalizedLegacyLibrary {
  owner: LegacyOwnerSummary;
  categories: NormalizedLegacyCategory[];
  tags: Array<{ sourceId: string; name: string; slug: string }>;
  bookmarks: NormalizedLegacyBookmark[];
  skippedBookmarks: Array<{ sourceId: string; url: string | null; reason: string }>;
  warnings: string[];
}

export interface LegacyApplySummary {
  owner: LegacyOwnerSummary;
  /** True when this summary came from a dry-run (no writes). */
  dryRun: boolean;
  categoriesCreated: number;
  categoriesReused: number;
  tagsCreated: number;
  tagsReused: number;
  bookmarksCreated: number;
  bookmarksMerged: number;
  bookmarksSkipped: number;
  bookmarksFailed: number;
  mediaImported: number;
  mediaSkipped: number;
  warnings: string[];
}

export interface LegacySourcePaths {
  dbPath: string;
  uploadsDir: string | null;
}
