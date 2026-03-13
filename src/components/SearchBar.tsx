import { Search, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useRef } from "react";
import { SearchMode } from "@/hooks/use-bookmarks";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  searchMode: SearchMode;
  onSearchModeChange: (mode: SearchMode) => void;
}

const MODES: { value: SearchMode; label: string }[] = [
  { value: "keyword", label: "KW" },
  { value: "semantic", label: "AI" },
  { value: "hybrid", label: "MX" },
];

export function SearchBar({ value, onChange, searchMode, onSearchModeChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const cycleMode = () => {
    const idx = MODES.findIndex((m) => m.value === searchMode);
    onSearchModeChange(MODES[(idx + 1) % MODES.length].value);
  };

  const currentLabel = MODES.find((m) => m.value === searchMode)?.label ?? "KW";

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search bookmarks..."
        className="h-12 pl-12 pr-28 text-base bg-card border-border rounded-lg focus-visible:ring-primary/50 font-sans"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <button
          type="button"
          onClick={cycleMode}
          title={`Search mode: ${searchMode} (click to cycle)`}
          className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 font-mono text-xs text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
        >
          {currentLabel}
        </button>
        <kbd className="pointer-events-none hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 font-mono text-xs text-muted-foreground">
          <Command className="h-3 w-3" />K
        </kbd>
      </div>
    </div>
  );
}
