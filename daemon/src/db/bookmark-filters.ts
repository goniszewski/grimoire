export type ReadStateFilter = "read" | "unread";

export interface BookmarkParityFilters {
  read_state?: ReadStateFilter;
  is_pinned?: 0 | 1;
  opened_count_min?: number;
  opened_count_max?: number;
  last_opened_from?: string;
  last_opened_to?: string;
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
