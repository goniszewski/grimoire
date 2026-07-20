import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bookmark } from "@/types/bookmark";
import { Sparkles, Loader2, Search, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AISearchResult {
  id: string;
  reason: string;
}

interface AIPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: Bookmark[];
  onSelectBookmark: (bookmark: Bookmark) => void;
}

export function AIPalette({ open, onOpenChange, bookmarks, onSelectBookmark }: AIPaletteProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(AISearchResult & { bookmark: Bookmark })[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResults([]);
    setSelectedIndex(0);

    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: {
          query: query.trim(),
          bookmarks: bookmarks.map((b) => ({
            id: b.id,
            title: b.title,
            summary: b.summary,
            tags: b.tags,
            category: b.category,
            domain: b.domain,
          })),
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "AI Search",
          description: data.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const matched = (data?.results || [])
        .map((r: AISearchResult) => {
          const bookmark = bookmarks.find((b) => b.id === r.id);
          return bookmark ? { ...r, bookmark } : null;
        })
        .filter(Boolean) as (AISearchResult & { bookmark: Bookmark })[];

      setResults(matched);
    } catch (err) {
      console.error("AI search error:", err);
      toast({
        title: "AI Search failed",
        description: "Could not reach the AI service. Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [query, bookmarks, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (results.length > 0 && !loading) {
        onSelectBookmark(results[selectedIndex].bookmark);
        onOpenChange(false);
      } else {
        handleSearch();
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you're looking for..."
            className="border-0 p-0 h-auto text-sm focus-visible:ring-0 shadow-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border px-1.5 text-[10px] font-mono text-muted-foreground">
              ↵
            </kbd>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {results.length > 0 && (
            <div className="px-2 py-2 space-y-0.5">
              {results.map((r, i) => (
                <div
                  key={r.id}
                  onClick={() => {
                    onSelectBookmark(r.bookmark);
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex items-start gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${
                    i === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
                  }`}
                >
                  <img
                    src={r.bookmark.favicon}
                    alt=""
                    className="h-4 w-4 rounded-sm shrink-0 mt-0.5"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.bookmark.title}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-mono">
                        {r.bookmark.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {r.bookmark.domain}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.reason}</p>
                  </div>
                  {i === selectedIndex && (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !loading && query && (
            <div className="px-4 py-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded border text-[10px] font-mono">Enter</kbd> to search with AI
              </p>
            </div>
          )}

          {!query && !loading && (
            <div className="px-4 py-8 text-center">
              <Sparkles className="h-8 w-8 text-primary/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Ask in natural language, e.g. "articles about database internals"
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {["state management in React", "CLI design best practices", "Rust learning resources"].map((ex) => (
                  <Badge
                    key={ex}
                    variant="secondary"
                    className="text-[10px] font-mono cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => {
                      setQuery(ex);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                  >
                    {ex}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="px-4 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Searching your bookmarks with AI...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded border font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border font-mono">↵</kbd> {results.length > 0 ? "open" : "search"}
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border font-mono">esc</kbd> close
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> AI Search
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
