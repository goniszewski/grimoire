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
  const isDone = initialStatus === "indexed";

  const { data } = useQuery({
    queryKey: ["pipeline-status", bookmarkId],
    queryFn: async () => {
      const res = await getBookmarkStatus(bookmarkId);
      return res.data;
    },
    // Poll every 3s while not done, skip polling when already indexed
    refetchInterval: (query) => {
      const s = query.state.data?.bookmarkStatus;
      if (s === "indexed") return false;
      const jobStatus = query.state.data?.job?.status;
      if (jobStatus === "done" || jobStatus === "failed") return false;
      return 3000;
    },
    enabled: !isDone,
  });

  // Refresh bookmark list when this bookmark finishes indexing
  useEffect(() => {
    if (data?.bookmarkStatus === "indexed") {
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    }
  }, [data?.bookmarkStatus, qc]);

  const status: PipelineStatus = data?.bookmarkStatus ?? initialStatus;
  const jobFailed = data?.job?.status === "failed";
  const jobError = data?.job?.error;
  const isProcessing = status !== "indexed" && !jobFailed;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium font-mono",
        jobFailed ? errorStyle : statusStyles[status],
        className
      )}
    >
      {jobFailed && <AlertTriangle className="h-3 w-3" />}
      {!jobFailed && isProcessing && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {!jobFailed && !isProcessing && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />}
      {jobFailed ? `Failed: ${PIPELINE_LABELS[status]}` : PIPELINE_LABELS[status]}
    </span>
  );

  if (jobFailed && jobError) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium">Pipeline failed at {PIPELINE_LABELS[status]}</p>
          <p className="text-muted-foreground mt-1">{jobError}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
