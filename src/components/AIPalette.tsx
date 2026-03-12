import { useState, useEffect, useCallback, useRef } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { searchBookmarks, ApiBookmark } from "@/lib/api";
import { Globe, Plus, Loader2 } from "lucide-react";

interface AIPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBookmark: (bookmark: ApiBookmark) => void;
  onAddBookmark: () => void;
}

export function AIPalette({ open, onOpenChange, onSelectBookmark, onAddBookmark }: AIPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchBookmarks({ q, limit: 8 });
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleSelect = (bookmark: ApiBookmark) => {
    onOpenChange(false);
    onSelectBookmark(bookmark);
  };

  const handleAddBookmark = () => {
    onOpenChange(false);
    onAddBookmark();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search bookmarks…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}
        {!loading && query.trim() && results.length === 0 && (
          <CommandEmpty>No bookmarks found for &ldquo;{query}&rdquo;</CommandEmpty>
        )}
        {!loading && results.length > 0 && (
          <CommandGroup heading="Bookmarks">
            {results.map((bm) => (
              <CommandItem
                key={bm.id}
                value={bm.id}
                onSelect={() => handleSelect(bm)}
                className="flex items-center gap-3"
              >
                {bm.favicon_url ? (
                  <img
                    src={bm.favicon_url}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">
                    {bm.title ?? bm.url}
                  </div>
                  <div className="truncate text-xs text-muted-foreground font-mono">
                    {bm.domain}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!loading && (
          <>
            {results.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Actions">
              <CommandItem onSelect={handleAddBookmark} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add bookmark
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
