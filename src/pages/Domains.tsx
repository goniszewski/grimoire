import { useState, useMemo } from "react";
import { useBookmarkStore } from "@/hooks/use-bookmark-store";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Search } from "lucide-react";

const Domains = () => {
  const store = useBookmarkStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return store.domains;
    const q = search.toLowerCase();
    return store.domains.filter((d) => d.domain.toLowerCase().includes(q));
  }, [store.domains, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">All Domains</h1>
            <p className="text-xs text-muted-foreground font-mono">{store.domains.length} domains</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter domains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
          {filtered.map((d) => (
            <button
              key={d.domain}
              onClick={() => {
                store.setSelectedDomain(d.domain);
                navigate("/");
              }}
              className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-accent group"
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`}
                alt=""
                className="h-4 w-4 rounded-sm shrink-0"
              />
              <span className="text-sm font-mono truncate flex-1">{d.domain}</span>
              <Badge variant="secondary" className="text-[10px] h-5 px-2 font-mono">
                {d.count} {d.count === 1 ? "bookmark" : "bookmarks"}
              </Badge>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No domains match "{search}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Domains;
