import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Index from "./Index";
import type { UIBookmark, useBookmarks } from "@/hooks/use-bookmarks";

vi.mock("@/hooks/use-bookmarks", () => ({
  LIBRARY_PAGE_SIZE_OPTIONS: [20, 50, 100],
  useBookmarks: vi.fn(() => mockStore),
  useRelatedBookmarks: vi.fn(() => []),
}));

vi.mock("@/hooks/use-daemon-status", () => ({
  useDaemonStatus: vi.fn(() => ({ online: true, isChecking: false })),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn(() => ({ aiEnabled: false, isLoading: false })),
}));

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: vi.fn(() => ({
    showButtonLabels: true,
    viewMode: "grid",
    updatePreferences: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-app-lock", () => ({
  useAppLock: vi.fn(() => ({
    locked: false,
    unlock: vi.fn(),
    hasPassword: false,
    autoLockMinutes: 0,
    setPassword: vi.fn(),
    changePassword: vi.fn(),
    removePassword: vi.fn(),
    setAutoLockMinutes: vi.fn(),
    lockNow: vi.fn(),
  })),
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: ({ totalCount }: { totalCount: number }) => <aside>Sidebar {totalCount}</aside>,
}));

vi.mock("@/components/SearchBar", () => ({
  SearchBar: () => <input aria-label="Search bookmarks" />,
}));

vi.mock("@/components/BookmarkCard", () => ({
  BookmarkCard: ({
    bookmark,
    selectionMode,
    selected,
    onToggleSelect,
  }: {
    bookmark: UIBookmark;
    selectionMode: boolean;
    selected: boolean;
    onToggleSelect: (id: string) => void;
  }) => (
    <article>
      <button type="button" onClick={() => selectionMode && onToggleSelect(bookmark.id)}>
        Toggle {bookmark.title}
      </button>
      {selected && <span>{bookmark.title} selected</span>}
    </article>
  ),
}));

vi.mock("@/components/BookmarkDetail", () => ({ BookmarkDetail: () => null }));
vi.mock("@/components/AddBookmarkDialog", () => ({ AddBookmarkDialog: () => null }));
vi.mock("@/components/ImportDialog", () => ({ ImportDialog: () => null }));
vi.mock("@/components/AIPalette", () => ({ AIPalette: () => null }));
vi.mock("@/components/DaemonOfflineBanner", () => ({ DaemonOfflineBanner: () => null }));
vi.mock("@/components/DegradedModeBanner", () => ({ DegradedModeBanner: () => null }));
vi.mock("@/components/KeyboardShortcuts", () => ({ KeyboardShortcuts: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/DateRangeFilter", () => ({ DateRangeFilter: () => null }));
vi.mock("@/components/ExportMenu", () => ({
  ExportMenu: ({ filters }: { filters?: Record<string, unknown> }) => (
    <output data-testid="export-filters">{JSON.stringify(filters ?? {})}</output>
  ),
}));
vi.mock("@/components/PreferencesDialog", () => ({ PreferencesDialog: () => null }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

function makeBookmark(index: number): UIBookmark {
  return {
    id: `bm-${index}`,
    url: `https://example.com/${index}`,
    title: `Bookmark ${index}`,
    rawTitle: `Bookmark ${index}`,
    summary: "",
    domain: "example.com",
    favicon: "",
    tags: [],
    category: "Uncategorized",
    category_id: null,
    status: "indexed",
    savedAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-06-01T08:00:00Z",
    is_pinned: 0,
    is_archived: 0,
    read_later: 0,
    read_at: null,
    opened_count: 0,
    last_opened_at: null,
    notes: null,
  };
}

type MockStore = ReturnType<typeof useBookmarks>;

let mockStore: MockStore;

function makeStore(overrides: Partial<MockStore> = {}): MockStore {
  const bookmarks = Array.from({ length: 20 }, (_, index) => makeBookmark(index + 1));

  return {
    bookmarks,
    filteredBookmarks: bookmarks,
    recentBookmarks: bookmarks.slice(0, 5),
    pagination: { total: 55, limit: 20, offset: 0, has_more: true },
    pageSize: 20,
    setPageSize: vi.fn(),
    currentPage: 1,
    totalPages: 3,
    pageStart: 1,
    pageEnd: 20,
    canGoPreviousPage: false,
    canGoNextPage: true,
    goToPreviousPage: vi.fn(),
    goToNextPage: vi.fn(),
    isFetchingPage: false,
    pageSelectionKey: "page-1",
    libraryParityFilterParams: {},
    categories: [],
    categoriesLoading: false,
    categoriesError: false,
    tags: [],
    domains: [],
    searchQuery: "",
    setSearchQuery: vi.fn(),
    searchMode: "keyword" as const,
    setSearchMode: vi.fn(),
    selectedCategory: null,
    selectedCategoryId: null,
    setSelectedCategory: vi.fn(),
    selectedTag: null,
    setSelectedTag: vi.fn(),
    selectedDomain: null,
    setSelectedDomain: vi.fn(),
    readLaterOnly: false,
    setReadLaterOnly: vi.fn(),
    readStateFilter: "all" as const,
    setReadStateFilter: vi.fn(),
    pinnedFilter: "all" as const,
    setPinnedFilter: vi.fn(),
    openActivityFilter: "all" as const,
    setOpenActivityFilter: vi.fn(),
    lastOpenedRange: { from: null, to: null },
    setLastOpenedRange: vi.fn(),
    dateRange: { from: null, to: null },
    setDateRange: vi.fn(),
    sortBy: "newest" as const,
    setSortBy: vi.fn(),
    addBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    restoreBookmark: vi.fn(),
    updateBookmarkTags: vi.fn(),
    updateBookmarkCategory: vi.fn(),
    updateBookmarkField: vi.fn(),
    importBookmarks: vi.fn(),
    pinBookmark: vi.fn(),
    unpinBookmark: vi.fn(),
    markReadLater: vi.fn(),
    clearReadLater: vi.fn(),
    archiveBookmark: vi.fn(),
    unarchiveBookmark: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    updateBookmarkNotes: vi.fn(),
    isLoading: false,
    isError: false,
    ...overrides,
  };
}

function renderIndex() {
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockStore = makeStore();
});

describe("Index pagination", () => {
  it("renders page totals, page size control, and next/previous actions", () => {
    renderIndex();

    expect(screen.getByText("1-20 of 55")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Page size" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(mockStore.goToNextPage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  it("clears cross-page selections when the page context changes", async () => {
    const { rerender } = renderIndex();

    fireEvent.click(screen.getByRole("button", { name: /^Select$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle Bookmark 1" }));

    expect(screen.getByText("1 selected")).toBeInTheDocument();

    mockStore = makeStore({
      pagination: { total: 55, limit: 20, offset: 20, has_more: true },
      currentPage: 2,
      pageStart: 21,
      pageEnd: 40,
      canGoPreviousPage: true,
      pageSelectionKey: "page-2",
    });

    rerender(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.queryByText("1 selected")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Select$/ })).toBeInTheDocument();
  });
});

describe("Index parity filters", () => {
  it("renders dense filter controls and clears active filter badges", () => {
    mockStore = makeStore({
      readStateFilter: "unread",
      pinnedFilter: "pinned",
      openActivityFilter: "opened",
      lastOpenedRange: { from: new Date("2026-06-01T00:00:00.000Z"), to: null },
      libraryParityFilterParams: {
        read_state: "unread",
        is_pinned: true,
        opened_count_min: 1,
        last_opened_from: "2026-06-01",
      },
      setReadStateFilter: vi.fn(),
      setPinnedFilter: vi.fn(),
      setOpenActivityFilter: vi.fn(),
      setLastOpenedRange: vi.fn(),
    });

    renderIndex();

    expect(screen.getByRole("combobox", { name: "Read state filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Pinned filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Opened count filter" })).toBeInTheDocument();
    expect(screen.getAllByText("Unread").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pinned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Opened").length).toBeGreaterThan(0);
    expect(screen.getByText("Last opened")).toBeInTheDocument();
    expect(screen.getByTestId("export-filters").textContent).toContain('"read_state":"unread"');
    expect(screen.getByTestId("export-filters").textContent).toContain('"is_pinned":true');
    expect(screen.getByTestId("export-filters").textContent).toContain('"opened_count_min":1');
    expect(screen.getByTestId("export-filters").textContent).toContain('"last_opened_from":"2026-06-01"');

    fireEvent.click(screen.getAllByText("Unread")[0]);
    expect(mockStore.setReadStateFilter).toHaveBeenCalledWith("all");
  });
});
