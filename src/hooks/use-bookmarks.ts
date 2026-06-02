import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  listBookmarks,
  searchBookmarks,
  getRelatedBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  restoreBookmark as apiRestoreBookmark,
  listCategories,
  listDomains,
  listTags,
} from "@/lib/api";
import type {
  ApiBookmark,
  ApiBookmarkWithContent,
  ApiCategory,
  LibrarySortParams,
  LibraryParityFilterParams,
} from "@/lib/api";
import {
  generatedFavicon,
  normaliseBookmarkMediaSet,
  normaliseDaemonMediaUrl,
} from "@/lib/media-url";

export type SearchMode = "keyword" | "semantic" | "hybrid";

export type SortOption =
  | "newest"
  | "oldest"
  | "updated-newest"
  | "updated-oldest"
  | "title-az"
  | "title-za"
  | "domain-az"
  | "domain-za"
  | "most-opened"
  | "least-opened"
  | "last-opened-newest"
  | "last-opened-oldest";

export type ReadStateFilter = "all" | "read" | "unread";
export type PinnedFilter = "all" | "pinned" | "unpinned";
export type OpenActivityFilter = "all" | "unopened" | "opened" | "opened-2-plus";

export const LIBRARY_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_LIBRARY_PAGE_SIZE = LIBRARY_PAGE_SIZE_OPTIONS[0];

// ─── Normalise API bookmark to a shape the UI components already understand ──

export interface UIBookmark {
  id: string;
  url: string;
  title: string;
  /** Raw title from API — null means pipeline hasn't set it yet */
  rawTitle: string | null;
  summary: string;
  domain: string;
  favicon: string;
  tags: string[];
  /** category name — resolved from category_id */
  category: string;
  status: ApiBookmark["status"];
  savedAt: string;
  updatedAt: string;
  // Keep original API fields for mutations
  category_id: string | null;
  is_pinned: 0 | 1;
  is_archived: 0 | 1;
  read_later: 0 | 1;
  read_at: string | null;
  opened_count: number;
  last_opened_at: string | null;
  notes: string | null;
  content?: ApiBookmarkWithContent["content"];
  media?: ApiBookmarkWithContent["media"];
}

export interface UICategory {
  id: string;
  name: string;
  count: number;
  parentId: string | null;
  depth: number;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  slug?: string | null;
  is_archived?: 0 | 1;
  is_public?: 0 | 1;
}

export interface UITagCount {
  tag: string;
  count: number;
}

export interface UIDomainCount {
  domain: string;
  count: number;
}

export interface LibraryPaginationState {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

type BookmarkForUi = {
  id: ApiBookmark["id"];
  url: ApiBookmark["url"];
  title: ApiBookmark["title"];
  description: ApiBookmark["description"];
  domain: ApiBookmark["domain"];
  favicon_url: ApiBookmark["favicon_url"];
  tags: ApiBookmark["tags"];
  category_id: ApiBookmark["category_id"];
  status: ApiBookmark["status"];
  created_at: ApiBookmark["created_at"];
  updated_at: ApiBookmark["updated_at"];
  is_pinned: ApiBookmark["is_pinned"];
  is_archived: ApiBookmark["is_archived"];
  read_later: ApiBookmark["read_later"];
  read_at: ApiBookmark["read_at"];
  opened_count: ApiBookmark["opened_count"];
  last_opened_at: ApiBookmark["last_opened_at"];
  notes: ApiBookmark["notes"];
  content?: ApiBookmarkWithContent["content"];
  media?: ApiBookmarkWithContent["media"];
};

function toUIBookmark(bm: BookmarkForUi, categoryMap: Map<string, string>): UIBookmark {
  return {
    id: bm.id,
    url: bm.url,
    title: bm.title ?? bm.url,
    rawTitle: bm.title,
    summary: bm.description ?? "",
    domain: bm.domain,
    favicon: normaliseDaemonMediaUrl(bm.favicon_url) ?? generatedFavicon(bm.domain),
    tags: bm.tags,
    category: bm.category_id ? (categoryMap.get(bm.category_id) ?? "Uncategorized") : "Uncategorized",
    category_id: bm.category_id,
    status: bm.status,
    savedAt: bm.created_at,
    updatedAt: bm.updated_at,
    is_pinned: bm.is_pinned,
    is_archived: bm.is_archived,
    read_later: bm.read_later,
    read_at: bm.read_at,
    opened_count: bm.opened_count,
    last_opened_at: bm.last_opened_at,
    notes: bm.notes,
    content: bm.content,
    media: normaliseBookmarkMediaSet(bm.media),
  };
}

function toUICategories(categories: ApiCategory[], depth = 0): UICategory[] {
  return categories.flatMap((category) => [
    {
      id: category.id,
      name: category.name,
      count: category.bookmark_count,
      parentId: category.parent_id,
      depth,
      color: category.color,
      icon: category.icon,
      description: category.description,
      slug: category.slug,
      is_archived: category.is_archived,
      is_public: category.is_public,
    },
    ...toUICategories(category.children ?? [], depth + 1),
  ]);
}

function toLibrarySortParams(sortBy: SortOption): Required<LibrarySortParams> {
  switch (sortBy) {
    case "oldest":
      return { sort: "created_at", direction: "asc" };
    case "updated-newest":
      return { sort: "updated_at", direction: "desc" };
    case "updated-oldest":
      return { sort: "updated_at", direction: "asc" };
    case "title-az":
      return { sort: "title", direction: "asc" };
    case "title-za":
      return { sort: "title", direction: "desc" };
    case "domain-az":
      return { sort: "domain", direction: "asc" };
    case "domain-za":
      return { sort: "domain", direction: "desc" };
    case "most-opened":
      return { sort: "opened_count", direction: "desc" };
    case "least-opened":
      return { sort: "opened_count", direction: "asc" };
    case "last-opened-newest":
      return { sort: "last_opened_at", direction: "desc" };
    case "last-opened-oldest":
      return { sort: "last_opened_at", direction: "asc" };
    case "newest":
    default:
      return { sort: "created_at", direction: "desc" };
  }
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  lists: () => [...bookmarkKeys.all, "list"] as const,
  list: (filters: object) => [...bookmarkKeys.lists(), filters] as const,
  archive: ["bookmarks", "archive"] as const,
  trash: ["bookmarks", "trash"] as const,
  search: (q: string, filters: object) => ["search", q, filters] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
  domains: ["domains"] as const,
};

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useBookmarks() {
  const qc = useQueryClient();

  // ─── UI filter state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchModeState] = useState<SearchMode>("keyword");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedTag, setSelectedTagState] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomainState] = useState<string | null>(null);
  const [readLaterOnly, setReadLaterOnlyState] = useState(false);
  const [readStateFilter, setReadStateFilterState] = useState<ReadStateFilter>("all");
  const [pinnedFilter, setPinnedFilterState] = useState<PinnedFilter>("all");
  const [openActivityFilter, setOpenActivityFilterState] = useState<OpenActivityFilter>("all");
  const [lastOpenedRange, setLastOpenedRangeState] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [dateRange, setDateRangeState] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [sortBy, setSortByState] = useState<SortOption>("newest");
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_LIBRARY_PAGE_SIZE);
  const [pageOffset, setPageOffset] = useState(0);

  const dateFrom = dateRange.from?.toISOString().slice(0, 10);
  const dateTo = dateRange.to?.toISOString().slice(0, 10);
  const lastOpenedFrom = lastOpenedRange.from?.toISOString().slice(0, 10);
  const lastOpenedTo = lastOpenedRange.to?.toISOString().slice(0, 10);

  const resetPage = useCallback(() => {
    setPageOffset(0);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    resetPage();
  }, [resetPage]);

  const setSearchMode = useCallback((mode: SearchMode) => {
    setSearchModeState(mode);
    resetPage();
  }, [resetPage]);

  const setSelectedTag = useCallback((tag: string | null) => {
    setSelectedTagState(tag);
    resetPage();
  }, [resetPage]);

  const setSelectedDomain = useCallback((domain: string | null) => {
    setSelectedDomainState(domain);
    resetPage();
  }, [resetPage]);

  const setReadLaterOnly = useCallback((readLater: boolean) => {
    setReadLaterOnlyState(readLater);
    resetPage();
  }, [resetPage]);

  const setReadStateFilter = useCallback((readState: ReadStateFilter) => {
    setReadStateFilterState(readState);
    resetPage();
  }, [resetPage]);

  const setPinnedFilter = useCallback((pinned: PinnedFilter) => {
    setPinnedFilterState(pinned);
    resetPage();
  }, [resetPage]);

  const setOpenActivityFilter = useCallback((activity: OpenActivityFilter) => {
    setOpenActivityFilterState(activity);
    resetPage();
  }, [resetPage]);

  const setLastOpenedRange = useCallback((range: { from: Date | null; to: Date | null }) => {
    setLastOpenedRangeState(range);
    resetPage();
  }, [resetPage]);

  const setDateRange = useCallback((range: { from: Date | null; to: Date | null }) => {
    setDateRangeState(range);
    resetPage();
  }, [resetPage]);

  const setSortBy = useCallback((sort: SortOption) => {
    setSortByState(sort);
    resetPage();
  }, [resetPage]);

  const setPageSize = useCallback((nextPageSize: number) => {
    const safePageSize = LIBRARY_PAGE_SIZE_OPTIONS.includes(
      nextPageSize as (typeof LIBRARY_PAGE_SIZE_OPTIONS)[number]
    )
      ? nextPageSize
      : DEFAULT_LIBRARY_PAGE_SIZE;
    setPageSizeState(safePageSize);
    resetPage();
  }, [resetPage]);

  // Debounce search — 300ms per spec
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ─── Categories ───────────────────────────────────────────────────────────
  const categoriesQuery = useQuery({
    queryKey: bookmarkKeys.categories,
    queryFn: async () => {
      const res = await listCategories();
      return res.data as unknown as ApiCategory[];
    },
    staleTime: 30_000,
  });

  const categoryMap = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    function walk(cats: ApiCategory[]) {
      for (const c of cats) {
        m.set(c.id, c.name);
        if (c.children) walk(c.children);
      }
    }
    walk(categoriesQuery.data ?? []);
    return m;
  }, [categoriesQuery.data]);

  const selectCategory = useCallback((category: string | null, categoryId?: string | null) => {
    resetPage();
    setSelectedCategory(category);
    if (!category) {
      setSelectedCategoryId(null);
      return;
    }

    if (categoryId !== undefined) {
      setSelectedCategoryId(categoryId);
      return;
    }

    for (const [id, name] of categoryMap) {
      if (name === category) {
        setSelectedCategoryId(id);
        return;
      }
    }
    setSelectedCategoryId(null);
  }, [categoryMap, resetPage]);

  // ─── Domains (from API) ───────────────────────────────────────────────────
  const domainsQuery = useQuery({
    queryKey: bookmarkKeys.domains,
    queryFn: async () => {
      const res = await listDomains();
      return res.data;
    },
    staleTime: 30_000,
  });

  // ─── Tags (from API) ──────────────────────────────────────────────────────
  const tagsQuery = useQuery({
    queryKey: bookmarkKeys.tags,
    queryFn: async () => {
      const res = await listTags();
      return res.data;
    },
    staleTime: 30_000,
  });

  // ─── Bookmarks list (no search) ───────────────────────────────────────────
  const parityFilterParams = useMemo<LibraryParityFilterParams>(() => {
    const params: LibraryParityFilterParams = {};
    if (readStateFilter !== "all") params.read_state = readStateFilter;
    if (pinnedFilter === "pinned") params.is_pinned = true;
    if (pinnedFilter === "unpinned") params.is_pinned = false;
    if (openActivityFilter === "unopened") params.opened_count_max = 0;
    if (openActivityFilter === "opened") params.opened_count_min = 1;
    if (openActivityFilter === "opened-2-plus") params.opened_count_min = 2;
    if (lastOpenedFrom) params.last_opened_from = lastOpenedFrom;
    if (lastOpenedTo) params.last_opened_to = lastOpenedTo;
    return params;
  }, [readStateFilter, pinnedFilter, openActivityFilter, lastOpenedFrom, lastOpenedTo]);

  const listParams = useMemo(() => ({
    limit: pageSize,
    offset: pageOffset,
    tag: selectedTag ?? undefined,
    domain: selectedDomain ?? undefined,
    category_id: selectedCategoryId ?? undefined,
    category: selectedCategory ?? undefined,
    date_from: dateFrom,
    date_to: dateTo,
    read_later: readLaterOnly ? true : undefined,
    ...parityFilterParams,
    ...toLibrarySortParams(sortBy),
  }), [pageSize, pageOffset, selectedTag, selectedDomain, selectedCategoryId, selectedCategory, dateFrom, dateTo, readLaterOnly, parityFilterParams, sortBy]);

  const bookmarksQuery = useQuery({
    queryKey: bookmarkKeys.list(listParams),
    queryFn: () => listBookmarks(listParams),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    enabled: !debouncedQuery.trim(),
  });

  // ─── Search results ───────────────────────────────────────────────────────
  const searchParams = useMemo(() => ({
    q: debouncedQuery,
    mode: searchMode,
    tag: selectedTag ?? undefined,
    domain: selectedDomain ?? undefined,
    category_id: selectedCategoryId ?? undefined,
    category: selectedCategory ?? undefined,
    date_from: dateFrom,
    date_to: dateTo,
    read_later: readLaterOnly ? true : undefined,
    ...parityFilterParams,
    limit: pageSize,
    offset: pageOffset,
    ...toLibrarySortParams(sortBy),
  }), [debouncedQuery, searchMode, selectedTag, selectedDomain, selectedCategoryId, selectedCategory, dateFrom, dateTo, readLaterOnly, parityFilterParams, pageSize, pageOffset, sortBy]);

  const searchQuery_ = useQuery({
    queryKey: bookmarkKeys.search(debouncedQuery, searchParams),
    queryFn: () => searchBookmarks(searchParams),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
    enabled: !!debouncedQuery.trim(),
  });

  // ─── Resolved bookmark list ───────────────────────────────────────────────
  const rawBookmarks = useMemo<BookmarkForUi[]>(() => {
    if (debouncedQuery.trim()) return (searchQuery_.data?.data ?? []) as BookmarkForUi[];
    return (bookmarksQuery.data?.data ?? []) as BookmarkForUi[];
  }, [debouncedQuery, searchQuery_.data, bookmarksQuery.data]);

  const bookmarks = useMemo<UIBookmark[]>(
    () => rawBookmarks.map((b) => toUIBookmark(b, categoryMap)),
    [rawBookmarks, categoryMap]
  );

  // The daemon sorts before pagination; keep the received page order intact.
  const filteredBookmarks = bookmarks;

  const activePagination: LibraryPaginationState = useMemo(() => {
    const response = debouncedQuery.trim() ? searchQuery_.data : bookmarksQuery.data;
    return response?.pagination ?? {
      total: 0,
      limit: pageSize,
      offset: pageOffset,
      has_more: false,
    };
  }, [debouncedQuery, searchQuery_.data, bookmarksQuery.data, pageSize, pageOffset]);

  const totalPages = Math.max(1, Math.ceil(activePagination.total / pageSize));
  const currentPage = Math.min(totalPages, Math.floor(pageOffset / pageSize) + 1);
  const pageStart = activePagination.total === 0 ? 0 : activePagination.offset + 1;
  const pageEnd = activePagination.total === 0
    ? 0
    : Math.min(activePagination.offset + filteredBookmarks.length, activePagination.total);
  const canGoPreviousPage = pageOffset > 0;
  const canGoNextPage = activePagination.has_more;
  const isFetchingPage = debouncedQuery.trim() ? searchQuery_.isFetching : bookmarksQuery.isFetching;

  useEffect(() => {
    if (isFetchingPage) return;

    if (activePagination.total === 0) {
      if (pageOffset !== 0) setPageOffset(0);
      return;
    }

    if (pageOffset >= activePagination.total) {
      const lastValidOffset = Math.floor((activePagination.total - 1) / pageSize) * pageSize;
      setPageOffset(lastValidOffset);
    }
  }, [activePagination.total, isFetchingPage, pageOffset, pageSize]);

  const goToPreviousPage = useCallback(() => {
    setPageOffset((currentOffset) => Math.max(0, currentOffset - pageSize));
  }, [pageSize]);

  const goToNextPage = useCallback(() => {
    setPageOffset((currentOffset) => currentOffset + pageSize);
  }, [pageSize]);

  const pageSelectionKey = useMemo(() => JSON.stringify({
    q: searchQuery.trim(),
    mode: searchMode,
    tag: selectedTag,
    domain: selectedDomain,
    category: selectedCategory,
    categoryId: selectedCategoryId,
    dateFrom,
    dateTo,
    readLaterOnly,
    readStateFilter,
    pinnedFilter,
    openActivityFilter,
    lastOpenedFrom,
    lastOpenedTo,
    sortBy,
    pageSize,
    pageOffset,
  }), [
    searchQuery,
    searchMode,
    selectedTag,
    selectedDomain,
    selectedCategory,
    selectedCategoryId,
    dateFrom,
    dateTo,
    readLaterOnly,
    readStateFilter,
    pinnedFilter,
    openActivityFilter,
    lastOpenedFrom,
    lastOpenedTo,
    sortBy,
    pageSize,
    pageOffset,
  ]);

  const recentBookmarks = useMemo<UIBookmark[]>(
    () => [...bookmarks].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).slice(0, 5),
    [bookmarks]
  );

  // ─── Sidebar aggregates ───────────────────────────────────────────────────
  const categories = useMemo<UICategory[]>(
    () => toUICategories(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  );

  const tags = useMemo<UITagCount[]>(() => {
    return (tagsQuery.data ?? [])
      .map((tag) => ({ tag: tag.name, count: tag.bookmark_count }))
      .sort((a, b) => b.count - a.count);
  }, [tagsQuery.data]);

  const domainRows = domainsQuery.data as unknown as Array<{ domain: string; count: number }> | undefined;
  const domains = useMemo<UIDomainCount[]>(() => {
    const result: UIDomainCount[] = [];
    for (const d of domainRows ?? []) {
      result.push({ domain: d.domain, count: d.count });
    }
    return result;
  }, [domainRows]);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const addBookmarkMutation = useMutation({
    mutationFn: (url: string) => createBookmark(url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      qc.invalidateQueries({ queryKey: bookmarkKeys.domains });
      qc.invalidateQueries({ queryKey: bookmarkKeys.tags });
    },
  });

  const deleteBookmarkMutation = useMutation({
    mutationFn: (id: string) => deleteBookmark(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: bookmarkKeys.lists() });
      const snapshot = bookmarks.find((b) => b.id === id);
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      // If there's an error we don't need to roll back - just refetch
      void ctx;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      qc.invalidateQueries({ queryKey: bookmarkKeys.domains });
      qc.invalidateQueries({ queryKey: bookmarkKeys.tags });
    },
  });

  const updateBookmarkMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: {
        title?: string | null;
        category_id?: string | null;
        tags?: string[];
        is_pinned?: 0 | 1;
        read_later?: 0 | 1;
        is_archived?: 0 | 1;
        read_at?: string | null;
        notes?: string | null;
      };
    }) => updateBookmark(id, patch),
    onMutate: async ({ id, patch }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: bookmarkKeys.lists() }),
        qc.cancelQueries({ queryKey: ["search"] }),
      ]);

      const listSnapshots = qc.getQueriesData<{ data: ApiBookmark[] }>({ queryKey: bookmarkKeys.lists() });
      const searchSnapshots = qc.getQueriesData<{ data: ApiBookmark[] }>({ queryKey: ["search"] });

      const applyPatch = (old: { data: ApiBookmark[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((bookmark) =>
            bookmark.id === id
              ? {
                  ...bookmark,
                  ...patch,
                  updated_at: new Date().toISOString(),
                }
              : bookmark
          ),
        };
      };

      for (const [key, value] of [...listSnapshots, ...searchSnapshots]) {
        qc.setQueryData(key, applyPatch(value));
      }

      return { listSnapshots, searchSnapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.listSnapshots ?? []) {
        qc.setQueryData(key, value);
      }
      for (const [key, value] of context?.searchSnapshots ?? []) {
        qc.setQueryData(key, value);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: bookmarkKeys.archive });
      qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
      qc.invalidateQueries({ queryKey: bookmarkKeys.tags });
    },
  });

  // ─── Public API matching use-bookmark-store interface ─────────────────────

  const addBookmark = useCallback((url: string) => {
    addBookmarkMutation.mutate(url);
  }, [addBookmarkMutation]);

  const deleteBookmarkFn = useCallback((id: string) => {
    const deleted = bookmarks.find((b) => b.id === id);
    deleteBookmarkMutation.mutate(id);
    return deleted;
  }, [bookmarks, deleteBookmarkMutation]);

  const restoreBookmark = useCallback(async (id: string) => {
    await apiRestoreBookmark(id);
    qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    qc.invalidateQueries({ queryKey: bookmarkKeys.trash });
    qc.invalidateQueries({ queryKey: bookmarkKeys.tags });
  }, [qc]);

  const updateBookmarkTags = useCallback((id: string, tags: string[]) => {
    updateBookmarkMutation.mutate({ id, patch: { tags } });
  }, [updateBookmarkMutation]);

  const updateBookmarkCategory = useCallback((id: string, categoryName: string) => {
    // Find category_id by name — skip update if the category doesn't exist
    let category_id: string | null = null;
    let found = false;
    for (const [cid, cname] of categoryMap) {
      if (cname === categoryName) { category_id = cid; found = true; break; }
    }
    if (!found) return;
    updateBookmarkMutation.mutate({ id, patch: { category_id } });
  }, [updateBookmarkMutation, categoryMap]);

  const updateBookmarkField = useCallback((id: string, field: "title" | "url" | "summary", value: string) => {
    if (field === "title") {
      updateBookmarkMutation.mutate({ id, patch: { title: value } });
    }
    // url and summary changes are not directly supported by PUT /bookmarks/:id
    // (url changes would require re-ingestion; summary is from content extraction)
  }, [updateBookmarkMutation]);

  const importBookmarks = useCallback(() => {
    // Import is handled via the ImportDialog which calls importBookmarksFile directly
    // After import completes, refresh the library and aggregate views.
    qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    qc.invalidateQueries({ queryKey: bookmarkKeys.categories });
    qc.invalidateQueries({ queryKey: bookmarkKeys.tags });
    qc.invalidateQueries({ queryKey: bookmarkKeys.domains });
  }, [qc]);

  const pinBookmark = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { is_pinned: 1 } }, callbacks);
  }, [updateBookmarkMutation]);

  const unpinBookmark = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { is_pinned: 0 } }, callbacks);
  }, [updateBookmarkMutation]);

  const markReadLater = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { read_later: 1 } }, callbacks);
  }, [updateBookmarkMutation]);

  const clearReadLater = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { read_later: 0 } }, callbacks);
  }, [updateBookmarkMutation]);

  const archiveBookmark = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { is_archived: 1 } }, callbacks);
  }, [updateBookmarkMutation]);

  const unarchiveBookmark = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { is_archived: 0 } }, callbacks);
  }, [updateBookmarkMutation]);

  const markAsRead = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { read_at: new Date().toISOString() } }, callbacks);
  }, [updateBookmarkMutation]);

  const markAsUnread = useCallback((id: string, callbacks?: { onSuccess?: () => void; onError?: () => void }) => {
    updateBookmarkMutation.mutate({ id, patch: { read_at: null } }, callbacks);
  }, [updateBookmarkMutation]);

  const updateBookmarkNotes = useCallback((id: string, notes: string | null) => {
    updateBookmarkMutation.mutate({ id, patch: { notes } });
  }, [updateBookmarkMutation]);

  const isLoading = bookmarksQuery.isLoading || searchQuery_.isLoading;
  const isError = bookmarksQuery.isError || searchQuery_.isError;

  return {
    bookmarks,
    filteredBookmarks,
    recentBookmarks,
    pagination: activePagination,
    pageSize,
    setPageSize,
    currentPage,
    totalPages,
    pageStart,
    pageEnd,
    canGoPreviousPage,
    canGoNextPage,
    goToPreviousPage,
    goToNextPage,
    isFetchingPage,
    pageSelectionKey,
    libraryParityFilterParams: parityFilterParams,
    categories,
    categoriesLoading: categoriesQuery.isLoading,
    categoriesError: categoriesQuery.isError,
    tags,
    domains,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    selectedCategory,
    selectedCategoryId,
    setSelectedCategory: selectCategory,
    selectedTag,
    setSelectedTag,
    selectedDomain,
    setSelectedDomain,
    readLaterOnly,
    setReadLaterOnly,
    readStateFilter,
    setReadStateFilter,
    pinnedFilter,
    setPinnedFilter,
    openActivityFilter,
    setOpenActivityFilter,
    lastOpenedRange,
    setLastOpenedRange,
    dateRange,
    setDateRange,
    sortBy,
    setSortBy,
    addBookmark,
    deleteBookmark: deleteBookmarkFn,
    restoreBookmark,
    updateBookmarkTags,
    updateBookmarkCategory,
    updateBookmarkField,
    importBookmarks,
    pinBookmark,
    unpinBookmark,
    markReadLater,
    clearReadLater,
    archiveBookmark,
    unarchiveBookmark,
    markAsRead,
    markAsUnread,
    updateBookmarkNotes,
    isLoading,
    isError,
  };
}

// ─── Related bookmarks hook ────────────────────────────────────────────────────

export function useRelatedBookmarks(bookmarkId: string | null | undefined) {
  const categoriesQuery = useQuery({
    queryKey: bookmarkKeys.categories,
    queryFn: async () => {
      const res = await listCategories();
      return res.data as unknown as ApiCategory[];
    },
    staleTime: 30_000,
  });

  const categoryMap = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    function walk(cats: ApiCategory[]) {
      for (const c of cats) {
        m.set(c.id, c.name);
        if (c.children) walk(c.children);
      }
    }
    walk(categoriesQuery.data ?? []);
    return m;
  }, [categoriesQuery.data]);

  const query = useQuery({
    queryKey: ["related", bookmarkId],
    queryFn: async () => {
      const res = await getRelatedBookmarks(bookmarkId!, 5);
      return (res.data as unknown as BookmarkForUi[]).map((bm) => toUIBookmark(bm, categoryMap));
    },
    enabled: !!bookmarkId,
    staleTime: 60_000,
  });

  return query.data ?? [];
}
