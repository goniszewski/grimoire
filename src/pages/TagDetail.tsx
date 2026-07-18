import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Globe,
  Hash,
  Loader2,
  Pencil,
  Search,
  Tags as TagsIcon,
} from "lucide-react";
import { listBookmarks, listTags, renameTag, type ApiBookmark, type ApiTag } from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openBookmarkExternal } from "@/lib/bookmark-open";
import { TagRenameDialog } from "@/components/TagRenameDialog";
import { toast } from "@/hooks/use-toast";
import { applyRenamedTagToCache } from "@/lib/tag-cache";

const PAGE_SIZE = 20;

interface TagPageState {
  tag: string | null;
  offset: number;
}

function bookmarkLabel(count: number): string {
  return `${count} bookmark${count === 1 ? "" : "s"}`;
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function tagRoute(name: string): string {
  return `/tags/${encodeURIComponent(name)}`;
}

function findTag(tags: ApiTag[], name: string): ApiTag | null {
  const normalisedName = name.toLowerCase();
  return tags.find((tag) => tag.name.toLowerCase() === normalisedName) ?? null;
}

function TagBookmarkRow({
  bookmark,
  currentTag,
}: {
  bookmark: ApiBookmark;
  currentTag: string;
}) {
  const displayTitle = bookmark.title ?? bookmark.url;
  const favicon = bookmark.favicon_url;

  return (
    <article className="group flex min-w-0 items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-[border-color,box-shadow] duration-150 ease-out hover:border-primary/30 hover:shadow-sm">
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
          <span>Saved {formatDate(bookmark.created_at)}</span>
          {bookmark.opened_count > 0 && <span>opened {bookmark.opened_count}x</span>}
        </div>
      </div>

      <div className="hidden min-w-0 shrink flex-wrap justify-end gap-1 sm:flex">
        {bookmark.tags.slice(0, 3).map((tag) => (
          <Link key={tag} to={tagRoute(tag)} aria-label={`Open #${tag} tag`}>
            <Badge
              variant={tag.toLowerCase() === currentTag.toLowerCase() ? "default" : "secondary"}
              className="h-5 px-1.5 py-0 text-[10px] font-mono"
            >
              {tag}
            </Badge>
          </Link>
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

const TagDetail = () => {
  const { tag: routeTag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tagName = useMemo(() => (routeTag ?? "").trim().toLowerCase(), [routeTag]);
  const [pageState, setPageState] = useState<TagPageState>({
    tag: null,
    offset: 0,
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const offset = pageState.tag === tagName ? pageState.offset : 0;

  function setPageOffset(nextOffset: (currentOffset: number) => number) {
    setPageState((currentState) => {
      const currentOffset = currentState.tag === tagName ? currentState.offset : 0;
      return {
        tag: tagName,
        offset: nextOffset(currentOffset),
      };
    });
  }

  const tagsQuery = useQuery({
    queryKey: bookmarkKeys.tags,
    queryFn: async () => {
      const response = await listTags();
      return response.data;
    },
    staleTime: 30_000,
  });

  const tag = useMemo(
    () => (tagName ? findTag(tagsQuery.data ?? [], tagName) : null),
    [tagName, tagsQuery.data]
  );

  const bookmarksQuery = useQuery({
    queryKey: bookmarkKeys.list({
      view: "tag-detail",
      tag: tag?.name ?? tagName,
      limit: PAGE_SIZE,
      offset,
    }),
    queryFn: () => listBookmarks({ tag: tag?.name ?? tagName, limit: PAGE_SIZE, offset }),
    enabled: !!tagName && !!tag,
    staleTime: 10_000,
  });

  const bookmarks = (bookmarksQuery.data?.data ?? []) as ApiBookmark[];
  const pagination = bookmarksQuery.data?.pagination;
  const total = pagination?.total ?? tag?.bookmark_count ?? 0;
  const pageStart = total === 0 ? 0 : (pagination?.offset ?? offset) + 1;
  const pageEnd = pagination ? pagination.offset + bookmarks.length : bookmarks.length;
  const canGoPrevious = offset > 0;
  const canGoNext = !!pagination?.has_more;

  useEffect(() => {
    if (bookmarksQuery.isFetching || !pagination) return;

    if (pagination.total === 0) {
      if (offset !== 0) {
        setPageState({ tag: tagName, offset: 0 });
      }
      return;
    }

    if (pagination.offset >= pagination.total) {
      const lastValidOffset = Math.floor((pagination.total - 1) / PAGE_SIZE) * PAGE_SIZE;
      setPageState({ tag: tagName, offset: lastValidOffset });
    }
  }, [bookmarksQuery.isFetching, offset, pagination, tagName]);

  function invalidateTagAffectedQueries() {
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.tags });
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.archive });
    queryClient.invalidateQueries({ queryKey: bookmarkKeys.trash });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  }

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await renameTag(id, name);
      return response.data;
    },
    onSuccess: (response) => {
      applyRenamedTagToCache(queryClient, response);
      invalidateTagAffectedQueries();
      setRenameOpen(false);
      setRenameError(null);
      toast({ title: "Tag renamed", description: `#${response.name}` });
      navigate(`/tags/${encodeURIComponent(response.name)}`, { replace: true });
    },
    onError: (error: Error) => {
      setRenameError(error.message || "Tag could not be renamed.");
    },
  });

  if (tagsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading tag...
      </div>
    );
  }

  if (tagsQuery.isError) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <Hash className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <h1 className="text-lg font-semibold">Tags unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">The tag list could not be loaded.</p>
          <Button variant="outline" className="mt-6" onClick={() => navigate("/tags")}>
            <ArrowLeft className="h-4 w-4" />
            Back to tags
          </Button>
        </main>
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <Hash className="mb-4 h-10 w-10 text-muted-foreground/30" />
          <h1 className="text-lg font-semibold">Tag not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This tag may have been renamed, deleted, or has not been created yet.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate("/tags")}>
            <ArrowLeft className="h-4 w-4" />
            Back to tags
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/tags")} aria-label="Back to tags">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Hash className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">#{tag.name}</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Tag detail and scoped bookmark results</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            <Button asChild variant="outline" size="sm">
              <Link to={`/?tag=${encodeURIComponent(tag.name)}`} aria-label={`Open #${tag.name} in library`}>
                <Search className="h-4 w-4" />
                Open
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/tags" aria-label="Manage tags">
                <TagsIcon className="h-4 w-4" />
                Manage
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRenameError(null);
                setRenameOpen(true);
              }}
              aria-label={`Rename #${tag.name} tag`}
            >
              <Pencil className="h-4 w-4" />
              Rename
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              Active bookmarks
            </div>
            <p className="mt-2 text-sm font-semibold">{bookmarkLabel(tag.bookmark_count)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Created
            </div>
            <p className="mt-2 text-sm font-semibold">Created {formatDate(tag.created_at)}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TagsIcon className="h-3.5 w-3.5" />
              Metadata
            </div>
            <p className="mt-2 truncate text-sm font-mono font-semibold">{tag.id}</p>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Bookmarks</h2>
              <p className="font-mono text-xs text-muted-foreground">
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
          ) : bookmarksQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Bookmarks unavailable
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-16 text-center">
              <Hash className="mb-4 h-10 w-10 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground">No bookmarks with this tag yet</h3>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Add this tag from a bookmark detail view or the tag management surface.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bookmarks.map((bookmark) => (
                <TagBookmarkRow key={bookmark.id} bookmark={bookmark} currentTag={tag.name} />
              ))}
            </div>
          )}
        </section>
      </main>

      <TagRenameDialog
        tag={tag}
        open={renameOpen}
        error={renameError}
        pending={renameMutation.isPending}
        onClearError={() => setRenameError(null)}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setRenameError(null);
        }}
        onSubmit={(name) => {
          if (!tag) return;
          setRenameError(null);
          renameMutation.mutate({ id: tag.id, name });
        }}
      />
    </div>
  );
};

export default TagDetail;
