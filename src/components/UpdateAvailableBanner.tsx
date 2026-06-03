import { useNavigate } from "react-router-dom";
import { ArrowUpCircle, X } from "lucide-react";

interface UpdateAvailableBannerProps {
  /** The tag name of the available update (e.g. "v0.2.0"). */
  latestTag: string;
  /** The version string of the current app (e.g. "0.1.0-beta"). */
  currentVersion: string;
  /** Called when the user dismisses the banner. */
  onDismiss: () => void;
}

export function UpdateAvailableBanner({
  latestTag,
  currentVersion,
  onDismiss,
}: UpdateAvailableBannerProps) {
  const navigate = useNavigate();

  const handleNavigate = () => navigate("/settings");

  return (
    <div
      role="note"
      className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs px-4 py-2 mx-4 mt-3 rounded-md"
    >
      <ArrowUpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="flex-1">
        Little Imp {latestTag} is available (current: {currentVersion}) —{" "}
        <button
          onClick={handleNavigate}
          className="underline underline-offset-2 hover:no-underline font-medium dark:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:rounded"
        >
          View update
        </button>
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-70 hover:opacity-100 dark:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:rounded"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
