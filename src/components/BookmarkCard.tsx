import { UIBookmark as Bookmark } from "@/hooks/use-bookmarks";
import { PipelineBadge } from "./PipelineBadge";
import { HighlightText } from "./HighlightText";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, ExternalLink, Pencil, Check, Pin, PinOff, Archive, BookOpen, BookDashed, BookmarkCheck, BookmarkX, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import { openBookmarkExternal, type RecordedOpenMetrics } from "@/lib/bookmark-open";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusCallback = (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;

function tagHref(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}`;
}

interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
  onClick: (bookmark: Bookmark) => void;
  onPin?: StatusCallback;
  onUnpin?: StatusCallback;
  onReadLater?: StatusCallback;
  onClearReadLater?: StatusCallback;
  onArchive?: StatusCallback;
  onMarkRead?: StatusCallback;
  onMarkUnread?: StatusCallback;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  searchQuery?: string;
  compact?: boolean;
}

export function BookmarkCard({ bookmark, onDelete, onClick, onPin, onUnpin, onReadLater, onClearReadLater, onArchive, onMarkRead, onMarkUnread, selectionMode, selected, onToggleSelect, searchQuery = "", compact }: BookmarkCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [openMetrics, setOpenMetrics] = useState({
    opened_count: bookmark.opened_count,
    last_opened_at: bookmark.last_opened_at,
  });
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const threshold = 100;

  useEffect(() => {
    setOpenMetrics({
      opened_count: bookmark.opened_count,
      last_opened_at: bookmark.last_opened_at,
    });
  }, [bookmark.id, bookmark.opened_count, bookmark.last_opened_at]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (isHorizontalSwipe.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontalSwipe.current) return;

    // Allow both directions, clamped
    const clampedX = Math.max(-150, Math.min(150, dx));
    setSwipeX(clampedX);
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    setSwiping(false);
    isHorizontalSwipe.current = null;
    if (swipeX <= -threshold) {
      setSwipeX(0);
      onDelete(bookmark.id);
    } else if (swipeX >= threshold) {
      // Open detail / edit
      setSwipeX(0);
      onClick(bookmark);
    } else {
      setSwipeX(0);
    }
  }, [swipeX, threshold, onDelete, onClick, bookmark]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(bookmark.url);
    toast({ title: "URL copied", description: bookmark.url });
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleRecordedOpen = useCallback((metrics: RecordedOpenMetrics) => {
    setOpenMetrics((current) =>
      metrics.opened_count >= current.opened_count
        ? { opened_count: metrics.opened_count, last_opened_at: metrics.last_opened_at }
        : current
    );
  }, []);

  const handleExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!openBookmarkExternal(bookmark, handleRecordedOpen)) {
      toast({
        title: "Cannot open bookmark",
        description: "URL must be a safe http(s) link without embedded credentials.",
        variant: "destructive",
      });
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmark.is_pinned) {
      onUnpin?.(bookmark.id, {
        onSuccess: () => toast({ title: "Unpinned" }),
        onError: () => toast({ title: "Failed to unpin", variant: "destructive" }),
      });
    } else {
      onPin?.(bookmark.id, {
        onSuccess: () => toast({ title: "Pinned" }),
        onError: () => toast({ title: "Failed to pin", variant: "destructive" }),
      });
    }
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.(bookmark.id, {
      onSuccess: () => toast({ title: "Archived", description: "Bookmark moved to archive." }),
      onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
    });
  };

  const handleToggleReadLater = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmark.read_later) {
      onClearReadLater?.(bookmark.id, {
        onSuccess: () => toast({ title: "Read later cleared" }),
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    } else {
      onReadLater?.(bookmark.id, {
        onSuccess: () => toast({ title: "Marked read later" }),
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    }
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmark.read_at) {
      onMarkUnread?.(bookmark.id, {
        onSuccess: () => {},
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    } else {
      onMarkRead?.(bookmark.id, {
        onSuccess: () => toast({ title: "Marked as read" }),
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    }
  };

  const deleteRevealed = swipeX <= -threshold;
  const editRevealed = swipeX >= threshold;
  const openedText = openMetrics.opened_count > 0 ? `opened ${openMetrics.opened_count}x` : null;

  const renderSecondaryActions = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="More bookmark actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {onArchive && (
          <DropdownMenuItem onClick={handleArchive}>
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive
          </DropdownMenuItem>
        )}
        {(onMarkRead || onMarkUnread) && (
          <DropdownMenuItem onClick={handleToggleRead}>
            {bookmark.read_at ? <BookDashed className="mr-2 h-3.5 w-3.5" /> : <BookOpen className="mr-2 h-3.5 w-3.5" />}
            {bookmark.read_at ? "Mark unread" : "Mark read"}
          </DropdownMenuItem>
        )}
        {(onReadLater || onClearReadLater) && (
          <DropdownMenuItem onClick={handleToggleReadLater}>
            {bookmark.read_later ? <BookmarkX className="mr-2 h-3.5 w-3.5" /> : <BookmarkCheck className="mr-2 h-3.5 w-3.5" />}
            {bookmark.read_later ? "Clear read later" : "Mark read later"}
          </DropdownMenuItem>
        )}
        {(onArchive || onMarkRead || onMarkUnread || onReadLater || onClearReadLater) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy URL
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderDeleteAction = () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={handleDeleteClick}
          aria-label="Move bookmark to trash"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to trash?</AlertDialogTitle>
          <AlertDialogDescription>
            "{bookmark.title}" will be moved to trash and permanently deleted after 30 days.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(bookmark.id)}
          >
            Move to trash
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete background (swipe left) */}
      <div
        className="absolute inset-0 flex items-center justify-end rounded-lg bg-destructive px-4 transition-opacity"
        style={{ opacity: swipeX < 0 ? 1 : 0 }}
      >
        <Trash2 className={`h-5 w-5 text-destructive-foreground transition-transform ${deleteRevealed ? 'scale-125' : 'scale-100'}`} />
      </div>

      {/* Edit background (swipe right) */}
      <div
        className="absolute inset-0 flex items-center justify-start rounded-lg bg-primary px-4 transition-opacity"
        style={{ opacity: swipeX > 0 ? 1 : 0 }}
      >
        <Pencil className={`h-5 w-5 text-primary-foreground transition-transform ${editRevealed ? 'scale-125' : 'scale-100'}`} />
      </div>

      {/* Card */}
      <div
        onClick={() => {
          if (selectionMode) {
            onToggleSelect?.(bookmark.id);
            return;
          }
          if (!swiping && swipeX === 0) onClick(bookmark);
        }}
        onTouchStart={selectionMode ? undefined : handleTouchStart}
        onTouchMove={selectionMode ? undefined : handleTouchMove}
        onTouchEnd={selectionMode ? undefined : handleTouchEnd}
        className={`group relative ${compact ? 'flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5' : 'flex flex-col gap-3 rounded-lg border bg-card p-4 h-full'} cursor-pointer transition-[border-color,box-shadow] duration-150 ease-out hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 ${selected ? 'ring-2 ring-primary border-primary/50' : ''}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : 'transform 180ms var(--ease-out)',
        }}
      >
        {compact ? (
          <>
            {selectionMode && (
              <div className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                {selected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            )}
            <img
              src={bookmark.favicon}
              alt=""
              className="h-4 w-4 rounded-sm shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-sm font-medium truncate min-w-0 flex-1">
              <HighlightText text={bookmark.title} query={searchQuery} />
            </span>
            <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:inline">{bookmark.domain}</span>
            <PipelineBadge bookmarkId={bookmark.id} initialStatus={bookmark.status} />
            {bookmark.tags.slice(0, 2).map((tag) => (
              <Link
                key={tag}
                to={tagHref(tag)}
                className="hidden md:inline-flex"
                aria-label={`Open #${tag} tag`}
                onClick={(event) => event.stopPropagation()}
              >
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                  {tag}
                </Badge>
              </Link>
            ))}
            {!!bookmark.read_later && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono border-warning/30 text-warning hidden md:inline-flex">Read Later</Badge>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0 hidden lg:inline">
              {openedText ?? formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true })}
            </span>
            <div role="group" aria-label="Bookmark actions" className="flex items-center gap-1 shrink-0">
              {(onPin || onUnpin) && (
                <Button variant="ghost" size="icon" className={`h-6 w-6 ${bookmark.is_pinned ? 'text-primary' : ''}`} onClick={handlePin} title={bookmark.is_pinned ? "Unpin" : "Pin"}>
                  {bookmark.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExternal} title="Open bookmark">
                <ExternalLink className="h-3 w-3" />
              </Button>
              {renderSecondaryActions()}
              {renderDeleteAction()}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {selectionMode && (
                  <div className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                    {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                )}
                <img
                  src={bookmark.favicon}
                  alt=""
                  className="h-4 w-4 rounded-sm shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {bookmark.domain}
                </span>
                {!!bookmark.is_pinned && (
                  <Pin className="h-3 w-3 text-primary shrink-0" />
                )}
                {bookmark.read_at && (
                  <BookOpen className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                )}
              </div>
              <PipelineBadge bookmarkId={bookmark.id} initialStatus={bookmark.status} />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-semibold text-sm leading-snug text-card-foreground line-clamp-2">
                <HighlightText text={bookmark.title} query={searchQuery} />
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                <HighlightText text={bookmark.summary} query={searchQuery} />
              </p>
            </div>

            {bookmark.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {!!bookmark.read_later && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 font-mono border-warning/30 text-warning"
                  >
                    Read Later
                  </Badge>
                )}
                {bookmark.tags.slice(0, 4).map((tag) => (
                  <Link
                    key={tag}
                    to={tagHref(tag)}
                    aria-label={`Open #${tag} tag`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-5 font-mono"
                    >
                      {tag}
                    </Badge>
                  </Link>
                ))}
                {bookmark.tags.length > 4 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                    +{bookmark.tags.length - 4}
                  </Badge>
                )}
              </div>
            )}
            {bookmark.tags.length === 0 && !!bookmark.read_later && (
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 font-mono border-warning/30 text-warning"
                >
                  Read Later
                </Badge>
              </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true })}
                {openedText ? ` · ${openedText}` : ""}
              </span>
              <div role="group" aria-label="Bookmark actions" className="flex items-center gap-1">
                {(onPin || onUnpin) && (
                  <Button variant="ghost" size="icon" className={`h-6 w-6 ${bookmark.is_pinned ? 'text-primary' : ''}`} onClick={handlePin} title={bookmark.is_pinned ? "Unpin" : "Pin"}>
                    {bookmark.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExternal} title="Open bookmark">
                  <ExternalLink className="h-3 w-3" />
                </Button>
                {renderSecondaryActions()}
                {renderDeleteAction()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
