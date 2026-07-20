import { PipelineStatus, PipelineError, PIPELINE_LABELS } from "@/types/bookmark";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusStyles: Record<PipelineStatus, string> = {
  saved: "bg-pipeline-saved/15 text-pipeline-saved border-pipeline-saved/30",
  fetched: "bg-pipeline-fetched/15 text-pipeline-fetched border-pipeline-fetched/30",
  extracted: "bg-pipeline-extracted/15 text-pipeline-extracted border-pipeline-extracted/30",
  ai_enriched: "bg-pipeline-ai-enriched/15 text-pipeline-ai-enriched border-pipeline-ai-enriched/30",
  indexed: "bg-pipeline-indexed/15 text-pipeline-indexed border-pipeline-indexed/30",
};

const errorStyle = "bg-destructive/15 text-destructive border-destructive/30";

interface PipelineBadgeProps {
  status: PipelineStatus;
  error?: PipelineError;
  className?: string;
}

export function PipelineBadge({ status, error, className }: PipelineBadgeProps) {
  const isProcessing = status !== "indexed" && !error;

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium font-mono",
        error ? errorStyle : statusStyles[status],
        className
      )}
    >
      {error && <AlertTriangle className="h-3 w-3" />}
      {!error && isProcessing && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {!error && !isProcessing && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />}
      {error ? `Failed: ${PIPELINE_LABELS[error.stage]}` : PIPELINE_LABELS[status]}
    </span>
  );

  if (error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium">Pipeline failed at {PIPELINE_LABELS[error.stage]}</p>
          <p className="text-muted-foreground mt-1">{error.message}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
