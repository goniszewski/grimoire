import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import {
  listTrashedBookmarks,
  restoreBookmark,
  permanentDeleteBookmark,
} from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, ArchiveRestore, ExternalLink, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, differenceInDays, addDays, parseISO } from "date-fns";

const RETENTION_DAYS = 30;

function daysRemaining(trashedAt: string | null): number | null {
  if (!trashedAt) return null;
  const expiry = addDays(parseISO(trashedAt), RETENTION_DAYS);
  const remaining = differenceInDays(expiry, new Date());
  return Math.max(0, remaining);
}

function DaysRemainingBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const variant = days <= 3 ? "destructive" : days <= 7 ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="text-[10px] px-1.5 py-0 h-5 font-mono shrink-0">
      {days === 0 ? "expires soon" : `${days}d left`}
    </Badge>
  );
}

const trashQueryKey = bookmarkKeys.trash;

const Trash = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: trashQueryKey,
    queryFn: listTrashedBookmarks,
  });

  const bookmarks = useMemo(() => data?.data ?? [], [data]);

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreBookmark(id),
    onSuccess: (_data, id) => {
      const bm = qc.getQueryData<Awaited<ReturnType<typeof listTrashedBookmarks>>>(trashQueryKey)
        ?.data.find((b) => b.id === id);
      qc.invalidateQueries({ queryKey: trashQueryKey });
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      toast({ title: "Restored", description: bm?.title ?? undefined });
    },
    onError: () => toast({ title: "Restore failed", variant: "destructive" }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => permanentDeleteBookmark(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trashQueryKey });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const emptyTrashMutation = useMutation({
    mutationFn: () => {
      const ids = (qc.getQueryData<Awaited<ReturnType<typeof listTrashedBookmarks>>>(trashQueryKey)?.data ?? []).map((b) => b.id);
      return Promise.all(ids.map((id) => permanentDeleteBookmark(id)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: trashQueryKey });
      toast({ title: "Trash emptied" });
    },
    onError: () => toast({ title: "Failed to empty trash", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return bookmarks;
    const q = search.toLowerCase();
    return bookmarks.filter(
      (b) =>
        (b.title ?? "").toLowerCase().includes(q) ||
        b.domain.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [bookmarks, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Trash
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              {bookmarks.length} item{bookmarks.length !== 1 ? "s" : ""} · auto-deleted after {RETENTION_DAYS} days
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
          {bookmarks.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8">
                  Empty trash
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty trash?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {bookmarks.length} item{bookmarks.length !== 1 ? "s" : ""} in trash. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => emptyTrashMutation.mutate()}
                  >
                    Empty trash
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Trash2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">
              {bookmarks.length === 0 ? "Trash is empty" : "No matches"}
            </h3>
            <p className="text-sm text-muted-foreground/60">
              {bookmarks.length === 0
                ? "Deleted bookmarks will appear here for 30 days."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((bm) => {
              const days = daysRemaining(bm.trashed_at);
              return (
                <div
                  key={bm.id}
                  className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <img
                    src={bm.favicon_url ?? `https://www.google.com/s2/favicons?domain=${bm.domain}&sz=32`}
                    alt=""
                    className="h-4 w-4 rounded-sm shrink-0 opacity-60"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="text-sm font-medium truncate min-w-0 flex-1 text-muted-foreground">
                    {bm.title ?? bm.url}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:inline">
                    {bm.domain}
                  </span>
                  {bm.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono hidden md:inline-flex">
                      {tag}
                    </Badge>
                  ))}
                  <span className="text-[10px] text-muted-foreground shrink-0 hidden lg:inline">
                    {formatDistanceToNow(new Date(bm.created_at), { addSuffix: true })}
                  </span>
                  <DaysRemainingBadge days={days} />
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Restore"
                      onClick={() => restoreMutation.mutate(bm.id)}
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{bm.title ?? bm.url}" will be permanently deleted. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => permanentDeleteMutation.mutate(bm.id)}
                          >
                            Delete permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Trash;
