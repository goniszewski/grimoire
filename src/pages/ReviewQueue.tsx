import { useSuggestions } from "@/hooks/use-suggestions";
import type { ApiSuggestion, SuggestionType } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { listBookmarks } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Check,
  X,
  GitMerge,
  FolderPlus,
  Copy,
  Inbox,
} from "lucide-react";

// ─── Suggestion type config ───────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  SuggestionType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  new_subcategory: {
    label: "New subcategory",
    icon: <FolderPlus className="h-4 w-4" />,
    color: "text-success",
  },
  merge_categories: {
    label: "Merge categories",
    icon: <GitMerge className="h-4 w-4" />,
    color: "text-info",
  },
  duplicate_bookmark: {
    label: "Duplicate bookmark",
    icon: <Copy className="h-4 w-4" />,
    color: "text-warning",
  },
};

// ─── Confidence bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{pct}%</span>
    </div>
  );
}

// ─── Single suggestion card ───────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: ApiSuggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const cfg = TYPE_CONFIG[suggestion.type];

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${cfg?.color ?? "text-muted-foreground"}`}>
          {cfg?.icon ?? <Bot className="h-4 w-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
              {cfg?.label ?? suggestion.type}
            </Badge>
          </div>
          <p className="text-sm leading-snug">{suggestion.value}</p>
          <ConfidenceBar value={suggestion.confidence} />
          <p className="text-[10px] text-muted-foreground font-mono mt-1.5">
            {new Date(suggestion.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={onReject}
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={onAccept}
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewQueue() {
  const navigate = useNavigate();
  const { suggestions, pendingCount, isLoading, isError, accept, reject } = useSuggestions();

  const bookmarkCountQuery = useQuery({
    queryKey: ["bookmarks", "count-for-cold-start"],
    queryFn: () => listBookmarks({ limit: 1 }),
    staleTime: 60_000,
  });
  const bookmarkTotal = bookmarkCountQuery.data?.pagination?.total ?? null;
  const isColdStart = bookmarkTotal !== null && bookmarkTotal < 20;
  // Unify loading states so the skeleton covers both queries and avoids a layout flash
  // where "All caught up" renders briefly before the bookmark count resolves.
  const combinedLoading = isLoading || bookmarkCountQuery.isLoading;

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h1 className="font-semibold text-sm">Review Queue</h1>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-mono">
              {pendingCount}
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
        {combinedLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!combinedLoading && isError && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Failed to load suggestions.</p>
          </div>
        )}

        {!combinedLoading && !isError && isColdStart && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">Almost there!</h3>
            <p className="text-sm text-muted-foreground/60 max-w-sm">
              The organisation agent needs at least 20 bookmarks before it can make
              suggestions. Keep saving! ({bookmarkTotal ?? 0}/20 saved)
            </p>
          </div>
        )}

        {!combinedLoading && !isError && !isColdStart && suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">All caught up</h3>
            <p className="text-sm text-muted-foreground/60 max-w-sm">
              No pending suggestions right now. The AI agent will analyse your library
              periodically and suggest ways to keep it organised.
            </p>
          </div>
        )}

        {!combinedLoading && !isError && !isColdStart && suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onAccept={() => accept(s.id)}
                onReject={() => reject(s.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
