import { Bookmark } from "@/types/bookmark";
import { PipelineBadge } from "./PipelineBadge";
import { HighlightText } from "./HighlightText";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, ExternalLink, Pencil, Check } from "lucide-react";
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
import { formatDistanceToNow } from "date-fns";
import { useRef, useState, useCallback } from "react";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
  onClick: (bookmark: Bookmark) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  searchQuery?: string;
  compact?: boolean;
}

export function BookmarkCard({ bookmark, onDelete, onClick, selectionMode, selected, onToggleSelect, searchQuery = "", compact }: BookmarkCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const threshold = 100;

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

  const handleExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(bookmark.url, "_blank");
  };

  const deleteRevealed = swipeX <= -threshold;
  const editRevealed = swipeX >= threshold;

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
        className={`group relative ${compact ? 'flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5' : 'flex flex-col gap-3 rounded-lg border bg-card p-4 h-full'} cursor-pointer transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 ${selected ? 'ring-2 ring-primary border-primary/50' : ''}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
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
            <PipelineBadge status={bookmark.status} error={bookmark.error} />
            {bookmark.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono hidden md:inline-flex">{tag}</Badge>
            ))}
            <span className="text-[10px] text-muted-foreground shrink-0 hidden lg:inline">
              {formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true })}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExternal}>
                <ExternalLink className="h-3 w-3" />
              </Button>
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
              </div>
              <PipelineBadge status={bookmark.status} error={bookmark.error} />
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
                {bookmark.tags.slice(0, 4).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 font-mono"
                  >
                    {tag}
                  </Badge>
                ))}
                {bookmark.tags.length > 4 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                    +{bookmark.tags.length - 4}
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true })}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleExternal}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleDeleteClick}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
                      <AlertDialogDescription>
                        "{bookmark.title}" will be removed. You can undo this from the toast notification.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onDelete(bookmark.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
