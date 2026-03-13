import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { listBookmarks, updateBookmark } from "@/lib/api";
import { UIBookmark, bookmarkKeys } from "@/hooks/use-bookmarks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Archive as ArchiveIcon, Search, ArchiveRestore, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { formatDistanceToNow } from "date-fns";

const archiveQueryKey = bookmarkKeys.archive;

const Archive = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: archiveQueryKey,
    queryFn: () => listBookmarks({ archived: true, limit: 500 }),
  });

  const bookmarks = useMemo<UIBookmark[]>(() => {
    return (data?.data ?? []).map((bm) => ({
      id: bm.id,
      url: bm.url,
      title: bm.title ?? bm.url,
      rawTitle: bm.title,
      summary: bm.description ?? "",
      domain: bm.domain,
      favicon: bm.favicon_url ?? `https://www.google.com/s2/favicons?domain=${bm.domain}&sz=32`,
      tags: bm.tags,
      category: "Uncategorized",
      category_id: bm.category_id,
      status: bm.status,
      savedAt: bm.created_at,
      updatedAt: bm.updated_at,
      is_pinned: bm.is_pinned,
      is_archived: bm.is_archived,
      read_at: bm.read_at,
      notes: bm.notes,
    }));
  }, [data]);

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => updateBookmark(id, { is_archived: 0 }),
    onSuccess: (_data, id) => {
      const bm = bookmarks.find((b) => b.id === id);
      qc.invalidateQueries({ queryKey: archiveQueryKey });
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      toast({
        title: "Restored to library",
        description: bm?.title,
        action: (
          <ToastAction
            altText="Undo"
            onClick={() =>
              updateBookmark(id, { is_archived: 1 }).then(() => {
                qc.invalidateQueries({ queryKey: archiveQueryKey });
                qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
              })
            }
          >
            Undo
          </ToastAction>
        ),
      });
    },
    onError: () => toast({ title: "Failed to restore bookmark", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return bookmarks;
    const q = search.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.domain.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [bookmarks, search]);

  const handleUnarchive = (id: string) => {
    unarchiveMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <ArchiveIcon className="h-4 w-4" />
              Archive
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              {bookmarks.length} archived bookmark{bookmarks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ArchiveIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">
              {bookmarks.length === 0 ? "Archive is empty" : "No matches"}
            </h3>
            <p className="text-sm text-muted-foreground/60">
              {bookmarks.length === 0
                ? "Bookmarks you archive will appear here."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((bm) => (
              <div
                key={bm.id}
                className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <img
                  src={bm.favicon}
                  alt=""
                  className="h-4 w-4 rounded-sm shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-sm font-medium truncate min-w-0 flex-1">{bm.title}</span>
                <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:inline">
                  {bm.domain}
                </span>
                {bm.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono hidden md:inline-flex">
                    {tag}
                  </Badge>
                ))}
                <span className="text-[10px] text-muted-foreground shrink-0 hidden lg:inline">
                  {formatDistanceToNow(new Date(bm.savedAt), { addSuffix: true })}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Restore to library"
                    onClick={() => handleUnarchive(bm.id)}
                  >
                    <ArchiveRestore className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Open"
                    onClick={() => window.open(bm.url, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Archive;
