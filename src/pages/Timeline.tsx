import { useState } from "react";
import { useTimeline } from "@/hooks/use-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  History,
  FolderPlus,
  GitMerge,
  PencilLine,
  Copy,
  Tag,
  Bot,
  User,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  XCircle,
  Flag,
} from "lucide-react";
import type { TimelineEventType } from "@/lib/api";

const PAGE_SIZE = 50;

const EVENT_CONFIG: Record<
  TimelineEventType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  category_created: {
    label: "Category created",
    icon: <FolderPlus className="h-3.5 w-3.5" />,
    color: "text-green-500",
  },
  category_merged: {
    label: "Category merged",
    icon: <GitMerge className="h-3.5 w-3.5" />,
    color: "text-blue-500",
  },
  category_renamed: {
    label: "Category renamed",
    icon: <PencilLine className="h-3.5 w-3.5" />,
    color: "text-yellow-500",
  },
  duplicate_removed: {
    label: "Duplicate removed",
    icon: <Copy className="h-3.5 w-3.5" />,
    color: "text-red-500",
  },
  cluster_labeled: {
    label: "Cluster labeled",
    icon: <Tag className="h-3.5 w-3.5" />,
    color: "text-purple-500",
  },
  category_merge_suggested: {
    label: "Merge suggested",
    icon: <GitMerge className="h-3.5 w-3.5" />,
    color: "text-sky-500",
  },
  duplicate_flagged: {
    label: "Duplicate flagged",
    icon: <Flag className="h-3.5 w-3.5" />,
    color: "text-orange-500",
  },
  suggestion_accepted: {
    label: "Suggestion accepted",
    icon: <CheckCheck className="h-3.5 w-3.5" />,
    color: "text-emerald-500",
  },
  suggestion_rejected: {
    label: "Suggestion rejected",
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
  },
};

function EventIcon({ type }: { type: TimelineEventType }) {
  const cfg = EVENT_CONFIG[type];
  return (
    <span className={`shrink-0 ${cfg?.color ?? "text-muted-foreground"}`}>
      {cfg?.icon ?? <History className="h-3.5 w-3.5" />}
    </span>
  );
}

function SourceBadge({ source }: { source: "agent" | "user" }) {
  if (source === "agent") {
    return (
      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 gap-0.5 font-mono">
        <Bot className="h-2.5 w-2.5" />
        agent
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5 font-mono">
      <User className="h-2.5 w-2.5" />
      user
    </Badge>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Timeline() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useTimeline(PAGE_SIZE, offset);

  const total = data?.pagination.total ?? 0;
  const hasMore = data?.pagination.has_more ?? false;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

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
          <History className="h-4 w-4 text-muted-foreground" />
          <h1 className="font-semibold text-sm">Library Timeline</h1>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
              {total}
            </Badge>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Failed to load timeline.</p>
          </div>
        )}

        {!isLoading && !isError && data?.data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground mb-1">No events yet</h3>
            <p className="text-sm text-muted-foreground/60 max-w-sm">
              Timeline events will appear here when categories are created, merged, or
              when the AI agent reorganizes your library.
            </p>
          </div>
        )}

        {!isLoading && !isError && data && data.data.length > 0 && (
          <>
            <ol className="relative border-l border-border ml-4 space-y-0">
              {data.data.map((event) => {
                const cfg = EVENT_CONFIG[event.type];
                return (
                  <li key={event.id} className="mb-6 ml-6">
                    <span
                      className={`absolute -left-[9px] flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background bg-muted ${cfg?.color ?? "text-muted-foreground"}`}
                    >
                      <EventIcon type={event.type} />
                    </span>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-mono mb-0.5">
                          {formatDate(event.created_at)}
                        </p>
                        <p className="text-sm font-medium leading-snug">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cfg?.label ?? event.type}
                        </p>
                      </div>
                      <SourceBadge source={event.source} />
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground font-mono">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
