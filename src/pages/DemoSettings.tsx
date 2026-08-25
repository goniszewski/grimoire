import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, LockKeyhole, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSettings } from "@/lib/api";
import { DEMO_INSTALL_URL } from "@/demo/enabled";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  ["Keyword search", true],
  ["Library filters and sorting", true],
  ["Session-scoped bookmark edits", true],
  ["AI enrichment", false],
  ["Semantic and hybrid search", false],
  ["Backups and cloud storage", false],
  ["Browser integration tokens", false],
] as const;

export default function DemoSettings() {
  const navigate = useNavigate();
  const settingsQuery = useQuery({
    queryKey: ["demo-settings"],
    queryFn: getSettings,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen w-full">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/")}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <h1 className="text-sm font-semibold">Demo settings</h1>
          <Badge variant="secondary" className="text-[10px]">Read-only</Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-8">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="mb-1 text-xs font-mono uppercase tracking-wide text-primary">Public demo profile</p>
          <h2 className="text-xl font-semibold">Explore the real interface without a daemon</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            This browser tab uses synthetic data and an in-memory API. Nothing here is an account, hosted library, or sync service.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" className="gap-1.5">
              <a href={DEMO_INSTALL_URL} target="_blank" rel="noreferrer">
                Install Grimoire <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>Continue exploring</Button>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Available in this demo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {settingsQuery.isLoading ? "Reading the demo capability profile…" : "Capabilities are intentionally limited to local-safe exploration."}
              </p>
            </div>
            <Badge variant="outline">No provider configured</Badge>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map(([label, enabled]) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border bg-background/50 px-3 py-2.5 text-sm">
                {enabled ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                <span className={enabled ? "" : "text-muted-foreground"}>{label}</span>
              </div>
            ))}
          </div>
          {settingsQuery.data?.data.runtime.capabilities && (
            <p className="mt-4 text-xs text-muted-foreground">
              AI, embeddings, related bookmarks, and organization-agent capabilities are disabled in the fixture profile.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-dashed bg-muted/30 p-5">
          <div className="flex gap-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">App Lock is disabled</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The demo never stores a lock hash, so a visitor cannot accidentally lock themselves out. Install Grimoire to use local privacy controls.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
