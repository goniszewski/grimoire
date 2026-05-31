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
  ApiBookmark,
  ApiCategory,
} from "@/lib/api";

export type SearchMode = "keyword" | "semantic" | "hybrid";

export type SortOption =
  | "newest"
  | "oldest"
  | "title-az"
  | "title-za"
  | "domain-az"
  | "domain-za";

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
}

export interface UICategory {
  id: string;
  name: string;
  count: number;
}

export interface UITagCount {
  tag: string;
  count: number;
}

export interface UIDomainCount {
  domain: string;
  count: number;
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
};

function toUIBookmark(bm: BookmarkForUi, categoryMap: Map<string, string>): UIBookmark {
  return {
    id: bm.id,
    url: bm.url,
    title: bm.title ?? bm.url,
    rawTitle: bm.title,
    summary: bm.description ?? "",
    domain: bm.domain,
    favicon: bm.favicon_url ?? `https://www.google.com/s2/favicons?domain=${bm.domain}&sz=32`,
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
  };
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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [readLaterOnly, setReadLaterOnly] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [sortBy, setSortBy] = useState<SortOption>("newest");

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

  // ─── Domains (from API) ───────────────────────────────────────────────────
  const domainsQuery = useQuery({
    queryKey: bookmarkKeys.domains,
    queryFn: async () => {
      const res = await listDomains();
      return res.data;
    },
    staleTime: 30_000,
  });

  // ─── Resolve category_id for filters ──────────────────────────────────────
  const categoryIdForFilter = useMemo<string | undefined>(() => {
    if (!selectedCategory) return undefined;
    for (const [id, name] of categoryMap) {
      if (name === selectedCategory) return id;
    }
    return undefined;
  }, [selectedCategory, categoryMap]);

  // ─── Bookmarks list (no search) ───────────────────────────────────────────
  const listParams = useMemo(() => ({
    limit: 200,
    tag: selectedTag ?? undefined,
    domain: selectedDomain ?? undefined,
    category: categoryIdForFilter,
    date_from: dateRange.from?.toISOString().slice(0, 10),
    date_to: dateRange.to?.toISOString().slice(0, 10),
    read_later: readLaterOnly ? true : undefined,
  }), [selectedTag, selectedDomain, categoryIdForFilter, dateRange, readLaterOnly]);

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
    category: categoryIdForFilter,
    date_from: dateRange.from?.toISOString().slice(0, 10),
    date_to: dateRange.to?.toISOString().slice(0, 10),
    read_later: readLaterOnly ? true : undefined,
    limit: 200,
  }), [debouncedQuery, searchMode, selectedTag, selectedDomain, categoryIdForFilter, dateRange, readLaterOnly]);

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

  // ─── Sorted bookmarks ─────────────────────────────────────────────────────
  const filteredBookmarks = useMemo<UIBookmark[]>(() => {
    return [...bookmarks].sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
        case "oldest": return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
        case "title-az": return a.title.localeCompare(b.title);
        case "title-za": return b.title.localeCompare(a.title);
        case "domain-az": return a.domain.localeCompare(b.domain);
        case "domain-za": return b.domain.localeCompare(a.domain);
        default: return 0;
      }
    });
  }, [bookmarks, sortBy]);

  const recentBookmarks = useMemo<UIBookmark[]>(
    () => [...bookmarks].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).slice(0, 5),
    [bookmarks]
  );

  // ─── Sidebar aggregates ───────────────────────────────────────────────────
  const categories = useMemo<UICategory[]>(() => {
    const countMap = new Map<string, number>();
    const idMap = new Map<string, string>();
    bookmarks.forEach((b) => {
      countMap.set(b.category, (countMap.get(b.category) ?? 0) + 1);
      if (b.category_id) idMap.set(b.category, b.category_id);
    });
    return Array.from(countMap.entries())
      .map(([name, count]) => ({ id: idMap.get(name) ?? "", name, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  const tags = useMemo<UITagCount[]>(() => {
    const map = new Map<string, number>();
    bookmarks.forEach((b) => b.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

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
    // After import completes, we just need to refresh
    qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
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
    categories,
    tags,
    domains,
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
    selectedDomain,
    setSelectedDomain,
    readLaterOnly,
    setReadLaterOnly,
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
