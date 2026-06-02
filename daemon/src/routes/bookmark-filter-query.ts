import type { BookmarkParityFilters, ReadStateFilter } from "../db/bookmark-filters.js";

export interface BookmarkRouteFilters extends BookmarkParityFilters {
  read_later?: 0 | 1;
}

export type FilterParseResult =
  | { ok: true; filters: BookmarkRouteFilters }
  | { ok: false; detail: string };

function parseBooleanFlagParam(val: string | null | undefined): 0 | 1 | undefined | "invalid" {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === "true" || val === "1") return 1;
  if (val === "false" || val === "0") return 0;
  return "invalid";
}

function parseReadStateParam(val: string | null | undefined): ReadStateFilter | undefined | "invalid" {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === "read" || val === "unread") return val;
  return "invalid";
}

function parseNonNegativeIntParam(
  val: string | null | undefined,
  name: string
): { ok: true; value?: number } | { ok: false; detail: string } {
  if (val === undefined || val === null || val === "") return { ok: true };
  if (!/^\d+$/.test(val)) {
    return { ok: false, detail: `\`${name}\` must be a non-negative integer` };
  }
  return { ok: true, value: Number.parseInt(val, 10) };
}

function parseDateParam(
  val: string | null | undefined,
  name: string
): { ok: true; value?: string } | { ok: false; detail: string } {
  if (val === undefined || val === null || val === "") return { ok: true };
  if (Number.isNaN(Date.parse(val))) {
    return { ok: false, detail: `\`${name}\` must be an ISO date or date-time` };
  }
  return { ok: true, value: val };
}

export function parseBookmarkRouteFilters(
  query: (name: string) => string | undefined
): FilterParseResult {
  const readLater = parseBooleanFlagParam(query("read_later"));
  if (readLater === "invalid") {
    return { ok: false, detail: "`read_later` must be true, false, 1, or 0" };
  }

  const isPinned = parseBooleanFlagParam(query("is_pinned"));
  if (isPinned === "invalid") {
    return { ok: false, detail: "`is_pinned` must be true, false, 1, or 0" };
  }

  const readState = parseReadStateParam(query("read_state"));
  if (readState === "invalid") {
    return { ok: false, detail: "`read_state` must be read or unread" };
  }

  const openedCountMin = parseNonNegativeIntParam(query("opened_count_min"), "opened_count_min");
  if (!openedCountMin.ok) return openedCountMin;

  const openedCountMax = parseNonNegativeIntParam(query("opened_count_max"), "opened_count_max");
  if (!openedCountMax.ok) return openedCountMax;

  if (
    openedCountMin.value !== undefined &&
    openedCountMax.value !== undefined &&
    openedCountMin.value > openedCountMax.value
  ) {
    return { ok: false, detail: "`opened_count_min` must be less than or equal to `opened_count_max`" };
  }

  const lastOpenedFrom = parseDateParam(query("last_opened_from"), "last_opened_from");
  if (!lastOpenedFrom.ok) return lastOpenedFrom;

  const lastOpenedTo = parseDateParam(query("last_opened_to"), "last_opened_to");
  if (!lastOpenedTo.ok) return lastOpenedTo;

  return {
    ok: true,
    filters: {
      read_later: readLater,
      read_state: readState,
      is_pinned: isPinned,
      opened_count_min: openedCountMin.value,
      opened_count_max: openedCountMax.value,
      last_opened_from: lastOpenedFrom.value,
      last_opened_to: lastOpenedTo.value,
    },
  };
}
