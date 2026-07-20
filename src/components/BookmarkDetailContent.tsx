import { useState } from "react";
import { Bookmark } from "@/types/bookmark";
import { PipelineBadge } from "./PipelineBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Copy, Calendar, Globe, Tag, FolderOpen, Pencil, Check, X, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BookmarkDetailContentProps {
  bookmark: Bookmark;
  onUpdateTags: (id: string, tags: string[]) => void;
  onUpdateCategory: (id: string, category: string) => void;
  onUpdateField: (id: string, field: "title" | "url" | "summary", value: string) => void;
  onRetry: (id: string) => void;
  relatedBookmarks: Bookmark[];
  onSelectRelated: (bookmark: Bookmark) => void;
}

export function BookmarkDetailContent({
  bookmark,
  onUpdateTags,
  onUpdateCategory,
  onUpdateField,
  onRetry,
  relatedBookmarks,
  onSelectRelated,
}: BookmarkDetailContentProps) {
  const [tagInput, setTagInput] = useState("");
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryInput, setSummaryInput] = useState("");

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

  const handleSummarySubmit = () => {
    if (summaryInput.trim() && summaryInput.trim() !== bookmark.summary) {
      onUpdateField(bookmark.id, "summary", summaryInput.trim());
    }
    setEditingSummary(false);
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim() && urlInput.trim() !== bookmark.url) {
      try {
        new URL(urlInput.trim());
        onUpdateField(bookmark.id, "url", urlInput.trim());
      } catch {
        toast({ title: "Invalid URL", description: "Please enter a valid URL.", variant: "destructive" });
      }
    }
    setEditingUrl(false);
  };

  return (
    <div className="space-y-5 mt-2">

      <div className="flex items-center gap-2">
        <PipelineBadge status={bookmark.status} error={bookmark.error} />
        {bookmark.error && (
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1.5" onClick={() => onRetry(bookmark.id)}>
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
        )}
      </div>

      {/* Summary — editable */}
      <div className="group/summary">
        {editingSummary ? (
          <div className="space-y-1.5">
            <Textarea
              value={summaryInput}
              onChange={(e) => setSummaryInput(e.target.value)}
              className="text-sm leading-relaxed min-h-[60px]"
              autoFocus
            />
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSummarySubmit}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSummary(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1.5">
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">{bookmark.summary}</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover/summary:opacity-100 transition-opacity shrink-0 mt-0.5"
              onClick={() => { setSummaryInput(bookmark.summary); setEditingSummary(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Content — read-only */}
      {bookmark.content && (
        <div className="rounded-md border bg-muted/30 overflow-hidden">
          <div className="px-4 py-2 border-b bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Page Content</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{bookmark.content}</p>
          </div>
        </div>
      )}

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
          {editingUrl ? (
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                className="h-6 text-xs font-mono flex-1"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={handleUrlSubmit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setEditingUrl(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground font-mono truncate"
              >
                {bookmark.url}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover/url:opacity-100 transition-opacity shrink-0"
                onClick={() => { setUrlInput(bookmark.url); setEditingUrl(true); }}
              >
                <Pencil className="h-2.5 w-2.5" />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar className="h-3 w-3" />
          {format(new Date(bookmark.savedAt), "MMM d, yyyy 'at' h:mm a")}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
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
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open
          </a>
        </Button>
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
