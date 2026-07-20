import { useState, useEffect, useCallback, useMemo } from "react";
import { Bookmark, PipelineStatus, PipelineError, PIPELINE_STAGES, Category, TagCount, DomainCount } from "@/types/bookmark";
import { MOCK_BOOKMARKS } from "@/data/mock-bookmarks";

export type SortOption = "newest" | "oldest" | "title-az" | "title-za" | "domain-az" | "domain-za";

const STORAGE_KEY = "little-imp-bookmarks";

function loadBookmarks(): Bookmark[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return MOCK_BOOKMARKS;
}

function saveBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function useBookmarkStore() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const addBookmark = useCallback((url: string) => {
    const id = `bm-${Date.now()}`;
    const domain = new URL(url).hostname.replace("www.", "");
    const now = new Date().toISOString();
    const newBookmark: Bookmark = {
      id,
      url,
      title: url,
      summary: "Processing...",
      content: "",
      domain,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      tags: [],
      category: "Uncategorized",
      status: "saved",
      savedAt: now,
      updatedAt: now,
    };
    setBookmarks((prev) => [newBookmark, ...prev]);

    // Simulate pipeline progression with failure handling
    const stages: PipelineStatus[] = ["fetched", "extracted", "ai_enriched", "indexed"];
    const titles = [
      `Page from ${domain}`,
      `Page from ${domain}`,
      `Page from ${domain}`,
      `Page from ${domain}`,
    ];
    const summaries = [
      "Fetching content...",
      "Extracting text and metadata...",
      "Running AI enrichment...",
      `Content from ${domain} — indexed and ready for search.`,
    ];

    // Random failure simulation (~15% chance at each stage)
    const failAtStage = Math.random() < 0.15 ? Math.floor(Math.random() * stages.length) : -1;

    stages.forEach((stage, i) => {
      setTimeout(() => {
        setBookmarks((prev) =>
          prev.map((b) => {
            if (b.id !== id) return b;
            // If already failed, don't progress
            if (b.error) return b;

            // Simulate failure at this stage
            if (i === failAtStage) {
              const failureMessages: Record<PipelineStatus, string> = {
                saved: "Could not save bookmark.",
                fetched: "Failed to fetch page. The URL may be unreachable or blocked.",
                extracted: "Content extraction failed. Falling back to page title.",
                ai_enriched: "AI enrichment unavailable. Will retry later.",
                indexed: "Indexing failed. Will retry later.",
              };
              return {
                ...b,
                status: i > 0 ? stages[i - 1] : "saved",
                title: i <= 1 ? url : b.title, // fetch fail → URL only
                summary: i <= 1 ? "Content unavailable" : b.summary,
                error: {
                  stage,
                  message: failureMessages[stage],
                  failedAt: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              };
            }

            return {
              ...b,
              status: stage,
              title: titles[i],
              summary: summaries[i],
              updatedAt: new Date().toISOString(),
            };
          })
        );
      }, (i + 1) * 1500);
    });

    return id;
  }, []);

  const deleteBookmark = useCallback((id: string) => {
    let deleted: Bookmark | undefined;
    setBookmarks((prev) => {
      deleted = prev.find((b) => b.id === id);
      return prev.filter((b) => b.id !== id);
    });
    return deleted;
  }, []);

  const restoreBookmark = useCallback((bookmark: Bookmark) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.id === bookmark.id)) return prev;
      return [bookmark, ...prev];
    });
  }, []);

  const updateBookmarkTags = useCallback((id: string, tags: string[]) => {
    setBookmarks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, tags, updatedAt: new Date().toISOString() } : b
      )
    );
  }, []);

  const updateBookmarkCategory = useCallback((id: string, category: string) => {
    setBookmarks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, category, updatedAt: new Date().toISOString() } : b
      )
    );
  }, []);

  const updateBookmarkField = useCallback((id: string, field: "title" | "url" | "summary", value: string) => {
    setBookmarks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const updates: Partial<Bookmark> = { [field]: value, updatedAt: new Date().toISOString() };
        if (field === "url") {
          try {
            const domain = new URL(value).hostname.replace("www.", "");
            updates.domain = domain;
            updates.favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
          } catch {}
        }
        return { ...b, ...updates };
      })
    );
  }, []);

  const retryBookmark = useCallback((id: string) => {
    // Find the bookmark and clear its error, then simulate remaining pipeline
    let bookmark: Bookmark | undefined;
    setBookmarks((prev) =>
      prev.map((b) => {
        if (b.id !== id || !b.error) return b;
        bookmark = b;
        return { ...b, error: undefined, updatedAt: new Date().toISOString() };
      })
    );
    if (!bookmark?.error) return;

    const allStages: PipelineStatus[] = ["saved", "fetched", "extracted", "ai_enriched", "indexed"];
    const failedStageIndex = allStages.indexOf(bookmark.error.stage);
    const remainingStages = allStages.slice(failedStageIndex);
    const domain = bookmark.domain;

    const stageData: Record<PipelineStatus, { title: string; summary: string }> = {
      saved: { title: bookmark.url, summary: "Processing..." },
      fetched: { title: `Page from ${domain}`, summary: "Fetching content..." },
      extracted: { title: `Page from ${domain}`, summary: "Extracting text and metadata..." },
      ai_enriched: { title: `Page from ${domain}`, summary: "Running AI enrichment..." },
      indexed: { title: `Page from ${domain}`, summary: `Content from ${domain} — indexed and ready for search.` },
    };

    remainingStages.forEach((stage, i) => {
      setTimeout(() => {
        setBookmarks((prev) =>
          prev.map((b) => {
            if (b.id !== id || b.error) return b;
            return {
              ...b,
              status: stage,
              title: b.title === b.url ? stageData[stage].title : b.title,
              summary: stageData[stage].summary,
              updatedAt: new Date().toISOString(),
            };
          })
        );
      }, (i + 1) * 1500);
    });
  }, []);

  const importBookmarks = useCallback((newBookmarks: Bookmark[]) => {
    setBookmarks((prev) => [...newBookmarks, ...prev]);
  }, []);

  const resetToMockData = useCallback(() => {
    setBookmarks(MOCK_BOOKMARKS);
  }, []);

  const categories = useMemo<Category[]>(() => {
    const map = new Map<string, number>();
    bookmarks.forEach((b) => map.set(b.category, (map.get(b.category) || 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  const tags = useMemo<TagCount[]>(() => {
    const map = new Map<string, number>();
    bookmarks.forEach((b) => b.tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1)));
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  const domains = useMemo<DomainCount[]>(() => {
    const map = new Map<string, number>();
    bookmarks.forEach((b) => map.set(b.domain, (map.get(b.domain) || 0) + 1));
    return Array.from(map.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookmarks]);

  const filteredBookmarks = useMemo(() => {
    let results = bookmarks;
    if (selectedCategory) {
      results = results.filter((b) => b.category === selectedCategory);
    }
    if (selectedDomain) {
      results = results.filter((b) => b.domain === selectedDomain);
    }
    if (selectedTag) {
      results = results.filter((b) => b.tags.includes(selectedTag));
    }
    if (dateRange.from) {
      const from = dateRange.from.getTime();
      results = results.filter((b) => new Date(b.savedAt).getTime() >= from);
    }
    if (dateRange.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      results = results.filter((b) => new Date(b.savedAt).getTime() <= to.getTime());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.summary.toLowerCase().includes(q) ||
          b.domain.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q)) ||
          b.category.toLowerCase().includes(q)
      );
    }
    // Sort
    results = [...results].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
        case "oldest":
          return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
        case "title-az":
          return a.title.localeCompare(b.title);
        case "title-za":
          return b.title.localeCompare(a.title);
        case "domain-az":
          return a.domain.localeCompare(b.domain);
        case "domain-za":
          return b.domain.localeCompare(a.domain);
        default:
          return 0;
      }
    });
    return results;
  }, [bookmarks, searchQuery, selectedCategory, selectedDomain, selectedTag, dateRange, sortBy]);

  const recentBookmarks = useMemo(
    () => [...bookmarks].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).slice(0, 5),
    [bookmarks]
  );

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
    deleteBookmark,
    restoreBookmark,
    updateBookmarkTags,
    updateBookmarkCategory,
    updateBookmarkField,
    retryBookmark,
    importBookmarks,
    resetToMockData,
  };
}
