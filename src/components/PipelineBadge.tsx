import { PipelineStatus, PIPELINE_LABELS } from "@/types/bookmark";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getBookmarkStatus } from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { PIPELINE_FAILURE_LABELS } from "@/lib/pipeline-labels";

const statusStyles: Record<PipelineStatus, string> = {
  saved: "bg-pipeline-saved/15 text-pipeline-saved border-pipeline-saved/30",
  fetched: "bg-pipeline-fetched/15 text-pipeline-fetched border-pipeline-fetched/30",
  extracted: "bg-pipeline-extracted/15 text-pipeline-extracted border-pipeline-extracted/30",
  ai_enriched: "bg-pipeline-ai-enriched/15 text-pipeline-ai-enriched border-pipeline-ai-enriched/30",
  indexed: "bg-pipeline-indexed/15 text-pipeline-indexed border-pipeline-indexed/30",
};

const errorStyle = "bg-destructive/15 text-destructive border-destructive/30";

interface PipelineBadgeProps {
  bookmarkId: string;
  initialStatus: PipelineStatus;
  className?: string;
}

export function PipelineBadge({ bookmarkId, initialStatus, className }: PipelineBadgeProps) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["pipeline-status", bookmarkId],
    queryFn: async () => {
      const res = await getBookmarkStatus(bookmarkId);
      return res.data;
    },
    // Poll while a pipeline job is still active, including reprocess jobs for indexed bookmarks.
    refetchInterval: (query) => {
      const jobStatus = query.state.data?.job?.status;
      if (jobStatus === "pending" || jobStatus === "running") return 3000;
      if (jobStatus === "done" || jobStatus === "failed") return false;
      const s = query.state.data?.bookmarkStatus;
      if (s === "indexed") return false;
      if (query.state.data?.last_failure) return false;
      return 3000;
    },
    enabled: !!bookmarkId,
  });

  // Refresh bookmark list when this bookmark finishes indexing
  useEffect(() => {
    if (data?.bookmarkStatus === "indexed") {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    }
  }, [data?.bookmarkStatus, qc]);

  const status: PipelineStatus = data?.bookmarkStatus ?? initialStatus;
  const jobStatus = data?.job?.status;
  const hasActiveJob = jobStatus === "pending" || jobStatus === "running";
  const jobFailed = data?.job?.status === "failed";
  const jobError = data?.job?.error;
  const lastFailure = data?.last_failure ?? null;
  const hasFailure = !hasActiveJob && (jobFailed || !!lastFailure);
  const failureLabel = lastFailure
    ? PIPELINE_FAILURE_LABELS[lastFailure.stage]
    : PIPELINE_LABELS[status];
  const failureMessage = jobError ?? lastFailure?.message ?? null;
  const isProcessing = hasActiveJob || (status !== "indexed" && !hasFailure);

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium font-mono",
        hasFailure ? errorStyle : statusStyles[status],
        className
      )}
    >
      {hasFailure && <AlertTriangle className="h-3 w-3" />}
      {!hasFailure && isProcessing && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {!hasFailure && !isProcessing && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />}
      {hasFailure ? `Failed: ${failureLabel}` : PIPELINE_LABELS[status]}
    </span>
  );

  if (hasFailure && failureMessage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium">Pipeline failed at {failureLabel}</p>
          <p className="text-muted-foreground mt-1">{failureMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
