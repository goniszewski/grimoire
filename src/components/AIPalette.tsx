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
import { searchBookmarks, type ApiBookmark } from "@/lib/api";
import { Globe, Plus, Loader2 } from "lucide-react";

interface AIPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectBookmark: (bookmark: ApiBookmark) => void;
  onAddBookmark: () => void;
}

function isEmbeddingProviderRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = "status" in err ? err.status : undefined;
  const detail = "detail" in err ? err.detail : undefined;
  const message = "message" in err ? err.message : undefined;
  return (
    status === 422 &&
    String(detail ?? message ?? "").toLowerCase().includes("embedding provider")
  );
}

export function AIPalette({ open, onOpenChange, onSelectBookmark, onAddBookmark }: AIPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGenerationRef = useRef(0);

  const runSearch = useCallback(async (q: string, generation: number) => {
    const queryText = q.trim();
    if (!queryText || generation !== searchGenerationRef.current) {
      return;
    }
    setLoading(true);
    try {
      const res = await searchBookmarks({ q: queryText, mode: "hybrid", limit: 8 });
      if (generation === searchGenerationRef.current) {
        setResults(res.data as unknown as ApiBookmark[]);
      }
    } catch (err) {
      if (isEmbeddingProviderRequiredError(err)) {
        try {
          const res = await searchBookmarks({ q: queryText, mode: "keyword", limit: 8 });
          if (generation === searchGenerationRef.current) {
            setResults(res.data as unknown as ApiBookmark[]);
          }
          return;
        } catch {
          // Fall through to the empty state below.
        }
      }
      if (generation === searchGenerationRef.current) {
        setResults([]);
      }
    } finally {
      if (generation === searchGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const generation = ++searchGenerationRef.current;

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(query, generation), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      searchGenerationRef.current += 1;
    };
  }, [query, runSearch]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      searchGenerationRef.current += 1;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setQuery("");
      setResults([]);
      setLoading(false);
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
