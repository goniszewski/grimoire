import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Info, X } from "lucide-react";

const STORAGE_KEY = "degraded_banner_dismissed";

interface DegradedModeBannerProps {
  aiEnabled: boolean;
}

export function DegradedModeBanner({ aiEnabled }: DegradedModeBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  // Clear dismiss flag when AI becomes enabled so the banner re-appears if AI is later disabled again.
  useEffect(() => {
    if (aiEnabled) {
      localStorage.removeItem(STORAGE_KEY);
      setDismissed(false);
    }
  }, [aiEnabled]);

  if (aiEnabled || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  const handleNavigate = () => navigate("/settings");

  return (
    <div
      role="note"
      className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs px-4 py-2 mx-4 mt-3 rounded-md"
    >
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="flex-1">
        AI enrichment is disabled. Keyword search works —{" "}
        <button
          onClick={handleNavigate}
          className="underline underline-offset-2 hover:no-underline font-medium dark:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded"
        >
          configure an AI provider in Settings
        </button>{" "}
        to enable summaries, tags, and semantic search.
      </span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-70 hover:opacity-100 dark:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:rounded"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
