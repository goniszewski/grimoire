import { useEffect, useState } from "react";
import { UIBookmark as Bookmark } from "@/hooks/use-bookmarks";
import { PipelineBadge } from "./PipelineBadge";
import { PipelineRecoveryPanel } from "./PipelineRecoveryPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Copy, Calendar, Globe, Tag, FolderOpen, Pencil, Check, X, Pin, PinOff, Archive, BookOpen, BookDashed, NotebookPen, BookmarkCheck, BookmarkX, Clock, FileText, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { openBookmarkExternal, recordBookmarkOpenExternal, type RecordedOpenMetrics } from "@/lib/bookmark-open";
import { format } from "date-fns";
import ReactMarkdown, { type Components } from "react-markdown";

interface BookmarkDetailContentProps {
  bookmark: Bookmark;
  onUpdateTags: (id: string, tags: string[]) => void;
  onUpdateCategory: (id: string, category: string) => void;
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

const extractedMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: () => null,
};

export function BookmarkDetailContent({
  bookmark,
  onUpdateTags,
  onUpdateCategory,
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
}: BookmarkDetailContentProps) {
  const [tagInput, setTagInput] = useState("");
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [openMetrics, setOpenMetrics] = useState({
    opened_count: bookmark.opened_count,
    last_opened_at: bookmark.last_opened_at,
  });
  const openedLabel = openMetrics.opened_count === 1 ? "Opened 1 time" : `Opened ${openMetrics.opened_count} times`;
  const content = bookmark.content ?? null;
  const extractedMarkdown = content?.markdown?.trim() ?? "";
  const hasExtractedContent = extractedMarkdown.length > 0;
  const hasSourceDetails = Boolean(
    content?.author ||
    content?.published_at ||
    (typeof content?.word_count === "number" && content.word_count > 0) ||
    content?.language ||
    content?.extracted_at
  );

  const formatDateOnly = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy 'at' h:mm a");
  };

  useEffect(() => {
    setOpenMetrics({
      opened_count: bookmark.opened_count,
      last_opened_at: bookmark.last_opened_at,
    });
  }, [bookmark.id, bookmark.opened_count, bookmark.last_opened_at]);

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      const newTag = tagInput.trim().toLowerCase();
      if (!bookmark.tags.includes(newTag)) {
        onUpdateTags(bookmark.id, [...bookmark.tags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    onUpdateTags(bookmark.id, bookmark.tags.filter((t) => t !== tag));
  };

  const handleCategorySubmit = () => {
    if (categoryInput.trim()) {
      onUpdateCategory(bookmark.id, categoryInput.trim());
    }
    setEditingCategory(false);
  };

  const handleNotesSubmit = () => {
    const trimmed = notesInput.trim() || null;
    if (trimmed !== (bookmark.notes?.trim() || null)) {
      onUpdateNotes(bookmark.id, trimmed);
    }
    setEditingNotes(false);
  };

  const handleRecordedOpen = (metrics: RecordedOpenMetrics) => {
    setOpenMetrics((current) =>
      metrics.opened_count >= current.opened_count
        ? { opened_count: metrics.opened_count, last_opened_at: metrics.last_opened_at }
        : current
    );
  };

  return (
    <div className="space-y-5 mt-2">

      <div className="flex items-center gap-2">
        <PipelineBadge bookmarkId={bookmark.id} initialStatus={bookmark.status} />
        {!!bookmark.read_later && (
          <Badge
            variant="outline"
            className="text-xs font-mono border-amber-500/30 text-amber-700 dark:text-amber-300"
          >
            Read Later
          </Badge>
        )}
      </div>

      <PipelineRecoveryPanel bookmarkId={bookmark.id} />

      {/* Summary */}
      <div className="group/summary">
        <p className="text-sm text-muted-foreground leading-relaxed">{bookmark.summary}</p>
      </div>

      {hasSourceDetails && content && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source Details</span>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {content.author && (
              <div className="min-w-0">
                <dt className="text-muted-foreground">Author</dt>
                <dd className="truncate font-medium text-foreground">{content.author}</dd>
              </div>
            )}
            {content.published_at && (
              <div className="min-w-0">
                <dt className="text-muted-foreground">Published</dt>
                <dd className="truncate font-medium text-foreground">{formatDateOnly(content.published_at)}</dd>
              </div>
            )}
            {typeof content.word_count === "number" && content.word_count > 0 && (
              <div className="min-w-0">
                <dt className="text-muted-foreground">Length</dt>
                <dd className="truncate font-medium text-foreground">{content.word_count.toLocaleString()} words</dd>
              </div>
            )}
            {content.language && (
              <div className="min-w-0">
                <dt className="text-muted-foreground">Language</dt>
                <dd className="truncate font-medium text-foreground">{content.language}</dd>
              </div>
            )}
            {content.extracted_at && (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-muted-foreground">Extracted</dt>
                <dd className="truncate font-medium text-foreground">{formatDateTime(content.extracted_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {hasExtractedContent && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Extracted Content</span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none max-h-[28rem] overflow-y-auto rounded-md border bg-muted/20 px-3 py-2 text-sm">
            <ReactMarkdown components={extractedMarkdownComponents}>{extractedMarkdown}</ReactMarkdown>
          </div>
        </div>
      )}


      {/* Personal Notes */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NotebookPen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</span>
          </div>
          {!editingNotes && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setNotesInput(bookmark.notes ?? ""); setEditingNotes(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-1.5">
            <Textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Add a personal note… (Markdown supported)"
              className="text-sm leading-relaxed min-h-[80px] font-mono"
              autoFocus
            />
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNotesSubmit}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingNotes(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : bookmark.notes ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm cursor-pointer hover:bg-muted/40 rounded-md p-1 -mx-1 transition-colors"
            onClick={() => { setNotesInput(bookmark.notes ?? ""); setEditingNotes(true); }}
          >
            <ReactMarkdown>{bookmark.notes}</ReactMarkdown>
          </div>
        ) : (
          <p
            className="text-sm text-muted-foreground/60 italic cursor-pointer hover:text-muted-foreground transition-colors"
            onClick={() => { setNotesInput(""); setEditingNotes(true); }}
          >
            Add a personal note…
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {bookmark.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs font-mono cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
              onClick={() => handleRemoveTag(tag)}
            >
              {tag} ×
            </Badge>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="add tag..."
            className="h-6 w-24 text-xs font-mono border-dashed"
          />
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</span>
        </div>
        {editingCategory ? (
          <Input
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onBlur={handleCategorySubmit}
            onKeyDown={(e) => e.key === "Enter" && handleCategorySubmit()}
            className="h-7 text-xs w-40"
            autoFocus
          />
        ) : (
          <Badge
            variant="outline"
            className="cursor-pointer text-xs"
            onClick={() => {
              setCategoryInput(bookmark.category);
              setEditingCategory(true);
            }}
          >
            {bookmark.category}
          </Badge>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 text-xs text-muted-foreground pt-2 border-t min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 group/url">
          <Globe className="h-3 w-3 shrink-0" />
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordBookmarkOpenExternal(bookmark, handleRecordedOpen)}
            className="hover:text-foreground font-mono truncate"
          >
            {bookmark.url}
          </a>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar className="h-3 w-3" />
          {format(new Date(bookmark.savedAt), "MMM d, yyyy 'at' h:mm a")}
        </div>
        {openMetrics.opened_count > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <ExternalLink className="h-3 w-3" />
            {openedLabel}
          </div>
        )}
        {openMetrics.last_opened_at && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock className="h-3 w-3" />
            Last opened {format(new Date(openMetrics.last_opened_at), "MMM d, yyyy 'at' h:mm a")}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(bookmark.url);
            toast({ title: "URL copied" });
          }}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copy URL
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordBookmarkOpenExternal(bookmark, handleRecordedOpen)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open
          </a>
        </Button>
        {(onPin || onUnpin) && (
          <Button
            variant={bookmark.is_pinned ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
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
            }}
          >
            {bookmark.is_pinned ? <PinOff className="h-3.5 w-3.5 mr-1.5" /> : <Pin className="h-3.5 w-3.5 mr-1.5" />}
            {bookmark.is_pinned ? "Unpin" : "Pin"}
          </Button>
        )}
        {(onReadLater || onClearReadLater) && (
          <Button
            variant={bookmark.read_later ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
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
            }}
          >
            {bookmark.read_later ? <BookmarkX className="h-3.5 w-3.5 mr-1.5" /> : <BookmarkCheck className="h-3.5 w-3.5 mr-1.5" />}
            {bookmark.read_later ? "Clear read later" : "Read later"}
          </Button>
        )}
        {onArchive && !bookmark.is_archived && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onArchive(bookmark.id, {
                onSuccess: () => toast({ title: "Archived", description: "Bookmark moved to archive." }),
                onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
              });
            }}
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Archive
          </Button>
        )}
        {(onMarkRead || onMarkUnread) && (
          <Button
            variant={bookmark.read_at ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
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
            }}
          >
            {bookmark.read_at ? <BookDashed className="h-3.5 w-3.5 mr-1.5" /> : <BookOpen className="h-3.5 w-3.5 mr-1.5" />}
            {bookmark.read_at ? "Mark unread" : "Mark read"}
          </Button>
        )}
      </div>

      {/* Related */}
      {relatedBookmarks.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Related Bookmarks
          </span>
          <div className="space-y-1.5">
            {relatedBookmarks.map((rb) => (
              <div
                key={rb.id}
                onClick={() => onSelectRelated(rb)}
                className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <img
                  src={rb.favicon}
                  alt=""
                  className="h-3.5 w-3.5 rounded-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-sm truncate">{rb.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
                  {rb.domain}
                </span>
                {rb.opened_count > 0 && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {rb.opened_count}x
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  title="Open bookmark"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBookmarkExternal(rb);
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
