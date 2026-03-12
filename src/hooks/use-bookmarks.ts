import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  listBookmarks,
  searchBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  listCategories,
  ApiBookmark,
  ApiCategory,
} from "@/lib/api";

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
}

export interface UICategory {
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

function toUIBookmark(bm: ApiBookmark, categoryMap: Map<string, string>): UIBookmark {
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
  };
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const bookmarkKeys = {
  all: ["bookmarks"] as const,
  lists: () => [...bookmarkKeys.all, "list"] as const,
  list: (filters: object) => [...bookmarkKeys.lists(), filters] as const,
  search: (q: string, filters: object) => ["search", q, filters] as const,
  categories: ["categories"] as const,
  tags: ["tags"] as const,
};

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useBookmarks() {
  const qc = useQueryClient();

  // ─── UI filter state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
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
      return res.data;
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
  }), [selectedTag, selectedDomain, categoryIdForFilter, dateRange]);

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
    tag: selectedTag ?? undefined,
    domain: selectedDomain ?? undefined,
    category: categoryIdForFilter,
    date_from: dateRange.from?.toISOString().slice(0, 10),
    date_to: dateRange.to?.toISOString().slice(0, 10),
    limit: 200,
  }), [debouncedQuery, selectedTag, selectedDomain, categoryIdForFilter, dateRange]);

  const searchQuery_ = useQuery({
    queryKey: bookmarkKeys.search(debouncedQuery, searchParams),
    queryFn: () => searchBookmarks(searchParams),
    placeholderData: keepPreviousData,
    staleTime: 5_000,
    enabled: !!debouncedQuery.trim(),
  });

  // ─── Resolved bookmark list ───────────────────────────────────────────────
  const rawBookmarks = useMemo<ApiBookmark[]>(() => {
    if (debouncedQuery.trim()) return searchQuery_.data?.data ?? [];
    return bookmarksQuery.data?.data ?? [];
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
    const map = new Map<string, number>();
    bookmarks.forEach((b) => map.set(b.category, (map.get(b.category) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  const tags = useMemo<UITagCount[]>(() => {
    const map = new Map<string, number>();
    bookmarks.forEach((b) => b.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  const domains = useMemo<UIDomainCount[]>(() => {
    const map = new Map<string, number>();
    bookmarks.forEach((b) => map.set(b.domain, (map.get(b.domain) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const addBookmarkMutation = useMutation({
    mutationFn: (url: string) => createBookmark(url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
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
    },
  });

  const updateBookmarkMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string | null; category_id?: string | null; tags?: string[] };
    }) => updateBookmark(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
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

  const restoreBookmark = useCallback(async (bookmark: UIBookmark) => {
    // Re-create the bookmark by URL (idempotent on the API).
    // Use rawTitle (null if pipeline hasn't set it) so the pipeline can still overwrite it.
    await createBookmark(bookmark.url, bookmark.rawTitle ?? undefined);
    qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
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
    selectedCategory,
    setSelectedCategory,
    selectedTag,
    setSelectedTag,
    selectedDomain,
    setSelectedDomain,
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
    isLoading,
    isError,
  };
}
