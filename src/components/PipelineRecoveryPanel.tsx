import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, RotateCcw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  dismissBookmarkFailure,
  getBookmarkStatus,
  retryBookmarkPipeline,
} from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { bookmarkKeys } from "@/hooks/use-bookmarks";
import { PIPELINE_FAILURE_LABELS } from "@/lib/pipeline-labels";

interface PipelineRecoveryPanelProps {
  bookmarkId: string;
}

export function PipelineRecoveryPanel({ bookmarkId }: PipelineRecoveryPanelProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["pipeline-status", bookmarkId],
    queryFn: async () => {
      const res = await getBookmarkStatus(bookmarkId);
      return res.data;
    },
    enabled: !!bookmarkId,
    retry: false,
  });

  const retryMutation = useMutation({
    mutationFn: () => retryBookmarkPipeline(bookmarkId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["pipeline-status", bookmarkId] });
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      toast.success("Retry queued", {
        description: `${result.data.enqueued} job${result.data.enqueued === 1 ? "" : "s"} queued`,
      });
    },
    onError: (err: Error) => {
      toast.error("Retry failed", { description: err.message });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismissBookmarkFailure(bookmarkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-status", bookmarkId] });
      qc.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
    onError: (err: Error) => {
      toast.error("Dismiss failed", { description: err.message });
    },
  });

  const jobStatus = statusQuery.data?.job?.status;
  const hasActiveJob = jobStatus === "pending" || jobStatus === "running";
  const isBlockingFailure = jobStatus === "failed";
  const failure = hasActiveJob ? null : statusQuery.data?.last_failure;
  if (!failure) return null;

  const label = PIPELINE_FAILURE_LABELS[failure.stage];

  return (
    <Alert variant="destructive" className="py-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{label} failed</p>
          <p className="text-xs leading-relaxed text-destructive/90">{failure.message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {failure.retryable && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={retryMutation.isPending}
              onClick={() => retryMutation.mutate()}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          {failure.configuration_related && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => navigate("/settings")}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Button>
          )}
          {!isBlockingFailure && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={dismissMutation.isPending}
              onClick={() => dismissMutation.mutate()}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
