import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UIBookmark } from "@/hooks/use-bookmarks";

interface BookmarkGalleryCardProps {
  bookmark: UIBookmark;
  onClick: (bookmark: UIBookmark) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const MAX_TAGS = 3;

/**
 * Image-first card for the gallery (masonry) view. A single native button, so
 * Tab / Enter / Space work with no extra key handling. Bookmarks without a
 * cached image (or whose image fails to load) get a placeholder tile.
 */
export function BookmarkGalleryCard({ bookmark, onClick, selectionMode, selected, onToggleSelect }: BookmarkGalleryCardProps) {
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : bookmark.screenshot;
  const tags = bookmark.tags.slice(0, MAX_TAGS);

  const handleActivate = () => {
    if (selectionMode) onToggleSelect?.(bookmark.id);
    else onClick(bookmark);
  };

  return (
    <article className="mb-3 break-inside-avoid" data-testid="gallery-card">
      <button
        type="button"
        onClick={handleActivate}
        aria-pressed={selectionMode ? !!selected : undefined}
        aria-label={`${selectionMode ? "Select" : "Open"} ${bookmark.title}`}
        className={cn(
          "group relative block w-full overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-shadow",
          "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          selected && "ring-2 ring-primary",
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Preview of ${bookmark.title}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="block h-auto min-h-24 w-full bg-muted"
          />
        ) : (
          <div
            data-testid="gallery-placeholder"
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-muted-foreground"
          >
            <img src={bookmark.favicon} alt="" loading="lazy" className="h-8 w-8 rounded" />
            <span className="max-w-full truncate text-xs">{bookmark.domain}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8 text-white">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{bookmark.title}</h3>
          <p className="truncate text-xs text-white/70">{bookmark.domain}</p>
          {tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </button>
    </article>
  );
}
