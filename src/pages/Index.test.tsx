import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Index from "./Index";
import type { UIBookmark, useBookmarks } from "@/hooks/use-bookmarks";
import { usePreferences } from "@/hooks/use-preferences";
import { useUpdateCheck } from "@/hooks/use-update-check";

const tokensCss = readFileSync(resolve(process.cwd(), "tokens.css"), "utf8");
const indexCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

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
vi.mock("@/components/UpdateAvailableBanner", () => ({
  UpdateAvailableBanner: ({ latestTag, currentVersion, onDismiss }: { latestTag: string; currentVersion: string; onDismiss: () => void }) => (
    <div data-testid="update-banner">
      <span data-testid="update-tag">{latestTag}</span>
      <span data-testid="update-version">{currentVersion}</span>
      <button data-testid="dismiss-update" onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));
vi.mock("@/hooks/use-update-check", () => ({
  useUpdateCheck: vi.fn(() => ({
    showBanner: false,
    dismiss: vi.fn(),
    result: null,
    loading: false,
  })),
}));
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
    hasCustomLibraryPreferences: false,
    resetLibraryPreferences: vi.fn(),
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

function renderIndex(path = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
  const result = render(<Index />, { wrapper });
  return {
    ...result,
    rerender: () => result.rerender(<Index />),
  };
}

beforeEach(() => {
  mockStore = makeStore();
  vi.mocked(usePreferences).mockReturnValue({
    showButtonLabels: true,
    viewMode: "grid",
    updatePreferences: vi.fn(),
  });
  vi.mocked(useUpdateCheck).mockReturnValue({
    showBanner: false,
    dismiss: vi.fn(),
    result: null,
    loading: false,
  });
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

    rerender();

    await waitFor(() => expect(screen.queryByText("1 selected")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Select$/ })).toBeInTheDocument();
  });
});

describe("Quiet operational visual system", () => {
  it("uses shared quiet tokens and provides a reduced-motion fallback", () => {
    expect(tokensCss).toContain("--color-accent: oklch(");
    expect(tokensCss).toContain("--font-display:");
    expect(indexCss).toContain('@import url("../tokens.css")');
    expect(indexCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("Quiet Library hierarchy", () => {
  it("keeps secondary filters behind the refinement control", () => {
    renderIndex();

    expect(screen.getByRole("button", { name: "Refine library" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Pinned filter" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refine library" }));

    expect(screen.getByRole("combobox", { name: "Pinned filter" })).toBeInTheDocument();
  });

  it("renders compact list retrieval for the list view preference", () => {
    vi.mocked(usePreferences).mockReturnValue({
      showButtonLabels: true,
      viewMode: "list",
      updatePreferences: vi.fn(),
    });

    renderIndex();

    expect(screen.getByTestId("bookmark-results")).toHaveClass("flex-col");
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

    fireEvent.click(screen.getByRole("button", { name: "Refine library" }));

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

describe("Index library view preferences", () => {
  it("applies an explicit tag route over a saved local tag preference", async () => {
    const setSelectedTag = vi.fn();
    mockStore = makeStore({
      selectedTag: "saved-tag",
      setSelectedTag,
    });

    renderIndex("/?tag=shared-tag");

    await waitFor(() => expect(setSelectedTag).toHaveBeenCalledWith("shared-tag", { persist: false }));
  });

  it("does not clear a saved local tag preference on initial load without a tag route", () => {
    const setSelectedTag = vi.fn();
    mockStore = makeStore({
      selectedTag: "saved-tag",
      setSelectedTag,
    });

    renderIndex("/");

    expect(setSelectedTag).not.toHaveBeenCalled();
  });

  it("resets saved library filters and view mode from the toolbar command", () => {
    const resetLibraryPreferences = vi.fn();
    const updatePreferences = vi.fn();
    vi.mocked(usePreferences).mockReturnValue({
      showButtonLabels: true,
      viewMode: "list",
      updatePreferences,
    });
    mockStore = makeStore({
      hasCustomLibraryPreferences: true,
      resetLibraryPreferences,
    });

    renderIndex();

    fireEvent.click(screen.getByRole("button", { name: "Reset library view preferences" }));

    expect(resetLibraryPreferences).toHaveBeenCalledTimes(1);
    expect(updatePreferences).toHaveBeenCalledWith({ viewMode: "list" });
  });
});

describe("Index responsive header", () => {
  it("keeps the Add label out of the narrow header while preserving its accessible name", () => {
    renderIndex();

    expect(screen.getByRole("button", { name: "Add bookmark" })).toHaveTextContent("Add");
    expect(screen.getByText("Add")).toHaveClass("hidden", "sm:inline");
  });
});

describe("Index update notification banner", () => {
  it("does not render the update banner when no update is available", () => {
    renderIndex();
    expect(screen.queryByTestId("update-banner")).not.toBeInTheDocument();
  });

  it("renders the update banner when a newer version is available", () => {
    vi.mocked(useUpdateCheck).mockReturnValue({
      showBanner: true,
      dismiss: vi.fn(),
      result: {
        current_version: "0.1.0-beta",
        update_available: true,
        source: "https://api.github.com/repos/goniszewski/little-imp/releases",
        channel: "stable",
        latest: { version: "0.2.0", tag: "v0.2.0", name: "v0.2.0", prerelease: false, published_at: "2026-07-15", url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0" },
      },
      loading: false,
    });

    renderIndex();

    expect(screen.getByTestId("update-banner")).toBeInTheDocument();
    expect(screen.getByTestId("update-tag")).toHaveTextContent("v0.2.0");
    expect(screen.getByTestId("update-version")).toHaveTextContent("0.1.0-beta");
  });

  it("dismisses the update banner when dismiss is clicked", () => {
    const dismiss = vi.fn();
    vi.mocked(useUpdateCheck).mockReturnValue({
      showBanner: true,
      dismiss,
      result: {
        current_version: "0.1.0-beta",
        update_available: true,
        source: "",
        channel: "stable",
        latest: { version: "0.2.0", tag: "v0.2.0", name: "v0.2.0", prerelease: false, published_at: "2026-07-15", url: "" },
      },
      loading: false,
    });

    renderIndex();

    fireEvent.click(screen.getByTestId("dismiss-update"));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
