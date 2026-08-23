import { useEffect } from "react";
import { ExternalLink, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEMO_INSTALL_URL } from "@/demo/enabled";
import { clearDemoLocalState } from "@/demo/reset";

export function DemoModeBanner({ onReset }: { onReset?: () => void }) {
  useEffect(() => {
    document.title = "Grimoire Demo";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute(
      "content",
      "Explore the Grimoire local-first knowledge index with synthetic demo data."
    );
  }, []);

  const handleReset = async () => {
    const { resetDemoState } = await import("@/demo/api/state");
    resetDemoState();
    clearDemoLocalState();
    onReset?.();
    if (!onReset) window.location.reload();
  };

  return (
    <div data-testid="demo-mode-banner" className="relative z-50 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-primary/20 bg-primary/10 px-4 py-2 text-xs text-foreground md:pl-[17rem]">
      <div data-testid="demo-mode-banner-content" className="flex min-w-0 flex-1 items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          <strong>Public demo</strong> — sample data lives only in this browser tab. Install Grimoire to keep a private local library.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button asChild size="sm" className="h-7 gap-1.5 px-2.5 text-xs">
          <a href={DEMO_INSTALL_URL} target="_blank" rel="noreferrer">
            Install <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2.5 text-xs" onClick={handleReset}>
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset demo
        </Button>
      </div>
    </div>
  );
}
