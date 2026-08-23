import type {
  BookmarkCreateRequestDto,
  BookmarkUpdateRequestDto,
  CategoryNodeDto,
} from "../../../daemon/src/api/types";
import { DEMO_API_PATH } from "../enabled";
import {
  bookmarkResponse,
  detailResponse,
  flattenCategories,
  getDemoState,
  refreshCategoryCounts,
  nextSessionBookmarkId,
  type MutableDemoBookmark,
  type DemoState,
} from "./state";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function problem(status: number, title: string, detail: string): Response {
  return json(
    {
      type: `https://grimoire.local/problems/${status}`,
      title,
      status,
      detail,
    },
    status
  );
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function routePath(request: Request): { pathname: string; url: URL } {
  const url = new URL(request.url);
  const pathname = url.pathname.startsWith(DEMO_API_PATH)
    ? url.pathname.slice(DEMO_API_PATH.length) || "/"
    : url.pathname;
  return { pathname, url };
}

async function requestJson<T>(request: Request): Promise<T> {
  const raw = await request.text();
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Request body is not valid JSON");
  }
}

function parsePaging(url: URL): { limit: number; offset: number } {
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
  const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  return {
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 20,
    offset: Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0,
  };
}

function parseFlag(value: string | null): 0 | 1 | null {
  if (value === null || value === "") return null;
  if (value === "true" || value === "1") return 1;
  if (value === "false" || value === "0") return 0;
  return null;
}

function applyBookmarkFilters(state: DemoState, source: DemoState["bookmarks"], url: URL) {
  let rows = [...source];
  const readLater = parseFlag(url.searchParams.get("read_later"));
  if (url.searchParams.has("read_later") && readLater === null) return "invalid-read-later" as const;
  if (readLater !== null) rows = rows.filter((bookmark) => bookmark.read_later === readLater);

  const readState = url.searchParams.get("read_state");
  if (readState === "read") rows = rows.filter((bookmark) => bookmark.read_at !== null);
  if (readState === "unread") rows = rows.filter((bookmark) => bookmark.read_at === null);

  const pinned = parseFlag(url.searchParams.get("is_pinned"));
  if (pinned !== null) rows = rows.filter((bookmark) => bookmark.is_pinned === pinned);

  const categoryId = url.searchParams.get("category_id");
  if (categoryId) {
    const categoryIds = new Set([categoryId]);
    const descendants = flattenCategories(state.categories).filter((category) => category.parent_id === categoryId);
    descendants.forEach((category) => categoryIds.add(category.id));
    rows = rows.filter((bookmark) => bookmark.category_id !== null && categoryIds.has(bookmark.category_id));
  }

  const categoryName = url.searchParams.get("category")?.toLowerCase();
  if (categoryName) {
    const matchingIds = new Set(
      flattenCategories(state.categories)
        .filter((category) => category.name.toLowerCase() === categoryName)
        .map((category) => category.id)
    );
    rows = rows.filter((bookmark) => bookmark.category_id !== null && matchingIds.has(bookmark.category_id));
  }

  const tag = url.searchParams.get("tag")?.toLowerCase();
  if (tag) rows = rows.filter((bookmark) => bookmark.tags.some((item) => item.toLowerCase() === tag));

  const domain = url.searchParams.get("domain")?.toLowerCase();
  if (domain) rows = rows.filter((bookmark) => bookmark.domain.toLowerCase() === domain);

  const dateFrom = url.searchParams.get("date_from");
  if (dateFrom) rows = rows.filter((bookmark) => bookmark.created_at.slice(0, 10) >= dateFrom);
  const dateTo = url.searchParams.get("date_to");
  if (dateTo) rows = rows.filter((bookmark) => bookmark.created_at.slice(0, 10) <= dateTo);

  const openedMin = Number.parseInt(url.searchParams.get("opened_count_min") ?? "", 10);
  if (Number.isFinite(openedMin)) rows = rows.filter((bookmark) => bookmark.opened_count >= openedMin);
  const openedMax = Number.parseInt(url.searchParams.get("opened_count_max") ?? "", 10);
  if (Number.isFinite(openedMax)) rows = rows.filter((bookmark) => bookmark.opened_count <= openedMax);

  const lastOpenedFrom = url.searchParams.get("last_opened_from");
  if (lastOpenedFrom) rows = rows.filter((bookmark) => (bookmark.last_opened_at ?? "") >= lastOpenedFrom);
  const lastOpenedTo = url.searchParams.get("last_opened_to");
  if (lastOpenedTo) rows = rows.filter((bookmark) => (bookmark.last_opened_at ?? "") <= `${lastOpenedTo}T23:59:59.999Z`);

  return rows;
}

function sortBookmarks<T extends { title: string | null; domain: string; created_at: string; updated_at: string; opened_count: number; last_opened_at: string | null }>(
  rows: T[],
  url: URL
): T[] {
  const sort = url.searchParams.get("sort") ?? "created_at";
  const direction = url.searchParams.get("direction") === "asc" ? 1 : -1;
  const value = (row: T): string | number => {
    if (sort === "title") return (row.title ?? "").toLowerCase();
    if (sort === "domain") return row.domain.toLowerCase();
    if (sort === "opened_count") return row.opened_count;
    if (sort === "last_opened_at") return row.last_opened_at ?? "";
    if (sort === "updated_at") return row.updated_at;
    return row.created_at;
  };
  return [...rows].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    const comparison = typeof a === "string" && typeof b === "string"
      ? a.localeCompare(b)
      : a === b
        ? 0
        : a < b
          ? -1
          : 1;
    if (comparison !== 0) return comparison * direction;
    return right.created_at.localeCompare(left.created_at);
  });
}

function paginatedRows<T>(rows: T[], url: URL) {
  const { limit, offset } = parsePaging(url);
  const data = rows.slice(offset, offset + limit);
  return {
    data,
    pagination: { total: rows.length, limit, offset, has_more: offset + data.length < rows.length },
  };
}

function activeBookmarks(state: DemoState) {
  return state.bookmarks.filter((bookmark) => bookmark.is_archived === 0 && bookmark.is_trashed === 0);
}

function categoryTreeWithCounts(state: DemoState): CategoryNodeDto[] {
  return state.categories;
}

function makeDetail(bookmark: DemoState["bookmarks"][number]) {
  return {
    ...detailResponse(bookmark),
    media: { favicon: null, screenshot: null, images: [] },
  };
}

function parseBookmarkId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "bookmarks" ? parts[1] ?? null : null;
}

function csvField(value: string | number | null): string {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

async function handleBookmarks(request: Request, state: DemoState, pathname: string, url: URL): Promise<Response> {
  const method = request.method;
  const id = parseBookmarkId(pathname);
  const parts = pathname.split("/").filter(Boolean);

  if (pathname === "/bookmarks/aggregates" && method === "GET") {
    const filtered = applyBookmarkFilters(state, activeBookmarks(state), url);
    if (filtered === "invalid-read-later") return problem(422, "Invalid read_later filter", "`read_later` must be true, false, 1, or 0");
    const rows = filtered as typeof state.bookmarks;
    return json({
      data: {
        total: rows.length,
        categories: flattenCategories(state.categories).map((category) => ({
          id: category.id,
          name: category.name,
          count: rows.filter((bookmark) => bookmark.category_id === category.id).length,
        })),
        tags: [...new Set(rows.flatMap((bookmark) => bookmark.tags))].sort((left, right) => left.localeCompare(right)).map((name) => ({
          name,
          count: rows.filter((bookmark) => bookmark.tags.includes(name)).length,
        })),
        domains: [...new Set(rows.map((bookmark) => bookmark.domain))].sort((left, right) => left.localeCompare(right)).map((domain) => ({
          domain,
          count: rows.filter((bookmark) => bookmark.domain === domain).length,
        })),
        read: { read: rows.filter((bookmark) => bookmark.read_at !== null).length, unread: rows.filter((bookmark) => bookmark.read_at === null).length },
        pinned: { pinned: rows.filter((bookmark) => bookmark.is_pinned === 1).length, unpinned: rows.filter((bookmark) => bookmark.is_pinned === 0).length },
        read_later: { yes: rows.filter((bookmark) => bookmark.read_later === 1).length, no: rows.filter((bookmark) => bookmark.read_later === 0).length },
      },
    });
  }

  if (pathname === "/bookmarks" && method === "GET") {
    const source = url.searchParams.get("archived") === "true"
      ? state.bookmarks.filter((bookmark) => bookmark.is_archived === 1 && bookmark.is_trashed === 0)
      : activeBookmarks(state);
    const filtered = applyBookmarkFilters(state, source, url);
    if (filtered === "invalid-read-later") return problem(422, "Invalid read_later filter", "`read_later` must be true, false, 1, or 0");
    return json(paginatedRows(sortBookmarks((filtered as typeof state.bookmarks).map(bookmarkResponse), url), url));
  }

  if (pathname === "/bookmarks" && method === "POST") {
    let body: BookmarkCreateRequestDto;
    try {
      body = await requestJson<BookmarkCreateRequestDto>(request);
      const parsedUrl = new URL(body.url);
      if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("Unsupported URL");
    } catch {
      return problem(422, "Invalid bookmark URL", "Only public HTTP and HTTPS URLs can be saved.");
    }
    const now = new Date().toISOString();
    const created: MutableDemoBookmark = {
      id: nextSessionBookmarkId(),
      url: body.url,
      domain: new URL(body.url).hostname,
      title: body.title ?? new URL(body.url).hostname,
      description: "A session-only bookmark added while exploring the public demo.",
      status: "saved",
      category_id: null,
      favicon_url: null,
      screenshot_url: null,
      is_pinned: 0,
      is_archived: 0,
      is_trashed: 0,
      trashed_at: null,
      read_later: 0,
      read_at: null,
      opened_count: 0,
      last_opened_at: null,
      notes: null,
      created_at: now,
      updated_at: now,
      tags: ["session", "demo"],
      content: null,
    };
    state.bookmarks.unshift(created);
    refreshCategoryCounts();
    return json({ data: bookmarkResponse(created) }, 201);
  }

  if (!id) return problem(404, "Bookmark not found", "The requested bookmark does not exist in the demo library.");
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) return problem(404, "Bookmark not found", "The requested bookmark does not exist in the demo library.");

  if (parts[2] === "status" && method === "GET") {
    return json({ data: { bookmarkId: id, bookmarkStatus: bookmark.status, job: null } });
  }

  if (parts[2] === "related" && method === "GET") {
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "5", 10) || 5));
    const related = activeBookmarks(state)
      .filter((candidate) => candidate.id !== id)
      .map((candidate) => {
        const sharedTags = candidate.tags.filter((tag) => bookmark.tags.includes(tag)).length;
        const sameDomain = candidate.domain === bookmark.domain ? 1 : 0;
        return { candidate, score: sharedTags * 2 + sameDomain };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => bookmarkResponse(item.candidate));
    return json({ data: related });
  }

  if (parts[2] === "open" && method === "POST") {
    bookmark.opened_count += 1;
    bookmark.last_opened_at = new Date().toISOString();
    bookmark.updated_at = bookmark.last_opened_at;
    return json({ data: bookmarkResponse(bookmark) });
  }

  if (parts[2] === "restore" && method === "POST") {
    bookmark.is_trashed = 0;
    bookmark.trashed_at = null;
    bookmark.updated_at = new Date().toISOString();
    refreshCategoryCounts();
    return json({ data: bookmarkResponse(bookmark) });
  }

  if (parts[2] === "permanent" && method === "DELETE") {
    if (bookmark.is_trashed !== 1) return problem(404, "Bookmark is not in trash", "Only trashed bookmarks can be permanently deleted.");
    state.bookmarks = state.bookmarks.filter((item) => item.id !== id);
    refreshCategoryCounts();
    return noContent();
  }

  if (parts.length === 2 && method === "GET") return json({ data: makeDetail(bookmark) });

  if (parts.length === 2 && method === "PUT") {
    let patch: BookmarkUpdateRequestDto;
    try {
      patch = await requestJson<BookmarkUpdateRequestDto>(request);
    } catch {
      return problem(400, "Invalid bookmark update", "The update body is not valid JSON.");
    }
    Object.assign(bookmark, patch, { updated_at: new Date().toISOString() });
    refreshCategoryCounts();
    return json({ data: bookmarkResponse(bookmark) });
  }

  if (parts.length === 2 && method === "DELETE") {
    bookmark.is_trashed = 1;
    bookmark.trashed_at = new Date().toISOString();
    bookmark.updated_at = bookmark.trashed_at;
    refreshCategoryCounts();
    return noContent();
  }

  return problem(404, "Route not found", `${method} ${pathname}`);
}

async function handleSearch(state: DemoState, url: URL): Promise<Response> {
  const mode = url.searchParams.get("mode") ?? "keyword";
  if (mode === "hybrid" || mode === "semantic") {
    return problem(
      422,
      "Search mode unavailable",
      `mode=${mode} requires an embedding provider to be configured`
    );
  }

  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const filtered = applyBookmarkFilters(state, activeBookmarks(state), url);
  if (filtered === "invalid-read-later") return problem(422, "Invalid read_later filter", "`read_later` must be true, false, 1, or 0");
  const matches = sortBookmarks(
    (filtered as typeof state.bookmarks)
      .filter((bookmark) => {
        if (!query) return true;
        return [bookmark.url, bookmark.domain, bookmark.title ?? "", bookmark.description ?? "", bookmark.notes ?? "", ...bookmark.tags]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .map((bookmark) => ({ ...bookmarkResponse(bookmark), snippet: bookmark.description, rank: 1 })),
    url
  );
  return json({ ...paginatedRows(matches, url), meta: { mode } });
}

function handleTimeline(state: DemoState, url: URL): Response {
  return json(paginatedRows(state.timeline, url));
}

function handleExport(state: DemoState, url: URL): Response {
  const filtered = applyBookmarkFilters(state, activeBookmarks(state), url);
  if (filtered === "invalid-read-later") return problem(422, "Invalid read_later filter", "`read_later` must be true, false, 1, or 0");
  const rows = (filtered as typeof state.bookmarks).map(bookmarkResponse);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  if (format === "csv") {
    const body = [
      "url,title,description,tags,read_later,opened_count,last_opened_at",
      ...rows.map((row) => [
        csvField(row.url),
        csvField(row.title),
        csvField(row.description),
        csvField(row.tags.join(";")),
        csvField(row.read_later),
        csvField(row.opened_count),
        csvField(row.last_opened_at),
      ].join(",")),
    ].join("\n") + "\n";
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="grimoire-demo.csv"' },
    });
  }
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="grimoire-demo.json"' },
  });
}

export async function handleDemoRequest(request: Request): Promise<Response> {
  const { pathname, url } = routePath(request);
  const state = getDemoState();
  const method = request.method;

  if (pathname === "/health" && method === "GET") {
    return json({ status: "ok", version: "1.0.0-demo", uptime: 1000, queueSize: 0 });
  }
  if (pathname.startsWith("/bookmarks")) return handleBookmarks(request, state, pathname, url);
  if (pathname === "/trash" && method === "GET") {
    return json({ data: state.bookmarks.filter((bookmark) => bookmark.is_trashed === 1).map(bookmarkResponse) });
  }
  if (pathname === "/search" && method === "GET") return handleSearch(state, url);
  if (pathname === "/categories" && method === "GET") return json({ data: categoryTreeWithCounts(state) });
  if (pathname === "/tags" && method === "GET") {
    const rows = activeBookmarks(state);
    const names = [...new Set(rows.flatMap((bookmark) => bookmark.tags))].sort((left, right) => left.localeCompare(right));
    return json({ data: names.map((name, index) => ({ id: `tag-${index + 1}`, name, created_at: "2026-07-01T09:00:00.000Z", bookmark_count: rows.filter((bookmark) => bookmark.tags.includes(name)).length })) });
  }
  if (pathname === "/domains" && method === "GET") {
    const rows = activeBookmarks(state);
    const domains = [...new Set(rows.map((bookmark) => bookmark.domain))].sort((left, right) => left.localeCompare(right));
    return json({ data: domains.map((domain) => ({ domain, count: rows.filter((bookmark) => bookmark.domain === domain).length })) });
  }
  if (pathname === "/timeline" && method === "GET") return handleTimeline(state, url);
  if (pathname === "/suggestions" && method === "GET") {
    const pending = state.suggestions.filter((suggestion) => suggestion.status === "pending");
    return json({ data: pending, meta: { pending: pending.length } });
  }
  if (pathname.startsWith("/suggestions/") && method === "POST") {
    const parts = pathname.split("/").filter(Boolean);
    const suggestion = state.suggestions.find((item) => item.id === parts[1]);
    if (!suggestion) return problem(404, "Suggestion not found", "The requested demo suggestion does not exist.");
    if (suggestion.status !== "pending") return problem(422, "Suggestion is no longer pending", "This demo suggestion has already been resolved.");
    suggestion.status = parts[2] === "accept" ? "accepted" : "rejected";
    suggestion.resolved_at = new Date().toISOString();
    return json({ data: suggestion });
  }
  if (pathname === "/settings" && method === "GET") return json({ data: state.settings });
  if (pathname === "/settings" && method === "PUT") {
    return problem(501, "Settings are read-only in the public demo", "Install Grimoire to configure providers and local settings.");
  }
  if (pathname === "/export" && method === "GET") return handleExport(state, url);

  if (pathname === "/import" || pathname === "/import/preview" || pathname === "/demo/load") {
    return problem(501, "Import is not available in the public demo", "Install Grimoire to import bookmarks into a private local library.");
  }

  return problem(501, "Not available in the public demo", `${method} ${pathname} is not part of the read-only demo surface.`);
}
