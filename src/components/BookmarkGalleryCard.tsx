import { useState } from "react";
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
  // Track which URL failed so a refreshed screenshot URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = bookmark.screenshot && bookmark.screenshot !== failedUrl ? bookmark.screenshot : null;
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
            onError={() => setFailedUrl(imageUrl)}
            className="block h-auto min-h-24 w-full bg-muted"
          />
        ) : (
          <span
            data-testid="gallery-placeholder"
            className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-muted p-4 text-muted-foreground"
          >
            <img src={bookmark.favicon} alt="" loading="lazy" className="h-8 w-8 rounded" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8 text-white">
          <span className="line-clamp-2 block text-sm font-medium leading-snug">{bookmark.title}</span>
          <span className="block truncate text-xs text-white/80">{bookmark.domain}</span>
          {tags.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded-md bg-secondary px-1.5 py-0 text-[10px] font-semibold text-secondary-foreground">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
    </article>
  );
}
