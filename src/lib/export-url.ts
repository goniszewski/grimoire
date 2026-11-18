import { appendLibraryParityFilters, appendTagFilter, DAEMON_URL } from "./api";
import type { LibraryParityFilterParams, TagMatch } from "./api";

export interface ExportFilters extends LibraryParityFilterParams {
  tag?: string | string[];
  tag_match?: TagMatch;
  domain?: string;
  category_id?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  read_later?: boolean;
}

export function buildExportUrl(format: "json" | "csv", filters: ExportFilters = {}): string {
  const params = new URLSearchParams({ format });
  appendTagFilter(params, filters.tag, filters.tag_match);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.category_id) params.set("category_id", filters.category_id);
  if (filters.category) params.set("category", filters.category);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.read_later != null) params.set("read_later", filters.read_later ? "true" : "false");
  appendLibraryParityFilters(params, filters);

  return `${DAEMON_URL}/export?${params.toString()}`;
}
