import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useBookmarks, bookmarkKeys } from "./use-bookmarks";
import type { ApiBookmark } from "@/lib/api";

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
    read_at: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    tags: [],
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

const mockedListBookmarks = vi.mocked(api.listBookmarks);
const mockedListCategories = vi.mocked(api.listCategories);
const mockedListDomains = vi.mocked(api.listDomains);
const mockedSearchBookmarks = vi.mocked(api.searchBookmarks);

beforeEach(() => {
  vi.clearAllMocks();
  mockedListCategories.mockResolvedValue({ data: [] } as any);
  mockedListDomains.mockResolvedValue({ data: [] } as any);
  mockedListBookmarks.mockResolvedValue({ data: [] } as any);
  mockedSearchBookmarks.mockResolvedValue({ data: [] } as any);
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
    mockedListBookmarks.mockResolvedValue({ data: [bm] } as any);

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ui = result.current.bookmarks[0];
    expect(ui.id).toBe("bm-42");
    expect(ui.title).toBe("Hello");
    expect(ui.summary).toBe("Desc");
    expect(ui.domain).toBe("example.com");
    expect(ui.category).toBe("Uncategorized");
  });

  it("falls back to url when title is null", async () => {
    const bm = makeApiBookmark({ title: null });
    mockedListBookmarks.mockResolvedValue({ data: [bm] } as any);

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks[0].title).toBe("https://example.com");
    expect(result.current.bookmarks[0].rawTitle).toBeNull();
  });

  it("resolves category name via categoryMap", async () => {
    mockedListCategories.mockResolvedValue({
      data: [{ id: "cat-1", name: "Tech", parent_id: null, created_at: "", updated_at: "" }],
    } as any);
    const bm = makeApiBookmark({ category_id: "cat-1" });
    mockedListBookmarks.mockResolvedValue({ data: [bm] } as any);

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.bookmarks[0].category).toBe("Tech"));
  });

  it("uses fallback favicon when favicon_url is null", async () => {
    const bm = makeApiBookmark({ favicon_url: null, domain: "example.com" });
    mockedListBookmarks.mockResolvedValue({ data: [bm] } as any);

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.bookmarks[0].favicon).toContain("example.com");
  });
});

describe("useBookmarks — sorting", () => {
  const older = makeApiBookmark({ id: "a", created_at: "2023-01-01T00:00:00Z", title: "Banana" });
  const newer = makeApiBookmark({ id: "b", created_at: "2024-06-01T00:00:00Z", title: "Apple" });

  beforeEach(() => {
    mockedListBookmarks.mockResolvedValue({ data: [older, newer] } as any);
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
});

describe("useBookmarks — recentBookmarks", () => {
  it("returns up to 5 most recently saved bookmarks", async () => {
    const bookmarks = Array.from({ length: 7 }, (_, i) =>
      makeApiBookmark({ id: `bm-${i}`, created_at: `2024-0${i + 1}-01T00:00:00Z` })
    );
    mockedListBookmarks.mockResolvedValue({ data: bookmarks } as any);

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    expect(result.current.recentBookmarks).toHaveLength(5);
  });
});

describe("useBookmarks — tag / category / domain aggregates", () => {
  it("builds tag counts from loaded bookmarks", async () => {
    const bm1 = makeApiBookmark({ id: "a", tags: ["ts", "react"] });
    const bm2 = makeApiBookmark({ id: "b", tags: ["ts"] });
    mockedListBookmarks.mockResolvedValue({ data: [bm1, bm2] } as any);

    const { result } = renderHook(() => useBookmarks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 });

    const ts = result.current.tags.find((t) => t.tag === "ts");
    expect(ts?.count).toBe(2);
    const react = result.current.tags.find((t) => t.tag === "react");
    expect(react?.count).toBe(1);
  });
});
