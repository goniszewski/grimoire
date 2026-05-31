import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useBookmarks, bookmarkKeys } from "./use-bookmarks";
import type {
  ApiBookmark,
  ApiCategory,
  ApiDomain,
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
  listBookmarks: vi.fn(),
  searchBookmarks: vi.fn(),
  getRelatedBookmarks: vi.fn(),
  createBookmark: vi.fn(),
  updateBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
  restoreBookmark: vi.fn(),
  listCategories: vi.fn(),
  listDomains: vi.fn(),
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
type SearchHit = ApiBookmark & { snippet: string | null; rank: number | null };
type SearchResponse = {
  data: SearchHit[];
  pagination: Pagination;
  meta: { mode: "keyword" | "semantic" | "hybrid" };
};
type MockedAsyncFn<Args extends unknown[], Result> = ((...args: Args) => Promise<Result>) & {
  mockResolvedValue(value: Result): void;
  mock: { calls: Args[] };
};

const mockedListBookmarks = api.listBookmarks as unknown as MockedAsyncFn<[ListBookmarksParams?], BookmarkListResponse>;
const mockedListCategories = api.listCategories as unknown as MockedAsyncFn<[], CategoryTreeResponse>;
const mockedListDomains = api.listDomains as unknown as MockedAsyncFn<[], DomainListResponse>;
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

function bookmarkListResponse(data: ApiBookmark[]): BookmarkListResponse {
  return {
    data,
    pagination: pagination(data.length),
  };
}

function categoryTreeResponse(data: ApiCategory[]): CategoryTreeResponse {
  return { data };
}

function domainListResponse(data: ApiDomain[] = []): DomainListResponse {
  return { data };
}

function searchResponse(data: SearchResponse["data"] = []): SearchResponse {
  return {
    data,
    pagination: pagination(data.length),
    meta: { mode: "keyword" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListCategories.mockResolvedValue(categoryTreeResponse([]));
  mockedListDomains.mockResolvedValue(domainListResponse());
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

  it("uses fallback favicon when favicon_url is null", async () => {
    const bm = makeApiBookmark({ favicon_url: null, domain: "example.com" });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks[0].favicon).toContain("example.com");
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
  it("builds tag counts from loaded bookmarks", async () => {
    const bm1 = makeApiBookmark({ id: "a", tags: ["ts", "react"] });
    const bm2 = makeApiBookmark({ id: "b", tags: ["ts"] });
    mockedListBookmarks.mockResolvedValue(bookmarkListResponse([bm1, bm2]));

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    const ts = result.current.tags.find((t) => t.tag === "ts");
    expect(ts?.count).toBe(2);
    const react = result.current.tags.find((t) => t.tag === "react");
    expect(react?.count).toBe(1);
  });
});
