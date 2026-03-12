import { WifiOff } from "lucide-react";

interface DaemonOfflineBannerProps {
  online: boolean;
  loading?: boolean;
}

export function DaemonOfflineBanner({ online, loading }: DaemonOfflineBannerProps) {
  if (online || loading) return null;
  return (
    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-xs px-4 py-2 rounded-md mx-4 mt-3">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        Daemon offline — changes won't be saved.{" "}
        <span className="font-mono">little-imp daemon start</span> to reconnect.
      </span>
    </div>
  );
}
