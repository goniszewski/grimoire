import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  FolderTree,
  Globe,
  Loader2,
} from "lucide-react";
import { listBookmarks, listCategories, type ApiBookmark, type ApiCategory } from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openBookmarkExternal } from "@/lib/bookmark-open";

const PAGE_SIZE = 20;

interface CategoryPath {
  node: ApiCategory;
  path: ApiCategory[];
}

interface CategoryPageState {
  categoryId: string | null;
  offset: number;
}

function findCategoryPath(categories: ApiCategory[], id: string, ancestors: ApiCategory[] = []): CategoryPath | null {
  for (const category of categories) {
    const path = [...ancestors, category];
    if (category.id === id) return { node: category, path };
    const childPath = findCategoryPath(category.children ?? [], id, path);
    if (childPath) return childPath;
  }
  return null;
}

function buildCategoryNameMap(categories: ApiCategory[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(nodes: ApiCategory[]) {
    for (const node of nodes) {
      map.set(node.id, node.name);
      walk(node.children ?? []);
    }
  }
  walk(categories);
  return map;
}

function bookmarkLabel(count: number): string {
  return `${count} bookmark${count === 1 ? "" : "s"}`;
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function CategoryBookmarkRow({
  bookmark,
  categoryName,
}: {
  bookmark: ApiBookmark;
  categoryName: string;
}) {
  const displayTitle = bookmark.title ?? bookmark.url;
  const favicon = bookmark.favicon_url;

  return (
    <article className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-all hover:border-primary/30 hover:shadow-sm">
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="h-4 w-4 shrink-0 rounded-sm"
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-medium">{displayTitle}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">{bookmark.domain}</span>
          <span>{categoryName}</span>
          {bookmark.opened_count > 0 && <span>opened {bookmark.opened_count}x</span>}
        </div>
      </div>
      <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
        {bookmark.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="secondary" className="h-5 px-1.5 py-0 text-[10px] font-mono">
            {tag}
          </Badge>
        ))}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => openBookmarkExternal(bookmark)}
        aria-label={`Open ${displayTitle}`}
        title="Open bookmark"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </article>
  );
}

const CategoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const categoryId = id ?? null;
  const [pageState, setPageState] = useState<CategoryPageState>({
    categoryId: null,
    offset: 0,
  });
  const offset = pageState.categoryId === categoryId ? pageState.offset : 0;

  function setPageOffset(nextOffset: (currentOffset: number) => number) {
    setPageState((currentState) => {
      const currentOffset = currentState.categoryId === categoryId ? currentState.offset : 0;
      return {
        categoryId,
        offset: nextOffset(currentOffset),
      };
    });
  }

  const categoriesQuery = useQuery({
    queryKey: bookmarkKeys.categories,
    queryFn: async () => {
      const response = await listCategories();
      return response.data as unknown as ApiCategory[];
    },
    staleTime: 30_000,
  });

  const categoryResult = useMemo(
    () => (categoryId ? findCategoryPath(categoriesQuery.data ?? [], categoryId) : null),
    [categoriesQuery.data, categoryId]
  );

  const categoryNameMap = useMemo(
    () => buildCategoryNameMap(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  );

  const bookmarksQuery = useQuery({
    queryKey: bookmarkKeys.list({
      view: "category-detail",
      category_id: categoryId ?? undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    queryFn: () => listBookmarks({ category_id: categoryId ?? undefined, limit: PAGE_SIZE, offset }),
    enabled: !!categoryId && !!categoryResult,
    staleTime: 10_000,
  });

  const category = categoryResult?.node ?? null;
  const path = categoryResult?.path ?? [];
  const bookmarks = (bookmarksQuery.data?.data ?? []) as ApiBookmark[];
  const pagination = bookmarksQuery.data?.pagination;
  const total = pagination?.total ?? category?.bookmark_count ?? 0;
  const pageStart = total === 0 ? 0 : (pagination?.offset ?? offset) + 1;
  const pageEnd = pagination ? pagination.offset + bookmarks.length : bookmarks.length;
  const canGoPrevious = offset > 0;
  const canGoNext = !!pagination?.has_more;

  if (categoriesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading category...
      </div>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <h1 className="text-lg font-semibold">Categories unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">The category tree could not be loaded.</p>
          <Button variant="outline" className="mt-6" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Button>
        </main>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <h1 className="text-lg font-semibold">Category not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This category may have been renamed, moved, or deleted.</p>
          <Button variant="outline" className="mt-6" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to library">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <nav className="mb-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground" aria-label="Category path">
              {path.map((item, index) => (
                <span key={item.id} className="flex min-w-0 items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                  {index === path.length - 1 ? (
                    <span className="truncate font-medium text-foreground">{item.name}</span>
                  ) : (
                    <Link to={`/categories/${item.id}`} className="truncate hover:text-foreground">
                      {item.name}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
            <h1 className="truncate text-lg font-semibold">{category.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5" />
              Bookmarks
            </div>
            <p className="mt-2 text-sm font-semibold">{bookmarkLabel(category.bookmark_count)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Created
            </div>
            <p className="mt-2 text-sm font-semibold">Created {formatDate(category.created_at)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Updated
            </div>
            <p className="mt-2 text-sm font-semibold">Updated {formatDate(category.updated_at)}</p>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FolderTree className="h-4 w-4" />
              Child categories
            </h2>
            <span className="text-xs text-muted-foreground font-mono">{category.children.length}</span>
          </div>
          {category.children.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {category.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => navigate(`/categories/${child.id}`)}
                  className="flex min-w-0 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-accent"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{child.name}</span>
                  <Badge variant="secondary" className="h-5 px-2 text-[10px] font-mono">
                    {child.bookmark_count}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No child categories.
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Bookmarks</h2>
              <p className="text-xs text-muted-foreground font-mono">
                {bookmarksQuery.isLoading ? "Loading..." : `${pageStart}-${pageEnd} of ${total}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canGoPrevious || bookmarksQuery.isFetching}
                onClick={() => setPageOffset((current) => Math.max(0, current - PAGE_SIZE))}
                aria-label="Previous page"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canGoNext || bookmarksQuery.isFetching}
                onClick={() => setPageOffset((current) => current + PAGE_SIZE)}
                aria-label="Next page"
              >
                Next
              </Button>
            </div>
          </div>

          {bookmarksQuery.isLoading ? (
            <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
              Loading bookmarks...
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16 text-center">
              <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground">No bookmarks in this category yet</h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Move bookmarks into this category from the library or bookmark detail view.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bookmarks.map((bookmark) => (
                <CategoryBookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  categoryName={
                    bookmark.category_id
                      ? categoryNameMap.get(bookmark.category_id) ?? category.name
                      : "Uncategorized"
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default CategoryDetail;
