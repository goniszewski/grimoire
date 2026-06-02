export type ReadStateFilter = "read" | "unread";
export const bookmarkSortKeys = [
  "created_at",
  "updated_at",
  "title",
  "domain",
  "opened_count",
  "last_opened_at",
] as const;
export const bookmarkSortDirections = ["asc", "desc"] as const;
export type BookmarkSortKey = (typeof bookmarkSortKeys)[number];
export type BookmarkSortDirection = (typeof bookmarkSortDirections)[number];

export interface BookmarkParityFilters {
  read_state?: ReadStateFilter;
  is_pinned?: 0 | 1;
  opened_count_min?: number;
  opened_count_max?: number;
  last_opened_from?: string;
  last_opened_to?: string;
}

export interface BookmarkSortOptions {
  sort?: BookmarkSortKey;
  direction?: BookmarkSortDirection;
}

interface SortableBookmarkRow {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  opened_count: number;
  last_opened_at: string | null;
}

export function normalizeDateUpperBound(value: string): string {
  return value.length === 10 ? `${value}T23:59:59Z` : value;
}

export function appendBookmarkParityFilterConditions(
  conditions: string[],
  params: (string | number)[],
  filters: BookmarkParityFilters,
  alias = "b"
): void {
  if (filters.read_state === "read") {
    conditions.push(`${alias}.read_at IS NOT NULL`);
  } else if (filters.read_state === "unread") {
    conditions.push(`${alias}.read_at IS NULL`);
  }

  if (filters.is_pinned !== undefined) {
    conditions.push(`${alias}.is_pinned = ?`);
    params.push(filters.is_pinned);
  }

  if (filters.opened_count_min !== undefined) {
    conditions.push(`${alias}.opened_count >= ?`);
    params.push(filters.opened_count_min);
  }

  if (filters.opened_count_max !== undefined) {
    conditions.push(`${alias}.opened_count <= ?`);
    params.push(filters.opened_count_max);
  }

  if (filters.last_opened_from) {
    conditions.push(`${alias}.last_opened_at >= ?`);
    params.push(filters.last_opened_from);
  }

  if (filters.last_opened_to) {
    conditions.push(`${alias}.last_opened_at <= ?`);
    params.push(normalizeDateUpperBound(filters.last_opened_to));
  }
}

export function isBookmarkSortKey(value: string): value is BookmarkSortKey {
  return (bookmarkSortKeys as readonly string[]).includes(value);
}

export function isBookmarkSortDirection(value: string): value is BookmarkSortDirection {
  return (bookmarkSortDirections as readonly string[]).includes(value);
}

export function buildBookmarkOrderBy(
  options: BookmarkSortOptions,
  fallback: string,
  alias = "b",
  extraTieBreakers: string[] = []
): string {
  const sort =
    typeof options.sort === "string" && isBookmarkSortKey(options.sort) ? options.sort : undefined;
  if (!sort) return fallback;

  const direction = options.direction === "asc" ? "ASC" : "DESC";
  const fallbackTieBreakers = [`${alias}.created_at DESC`, `${alias}.id ASC`];
  const withTieBreakers = (clauses: string[], includeCreatedFallback = true) =>
    [
      ...clauses,
      ...extraTieBreakers,
      ...(includeCreatedFallback ? fallbackTieBreakers : [`${alias}.id ASC`]),
    ].join(", ");

  switch (sort) {
    case "created_at":
      return withTieBreakers([`${alias}.created_at ${direction}`], false);
    case "updated_at":
      return withTieBreakers([`${alias}.updated_at ${direction}`]);
    case "title":
      return withTieBreakers([`LOWER(COALESCE(${alias}.title, ${alias}.url)) ${direction}`]);
    case "domain":
      return withTieBreakers([`LOWER(${alias}.domain) ${direction}`]);
    case "opened_count":
      return withTieBreakers([
        `${alias}.opened_count ${direction}`,
        `${alias}.last_opened_at IS NULL ASC`,
        `${alias}.last_opened_at DESC`,
      ]);
    case "last_opened_at":
      return withTieBreakers([
        `${alias}.last_opened_at IS NULL ASC`,
        `${alias}.last_opened_at ${direction}`,
      ]);
  }
}

export function compareBookmarksBySort(
  a: SortableBookmarkRow,
  b: SortableBookmarkRow,
  options: BookmarkSortOptions,
  extraTieBreaker?: (left: SortableBookmarkRow, right: SortableBookmarkRow) => number
): number {
  const sort =
    typeof options.sort === "string" && isBookmarkSortKey(options.sort) ? options.sort : undefined;
  if (!sort) return 0;

  const direction = options.direction === "asc" ? "asc" : "desc";
  const multiplier = direction === "asc" ? 1 : -1;
  const compareStrings = (left: string, right: string) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }) * multiplier;
  const compareNullableDates = (
    left: string | null,
    right: string | null,
    dateMultiplier = multiplier
  ) => {
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left.localeCompare(right) * dateMultiplier;
  };

  let primary = 0;
  switch (sort) {
    case "created_at":
      primary = a.created_at.localeCompare(b.created_at) * multiplier;
      break;
    case "updated_at":
      primary = a.updated_at.localeCompare(b.updated_at) * multiplier;
      break;
    case "title":
      primary = compareStrings(a.title ?? a.url, b.title ?? b.url);
      break;
    case "domain":
      primary = compareStrings(a.domain, b.domain);
      break;
    case "opened_count":
      primary = (a.opened_count - b.opened_count) * multiplier;
      if (primary === 0) primary = compareNullableDates(a.last_opened_at, b.last_opened_at, -1);
      break;
    case "last_opened_at":
      primary = compareNullableDates(a.last_opened_at, b.last_opened_at);
      break;
  }

  if (primary !== 0) return primary;
  const extra = extraTieBreaker?.(a, b) ?? 0;
  if (extra !== 0) return extra;
  if (sort !== "created_at") {
    const created = b.created_at.localeCompare(a.created_at);
    if (created !== 0) return created;
  }
  return a.id.localeCompare(b.id);
}
