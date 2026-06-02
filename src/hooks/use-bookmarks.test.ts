import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useBookmarks, bookmarkKeys } from "./use-bookmarks";
import type {
  ApiBookmark,
  ApiCategory,
  ApiDomain,
  ApiTag,
  ListBookmarksParams,
  SearchParams,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeApiBookmark(overrides: Partial<ApiBookmark> = {}): ApiBookmark {
  return {
    id: "bm-1",
    url: "https://example.com",
    domain: "example.com",
    title: "Example",
    description: "A summary",
    status: "ai_enriched",
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
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    tags: [],
    ...overrides,
  };
}

function makeApiCategory(overrides: Partial<ApiCategory> = {}): ApiCategory {
  return {
    id: "cat-1",
    name: "Tech",
    parent_id: null,
    color: null,
    icon: null,
    description: null,
    slug: null,
    is_archived: 0,
    is_public: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    bookmark_count: 0,
    children: [],
    ...overrides,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// ─── Mock API module ──────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  DAEMON_URL: "http://127.0.0.1:3210",
  listBookmarks: vi.fn(),
  searchBookmarks: vi.fn(),
  getRelatedBookmarks: vi.fn(),
  createBookmark: vi.fn(),
  updateBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  restoreBookmark: vi.fn(),
  listCategories: vi.fn(),
  listDomains: vi.fn(),
  listTags: vi.fn(),
}));

import * as api from "@/lib/api";

type Pagination = {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};
type BookmarkListResponse = { data: ApiBookmark[]; pagination: Pagination };
type CategoryTreeResponse = { data: ApiCategory[] };
type DomainListResponse = { data: ApiDomain[] };
type TagListResponse = { data: ApiTag[] };
type SearchHit = ApiBookmark & { snippet: string | null; rank: number | null };
type SearchResponse = {
  data: SearchHit[];
  pagination: Pagination;
  meta: { mode: "keyword" | "semantic" | "hybrid" };
};
type MockedAsyncFn<Args extends unknown[], Result> = ((...args: Args) => Promise<Result>) & {
  mockResolvedValue(value: Result): void;
  mockImplementation(fn: (...args: Args) => Promise<Result>): void;
  mock: { calls: Args[] };
};

const mockedListBookmarks = api.listBookmarks as unknown as MockedAsyncFn<[ListBookmarksParams?], BookmarkListResponse>;
const mockedListCategories = api.listCategories as unknown as MockedAsyncFn<[], CategoryTreeResponse>;
const mockedListDomains = api.listDomains as unknown as MockedAsyncFn<[], DomainListResponse>;
const mockedListTags = api.listTags as unknown as MockedAsyncFn<[], TagListResponse>;
const mockedSearchBookmarks = api.searchBookmarks as unknown as MockedAsyncFn<[SearchParams], SearchResponse>;
const mockedUpdateBookmark = api.updateBookmark as unknown as MockedAsyncFn<[string, Record<string, unknown>], { data: ApiBookmark }>;

function pagination(total: number): Pagination {
  return {
    total,
    limit: 200,
    offset: 0,
    has_more: false,
  };
}

function pagePagination(total: number, limit: number, offset: number): Pagination {
  return {
    total,
    limit,
    offset,
    has_more: offset + limit < total,
  };
}

function bookmarkListResponse(data: ApiBookmark[]): BookmarkListResponse {
  return {
    data,
    pagination: pagination(data.length),
  };
}

function bookmarkPageResponse(data: ApiBookmark[], total: number, limit: number, offset: number): BookmarkListResponse {
  return {
    data,
    pagination: pagePagination(total, limit, offset),
  };
}

function categoryTreeResponse(data: ApiCategory[]): CategoryTreeResponse {
  return { data };
}

function domainListResponse(data: ApiDomain[] = []): DomainListResponse {
  return { data };
}

function tagListResponse(data: ApiTag[] = []): TagListResponse {
  return { data };
}

function searchResponse(data: SearchResponse["data"] = []): SearchResponse {
  return {
    data,
    pagination: pagination(data.length),
    meta: { mode: "keyword" },
  };
}

function searchPageResponse(
  data: SearchResponse["data"],
  total: number,
  limit: number,
  offset: number
): SearchResponse {
  return {
    data,
    pagination: pagePagination(total, limit, offset),
    meta: { mode: "keyword" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListCategories.mockResolvedValue(categoryTreeResponse([]));
  mockedListDomains.mockResolvedValue(domainListResponse());
  mockedListTags.mockResolvedValue(tagListResponse());
  mockedListBookmarks.mockResolvedValue(bookmarkListResponse([]));
  mockedSearchBookmarks.mockResolvedValue(searchResponse());
  mockedUpdateBookmark.mockResolvedValue({ data: makeApiBookmark() });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useBookmarks — initial state", () => {
  it("returns empty arrays before data loads", () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    expect(result.current.bookmarks).toEqual([]);
    expect(result.current.filteredBookmarks).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("defaults: searchQuery='', sortBy='newest', searchMode='keyword'", () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    expect(result.current.searchQuery).toBe("");
    expect(result.current.sortBy).toBe("newest");
    expect(result.current.searchMode).toBe("keyword");
    expect(result.current.selectedCategory).toBeNull();
    expect(result.current.selectedTag).toBeNull();
    expect(result.current.selectedDomain).toBeNull();
  });
});

describe("useBookmarks — data normalisation", () => {
  it("normalises API bookmarks to UIBookmark shape", async () => {
    const bm = makeApiBookmark({ id: "bm-42", title: "Hello", description: "Desc" });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ui = result.current.bookmarks[0];
    expect(ui.id).toBe("bm-42");
    expect(ui.title).toBe("Hello");
    expect(ui.summary).toBe("Desc");
    expect(ui.domain).toBe("example.com");
    expect(ui.category).toBe("Uncategorized");
    expect(ui.read_later).toBe(0);
  });

  it("falls back to url when title is null", async () => {
    const bm = makeApiBookmark({ title: null });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks[0].title).toBe("https://example.com");
    expect(result.current.bookmarks[0].rawTitle).toBeNull();
  });

  it("resolves category name via categoryMap", async () => {
    mockedListCategories.mockResolvedValue({
      data: [makeApiCategory()],
    });
    const bm = makeApiBookmark({ category_id: "cat-1" });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.bookmarks[0].category).toBe("Tech"));
  });

  it("uses a local generated fallback favicon when favicon_url is null", async () => {
    const bm = makeApiBookmark({ favicon_url: null, domain: "example.com" });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks[0].favicon).toMatch(/^data:image\/svg\+xml,/);
    expect(result.current.bookmarks[0].favicon).not.toContain("google.com");
  });

  it("normalises local daemon media paths for cached favicons", async () => {
    const bm = makeApiBookmark({ favicon_url: "/media/bookmarks/bm-1/icon" });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks[0].favicon).toBe("http://127.0.0.1:3210/media/bookmarks/bm-1/icon");
  });
});

describe("useBookmarks — sorting", () => {
  const older = makeApiBookmark({ id: "a", created_at: "2023-01-01T00:00:00Z", title: "Banana" });
  const newer = makeApiBookmark({ id: "b", created_at: "2024-06-01T00:00:00Z", title: "Apple" });

  beforeEach(() => {
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([older, newer]));
  });

  it("sorts newest first by default", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ids = result.current.filteredBookmarks.map((b) => b.id);
    expect(ids).toEqual(["b", "a"]);
  });

  it("sorts oldest first when sortBy=oldest", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSortBy("oldest"));
    expect(result.current.filteredBookmarks.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("sorts title A-Z", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSortBy("title-az"));
    expect(result.current.filteredBookmarks.map((b) => b.title)).toEqual(["Apple", "Banana"]);
  });

  it("sorts title Z-A", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSortBy("title-za"));
    expect(result.current.filteredBookmarks.map((b) => b.title)).toEqual(["Banana", "Apple"]);
  });
});

describe("useBookmarks — search", () => {
  it("does not call searchBookmarks when searchQuery is empty", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(mockedSearchBookmarks).not.toHaveBeenCalled();
    expect(mockedListBookmarks).toHaveBeenCalled();
  });

  it("calls searchBookmarks when searchQuery is set (after debounce)", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setSearchQuery("react"));

    // Wait for the debounce (300ms) and then for the search call
    await waitFor(() => expect(mockedSearchBookmarks).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("passes the read-later filter to list and search requests", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setReadLaterOnly(true));
    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ read_later: true }))
    );

    act(() => result.current.setSearchQuery("react"));
    await waitFor(() =>
      expect(mockedSearchBookmarks).toHaveBeenCalledWith(expect.objectContaining({ read_later: true })),
      { timeout: 2000 }
    );
  });

  it("passes parity filters to list and search requests", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setReadStateFilter("unread"));
    act(() => result.current.setPinnedFilter("pinned"));
    act(() => result.current.setOpenActivityFilter("opened-2-plus"));
    act(() =>
      result.current.setLastOpenedRange({
        from: new Date("2026-06-01T00:00:00.000Z"),
        to: new Date("2026-06-02T00:00:00.000Z"),
      })
    );

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(
        expect.objectContaining({
          read_state: "unread",
          is_pinned: true,
          opened_count_min: 2,
          last_opened_from: "2026-06-01",
          last_opened_to: "2026-06-02",
        })
      )
    );
    expect(result.current.libraryParityFilterParams).toEqual({
      read_state: "unread",
      is_pinned: true,
      opened_count_min: 2,
      last_opened_from: "2026-06-01",
      last_opened_to: "2026-06-02",
    });

    act(() => result.current.setSearchQuery("react"));
    await waitFor(() =>
      expect(mockedSearchBookmarks).toHaveBeenCalledWith(
        expect.objectContaining({
          read_state: "unread",
          is_pinned: true,
          opened_count_min: 2,
          last_opened_from: "2026-06-01",
          last_opened_to: "2026-06-02",
        })
      ),
      { timeout: 2000 }
    );
  });

  it("invalidates active search results after read-later updates", async () => {
    const bookmark = makeApiBookmark({ id: "bm-read-later", title: "React Guide", read_later: 1 });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bookmark]));
    mockedSearchBookmarks.mockResolvedValue(searchResponse([{ ...bookmark, snippet: null, rank: 1 }]));
    mockedUpdateBookmark.mockResolvedValue({ data: { ...bookmark, read_later: 0 } });

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setReadLaterOnly(true));
    act(() => result.current.setSearchQuery("react"));
    await waitFor(() => expect(mockedSearchBookmarks).toHaveBeenCalled(), { timeout: 2000 });

    const searchCallsBeforeUpdate = mockedSearchBookmarks.mock.calls.length;

    act(() => result.current.clearReadLater("bm-read-later"));

    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenCalledWith("bm-read-later", { read_later: 0 }));
    await waitFor(() => expect(mockedSearchBookmarks.mock.calls.length).toBeGreaterThan(searchCallsBeforeUpdate));
  });
});

describe("useBookmarks — pagination", () => {
  it("requests daemon library pages and exposes page metadata", async () => {
    mockedListBookmarks.mockImplementation(async (params = {}) => {
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;
      if (offset === 20) {
        return bookmarkPageResponse(
          [makeApiBookmark({ id: "bm-21", title: "Second page" })],
          21,
          limit,
          offset
        );
      }
      return bookmarkPageResponse(
        [makeApiBookmark({ id: "bm-1", title: "First page" })],
        21,
        limit,
        offset
      );
    });

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(mockedListBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
    expect(result.current.pagination.total).toBe(21);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageStart).toBe(1);
    expect(result.current.pageEnd).toBe(1);
    expect(result.current.filteredBookmarks.map((bookmark) => bookmark.id)).toEqual(["bm-1"]);

    act(() => result.current.goToNextPage());

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 }))
    );
    await waitFor(() => expect(result.current.filteredBookmarks.map((bookmark) => bookmark.id)).toEqual(["bm-21"]));
    expect(result.current.currentPage).toBe(2);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.pageStart).toBe(21);
    expect(result.current.pageEnd).toBe(21);
  });

  it("uses daemon pagination for search results", async () => {
    const first = makeApiBookmark({ id: "bm-search-1", title: "Search page one" });
    const second = makeApiBookmark({ id: "bm-search-21", title: "Search page two" });
    mockedSearchBookmarks.mockImplementation(async (params) => {
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;
      if (offset === 20) {
        return searchPageResponse([{ ...second, snippet: null, rank: 0.5 }], 21, limit, offset);
      }
      return searchPageResponse([{ ...first, snippet: null, rank: 1 }], 21, limit, offset);
    });

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setSearchQuery("react"));

    await waitFor(() =>
      expect(mockedSearchBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 0 })),
      { timeout: 2000 }
    );

    act(() => result.current.goToNextPage());

    await waitFor(() =>
      expect(mockedSearchBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 })),
      { timeout: 2000 }
    );
    await waitFor(() =>
      expect(result.current.filteredBookmarks.map((bookmark) => bookmark.id)).toEqual(["bm-search-21"])
    );
  });

  it("updates the page selection key immediately when search input changes", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    const initialSelectionKey = result.current.pageSelectionKey;

    act(() => result.current.setSearchQuery("react"));

    expect(result.current.pageSelectionKey).not.toBe(initialSelectionKey);
    expect(JSON.parse(result.current.pageSelectionKey)).toMatchObject({
      q: "react",
      pageOffset: 0,
    });
  });

  it("resets to the first page when filters or page size change", async () => {
    mockedListBookmarks.mockImplementation(async (params = {}) => {
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;
      return bookmarkPageResponse(
        [makeApiBookmark({ id: `bm-${offset}`, title: `Offset ${offset}` })],
        60,
        limit,
        offset
      );
    });

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.goToNextPage());
    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 }))
    );

    act(() => result.current.setSelectedDomain("example.com"));
    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: "example.com", limit: 20, offset: 0 })
      )
    );

    act(() => result.current.goToNextPage());
    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: "example.com", limit: 20, offset: 20 })
      )
    );

    act(() => result.current.setPageSize(50));
    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: "example.com", limit: 50, offset: 0 })
      )
    );
  });

  it("recovers from an empty out-of-range daemon page", async () => {
    mockedListBookmarks.mockImplementation(async (params = {}) => {
      const limit = params.limit ?? 20;
      const offset = params.offset ?? 0;
      if (offset === 20) {
        return bookmarkPageResponse([], 19, limit, offset);
      }
      return bookmarkPageResponse(
        [makeApiBookmark({ id: "bm-valid", title: "Valid page" })],
        19,
        limit,
        offset
      );
    });

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.goToNextPage());

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 20 }))
    );
    await waitFor(() => expect(result.current.currentPage).toBe(1));
    expect(result.current.filteredBookmarks.map((bookmark) => bookmark.id)).toEqual(["bm-valid"]);
  });
});

describe("useBookmarks — bookmark mutation patches", () => {
  it("sends supported detail mutations through the central API client", async () => {
    mockedListCategories.mockResolvedValue(categoryTreeResponse([
      makeApiCategory({ id: "cat-2", name: "Research" }),
    ]));
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([makeApiBookmark({ id: "bm-1" })]));
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.updateBookmarkField("bm-1", "title", "Renamed"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { title: "Renamed" }));

    act(() => result.current.updateBookmarkTags("bm-1", ["typescript", "testing"]));
    await waitFor(() =>
      expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { tags: ["typescript", "testing"] })
    );

    act(() => result.current.updateBookmarkCategory("bm-1", "Research"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { category_id: "cat-2" }));

    act(() => result.current.pinBookmark("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { is_pinned: 1 }));

    act(() => result.current.unpinBookmark("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { is_pinned: 0 }));

    act(() => result.current.markReadLater("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { read_later: 1 }));

    act(() => result.current.clearReadLater("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { read_later: 0 }));

    act(() => result.current.archiveBookmark("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { is_archived: 1 }));

    act(() => result.current.unarchiveBookmark("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { is_archived: 0 }));

    act(() => result.current.markAsRead("bm-1"));
    await waitFor(() =>
      expect(mockedUpdateBookmark).toHaveBeenLastCalledWith(
        "bm-1",
        expect.objectContaining({ read_at: expect.any(String) })
      )
    );

    act(() => result.current.markAsUnread("bm-1"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { read_at: null }));

    act(() => result.current.updateBookmarkNotes("bm-1", "note"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { notes: "note" }));

    act(() => result.current.updateBookmarkNotes("bm-1", null));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { notes: null }));
  });

  it("does not send unsupported URL or summary edits to the daemon", async () => {
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([makeApiBookmark({ id: "bm-1" })]));
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.updateBookmarkField("bm-1", "url", "https://example.com/new"));
    act(() => result.current.updateBookmarkField("bm-1", "summary", "new summary"));

    expect(mockedUpdateBookmark).not.toHaveBeenCalled();
  });

  it("refreshes category and tag aggregates after bookmark category and tag changes", async () => {
    mockedListCategories.mockResolvedValue(categoryTreeResponse([
      makeApiCategory({ id: "cat-research", name: "Research", bookmark_count: 0 }),
    ]));
    mockedListTags.mockResolvedValue(tagListResponse([
      {
        id: "tag-typescript",
        name: "typescript",
        created_at: "2026-06-01T08:00:00Z",
        bookmark_count: 1,
      },
    ]));
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([makeApiBookmark({ id: "bm-1" })]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    const categoryCallsBeforeCategoryChange = mockedListCategories.mock.calls.length;
    act(() => result.current.updateBookmarkCategory("bm-1", "Research"));
    await waitFor(() => expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { category_id: "cat-research" }));
    await waitFor(() =>
      expect(mockedListCategories.mock.calls.length).toBeGreaterThan(categoryCallsBeforeCategoryChange)
    );

    const tagCallsBeforeTagChange = mockedListTags.mock.calls.length;
    act(() => result.current.updateBookmarkTags("bm-1", ["typescript", "testing"]));
    await waitFor(() =>
      expect(mockedUpdateBookmark).toHaveBeenLastCalledWith("bm-1", { tags: ["typescript", "testing"] })
    );
    await waitFor(() => expect(mockedListTags.mock.calls.length).toBeGreaterThan(tagCallsBeforeTagChange));
  });
});

describe("useBookmarks — recentBookmarks", () => {
  it("returns up to 5 most recently saved bookmarks", async () => {
    const bookmarks = Array.from({ length: 7 }, (_, i) =>
      makeApiBookmark({ id: `bm-${i}`, created_at: `2024-0${i + 1}-01T00:00:00Z` })
    );
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse(bookmarks));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.recentBookmarks).toHaveLength(5);
  });
});

describe("useBookmarks — tag / category / domain aggregates", () => {
  it("uses daemon tag counts independent of the loaded bookmark page", async () => {
    const bm1 = makeApiBookmark({ id: "a", tags: ["ts", "react"] });
    const bm2 = makeApiBookmark({ id: "b", tags: ["ts"] });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm1, bm2]));
    mockedListTags.mockResolvedValue(tagListResponse([
      {
        id: "tag-typescript",
        name: "typescript",
        created_at: "2026-05-31T12:00:00Z",
        bookmark_count: 42,
      },
      {
        id: "tag-react",
        name: "react",
        created_at: "2026-05-31T12:00:00Z",
        bookmark_count: 12,
      },
    ]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.tags).toEqual([
      { tag: "typescript", count: 42 },
      { tag: "react", count: 12 },
    ]);
    expect(result.current.tags.some((t) => t.tag === "ts")).toBe(false);
  });

  it("keeps full tag counts available when the current bookmark page is empty", async () => {
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([]));
    mockedListTags.mockResolvedValue(tagListResponse([
      {
        id: "tag-react",
        name: "react",
        created_at: "2026-05-31T12:00:00Z",
        bookmark_count: 7,
      },
    ]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    const react = result.current.tags.find((t) => t.tag === "react");
    expect(react?.count).toBe(7);
  });

  it("builds category navigation from the full category tree, including empty nested categories", async () => {
    mockedListCategories.mockResolvedValue(categoryTreeResponse([
      makeApiCategory({
        id: "cat-research",
        name: "Research",
        bookmark_count: 0,
        children: [
          makeApiCategory({
            id: "cat-ai",
            name: "AI Papers",
            parent_id: "cat-research",
            bookmark_count: 0,
          }),
        ],
      }),
      makeApiCategory({
        id: "cat-tools",
        name: "Tools",
        bookmark_count: 1,
      }),
    ]));
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([
      makeApiBookmark({ id: "bm-tools", category_id: "cat-tools" }),
    ]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.categories).toEqual([
      {
        id: "cat-research",
        name: "Research",
        count: 0,
        parentId: null,
        depth: 0,
        color: null,
        icon: null,
        description: null,
        slug: null,
        is_archived: 0,
        is_public: 0,
      },
      {
        id: "cat-ai",
        name: "AI Papers",
        count: 0,
        parentId: "cat-research",
        depth: 1,
        color: null,
        icon: null,
        description: null,
        slug: null,
        is_archived: 0,
        is_public: 0,
      },
      {
        id: "cat-tools",
        name: "Tools",
        count: 1,
        parentId: null,
        depth: 0,
        color: null,
        icon: null,
        description: null,
        slug: null,
        is_archived: 0,
        is_public: 0,
      },
    ]);
  });

  it("sends selected category IDs to list and search filters", async () => {
    mockedListCategories.mockResolvedValue(categoryTreeResponse([
      makeApiCategory({ id: "cat-research", name: "Research" }),
    ]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setSelectedCategory("Research"));

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({
        category: "Research",
        category_id: "cat-research",
      }))
    );

    act(() => result.current.setSearchQuery("vector"));

    await waitFor(
      () => expect(mockedSearchBookmarks).toHaveBeenCalledWith(expect.objectContaining({
        category: "Research",
        category_id: "cat-research",
      })),
      { timeout: 2000 }
    );
  });

  it("tracks selected category id separately from the category-name filter", async () => {
    mockedListCategories.mockResolvedValue(categoryTreeResponse([
      makeApiCategory({ id: "cat-one", name: "Notes" }),
      makeApiCategory({ id: "cat-two", name: "Notes" }),
    ]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    act(() => result.current.setSelectedCategory("Notes", "cat-two"));

    expect(result.current.selectedCategory).toBe("Notes");
    expect(result.current.selectedCategoryId).toBe("cat-two");
    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith(expect.objectContaining({
        category: "Notes",
        category_id: "cat-two",
      }))
    );
  });

  it("refreshes category, tag, and domain aggregates after an import completes", async () => {
    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    const categoryCallsBeforeImport = mockedListCategories.mock.calls.length;
    const tagCallsBeforeImport = mockedListTags.mock.calls.length;
    const domainCallsBeforeImport = mockedListDomains.mock.calls.length;

    act(() => result.current.importBookmarks());

    await waitFor(() => expect(mockedListCategories.mock.calls.length).toBeGreaterThan(categoryCallsBeforeImport));
    await waitFor(() => expect(mockedListTags.mock.calls.length).toBeGreaterThan(tagCallsBeforeImport));
    await waitFor(() => expect(mockedListDomains.mock.calls.length).toBeGreaterThan(domainCallsBeforeImport));
  });
});
