import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UIBookmark as Bookmark } from "@/hooks/use-bookmarks";
import { getBookmark } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookmarkDetailContent } from "./BookmarkDetailContent";
import { PipelineBadge } from "./PipelineBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import {
  generatedFavicon,
  normaliseBookmarkMediaSet,
  normaliseDaemonMediaUrl,
} from "@/lib/media-url";

interface BookmarkDetailProps {
  bookmark: Bookmark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onUpdateField: (id: string, field: "title" | "url" | "summary", value: string) => void;
  onUpdateNotes: (id: string, notes: string | null) => void;
  onPin?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  onUnpin?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  onReadLater?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  onClearReadLater?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  onArchive?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  onMarkRead?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  onMarkUnread?: (id: string, callbacks: { onSuccess: () => void; onError: () => void }) => void;
  relatedBookmarks: Bookmark[];
  onSelectRelated: (bookmark: Bookmark) => void;
}

export function BookmarkDetail({
  bookmark,
  open,
  onOpenChange,
  onUpdateTags,
  onUpdateCategory,
  onUpdateField,
  onUpdateNotes,
  onPin,
  onUnpin,
  onReadLater,
  onClearReadLater,
  onArchive,
  onMarkRead,
  onMarkUnread,
  relatedBookmarks,
  onSelectRelated,
}: BookmarkDetailProps) {
  const isMobile = useIsMobile();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const bookmarkId = bookmark?.id ?? null;

  const detailQuery = useQuery({
    queryKey: ["bookmark-detail", bookmarkId],
    queryFn: () => getBookmark(bookmarkId!),
    enabled: open && !!bookmarkId,
    staleTime: 10_000,
  });

  if (!bookmark) return null;

  const detailData = detailQuery.data?.data;
  const detailContent = detailData?.content;
  const detailMedia = normaliseBookmarkMediaSet(detailData?.media);
  const bookmarkWithDetail: Bookmark =
    detailData !== undefined
      ? {
          ...bookmark,
          summary: detailContent?.summary ?? bookmark.summary,
          favicon:
            normaliseDaemonMediaUrl(detailData.favicon_url) ??
            detailMedia?.favicon?.url ??
            generatedFavicon(bookmark.domain),
          content: detailContent,
          media: detailMedia,
        }
      : bookmark;

  const handleTitleSubmit = () => {
    if (titleInput.trim() && titleInput.trim() !== bookmark.title) {
      onUpdateField(bookmark.id, "title", titleInput.trim());
    }
    setEditingTitle(false);
  };

  const headerContent = (
    <div className="min-w-0 flex flex-col gap-1.5 text-left">
      <div className="flex items-center gap-2">
        <img
          src={bookmarkWithDetail.favicon}
          alt=""
          className="h-5 w-5 shrink-0 rounded-sm"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="min-w-0 text-xs text-muted-foreground font-mono [overflow-wrap:anywhere]">{bookmarkWithDetail.domain}</span>
        <PipelineBadge bookmarkId={bookmark.id} initialStatus={bookmark.status} />
      </div>
    </div>
  );

  const editableTitle = editingTitle ? (
    <div className="flex items-center gap-1.5 pr-8">
      <Input
        value={titleInput}
        onChange={(e) => setTitleInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleTitleSubmit()}
        className="h-8 text-lg font-semibold"
        autoFocus
      />
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleTitleSubmit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingTitle(false)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  ) : (
    <div className="min-w-0 flex items-start gap-1.5 group/title pr-6">
      <span className="min-w-0 text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{bookmark.title}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
        aria-label="Edit bookmark title"
        onClick={() => { setTitleInput(bookmark.title); setEditingTitle(true); }}
      >
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );

  const content = (
    <BookmarkDetailContent
      bookmark={bookmarkWithDetail}
      onUpdateTags={onUpdateTags}
      onUpdateCategory={onUpdateCategory}
      onUpdateNotes={onUpdateNotes}
      onPin={onPin}
      onUnpin={onUnpin}
      onReadLater={onReadLater}
      onClearReadLater={onClearReadLater}
      onArchive={onArchive}
      onMarkRead={onMarkRead}
      onMarkUnread={onMarkUnread}
      relatedBookmarks={relatedBookmarks}
      onSelectRelated={onSelectRelated}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditingTitle(false); }}>
        <DrawerContent className="max-h-[85dvh]">
          <div className="min-h-0 min-w-0 overflow-y-auto" data-testid="bookmark-detail-scroll">
          <DrawerHeader className="text-left pb-2">
            {headerContent}
            <DrawerTitle className="sr-only">{bookmark.title}</DrawerTitle>
            {editableTitle}
          </DrawerHeader>
          <div className="min-w-0 px-4 pb-6">
            {content}
          </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditingTitle(false); }}>
      <DialogContent className="min-w-0 w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85dvh] overflow-y-auto" data-testid="bookmark-detail-scroll">
        <DialogHeader>
          {headerContent}
          <DialogTitle className="sr-only">{bookmark.title}</DialogTitle>
          {editableTitle}
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
