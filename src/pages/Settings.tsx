import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, DAEMON_URL, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "openai" | "ollama" | "none";

// Mirrors the actual daemon Settings schema (daemon/src/settings.ts).
// The daemon nests embeddings under `ai.embeddings`, not a top-level `embedding`.
interface DaemonSettings {
  ai: {
    provider: Provider;
    openai: { api_key: string; model: string };
    ollama: { base_url: string; model: string };
    embeddings: { provider: "openai" | "ollama"; model: string };
  };
  app: {
    autostart: boolean;
    theme: "light" | "dark" | "system";
    lock: { enabled: boolean; pin_hash: string };
  };
}

interface AiFormState {
  provider: Provider;
  openai: { api_key: string; model: string };
  ollama: { base_url: string; model: string };
}

interface EmbeddingsFormState {
  provider: "openai" | "ollama";
  model: string;
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const settingsKeys = {
  all: ["settings"] as const,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REDACTED = "***";

function isKeyRedacted(key: string) {
  return key === REDACTED;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Settings = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: settingsKeys.all,
    // Cast through unknown: the ApiSettings type in api.ts doesn't match the real
    // daemon schema. DaemonSettings is the authoritative shape.
    queryFn: () => getSettings() as unknown as Promise<{ data: DaemonSettings }>,
  });

  const [ai, setAi] = useState<AiFormState>({
    provider: "none",
    openai: { api_key: "", model: "gpt-4o-mini" },
    ollama: { base_url: "http://localhost:11434", model: "llama3" },
  });

  const [embeddings, setEmbeddings] = useState<EmbeddingsFormState>({
    provider: "openai",
    model: "text-embedding-3-small",
  });

  const [dirty, setDirty] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Sync server data into local form state once on load (and after save).
  useEffect(() => {
    if (!data?.data) return;
    const s = data.data;
    setAi({
      provider: s.ai.provider,
      openai: { api_key: s.ai.openai.api_key, model: s.ai.openai.model },
      ollama: { base_url: s.ai.ollama.base_url, model: s.ai.ollama.model },
    });
    setEmbeddings({ provider: s.ai.embeddings.provider, model: s.ai.embeddings.model });
    setDirty(false);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      // Build the patch. For API keys that are still showing the redacted
      // sentinel (user didn't touch them), omit the field entirely so the
      // daemon's deepMerge leaves the real stored key unchanged.
      const openaiPatch: { api_key?: string; model: string } = { model: ai.openai.model };
      if (!isKeyRedacted(ai.openai.api_key)) {
        openaiPatch.api_key = ai.openai.api_key;
      }

      const patch = {
        ai: {
          provider: ai.provider,
          openai: openaiPatch,
          ollama: { base_url: ai.ollama.base_url, model: ai.ollama.model },
          embeddings: { provider: embeddings.provider, model: embeddings.model },
        },
      };

      return updateSettings(patch as Parameters<typeof updateSettings>[0]);
    },
    onSuccess: () => {
      setDirty(false);
      setTestResult(null);
      qc.invalidateQueries({ queryKey: settingsKeys.all });
      toast.success("Settings saved");
    },
    onError: (err: Error) => {
      toast.error("Failed to save settings", { description: err.message });
    },
  });

  // Test connection uses the currently persisted settings on the daemon.
  // The button is disabled while dirty to prevent misleading results.
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${DAEMON_URL}/settings/test-ai`, { method: "POST" });
      let json: { ok: boolean; error?: string };
      if (res.ok || res.status === 400) {
        json = await res.json() as { ok: boolean; error?: string };
      } else {
        let detail = res.statusText;
        try {
          const body = await res.json() as { detail?: string };
          if (body.detail) detail = body.detail;
        } catch {}
        json = { ok: false, error: `Server returned ${res.status}: ${detail}` };
      }
      setTestResult(json);
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail ?? err.message : String(err);
      setTestResult({ ok: false, error: msg });
    } finally {
      setTesting(false);
    }
  };

  function updateAiProvider(provider: Provider) {
    setAi((prev) => ({ ...prev, provider }));
    setTestResult(null); // stale result no longer applies to new provider
    setDirty(true);
  }

  function updateAiOpenai(patch: Partial<AiFormState["openai"]>) {
    setAi((prev) => ({ ...prev, openai: { ...prev.openai, ...patch } }));
    setDirty(true);
  }

  function updateAiOllama(patch: Partial<AiFormState["ollama"]>) {
    setAi((prev) => ({ ...prev, ollama: { ...prev.ollama, ...patch } }));
    setDirty(true);
  }

  function updateEmbeddingsProvider(provider: "openai" | "ollama") {
    setEmbeddings((prev) => ({ ...prev, provider }));
    setDirty(true);
  }

  function updateEmbeddingsModel(model: string) {
    setEmbeddings((prev) => ({ ...prev, model }));
    setDirty(true);
  }

  const canSave = dirty && !isLoading && !isError && !saveMutation.isPending;
  const canTest = ai.provider !== "none" && !dirty && !testing;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </h1>
            {dirty && (
              <p className="text-xs text-amber-500 font-mono">Unsaved changes</p>
            )}
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave}
            size="sm"
          >
            {saveMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load settings:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* LLM Provider */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">LLM Provider</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Used for summarisation, tagging, and organisation suggestions.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Provider</Label>
                  <Select value={ai.provider} onValueChange={(v) => updateAiProvider(v as Provider)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {ai.provider === "openai" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        type="password"
                        value={ai.openai.api_key}
                        onChange={(e) => updateAiOpenai({ api_key: e.target.value })}
                        placeholder="sk-…"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model</Label>
                      <Input
                        value={ai.openai.model}
                        onChange={(e) => updateAiOpenai({ model: e.target.value })}
                        placeholder="gpt-4o-mini"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </>
                )}

                {ai.provider === "ollama" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Base URL</Label>
                      <Input
                        value={ai.ollama.base_url}
                        onChange={(e) => updateAiOllama({ base_url: e.target.value })}
                        placeholder="http://localhost:11434"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model</Label>
                      <Input
                        value={ai.ollama.model}
                        onChange={(e) => updateAiOllama({ model: e.target.value })}
                        placeholder="llama3"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </>
                )}

                {ai.provider !== "none" && (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={!canTest}
                      title={dirty ? "Save your changes first to test the current configuration" : undefined}
                    >
                      {testing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Test connection
                    </Button>
                    {testResult !== null && (
                      <span className="flex items-center gap-1.5 text-xs">
                        {testResult.ok ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-green-600">Connected</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                            <span className="text-destructive truncate max-w-xs">
                              {testResult.error ?? "Failed"}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="border-t" />

            {/* Embedding Provider */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Embedding Provider</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Used for semantic search and similarity features.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Provider</Label>
                  <Select
                    value={embeddings.provider}
                    onValueChange={(v) => updateEmbeddingsProvider(v as "openai" | "ollama")}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="ollama">Ollama</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Input
                    value={embeddings.model}
                    onChange={(e) => updateEmbeddingsModel(e.target.value)}
                    placeholder={
                      embeddings.provider === "openai"
                        ? "text-embedding-3-small"
                        : "nomic-embed-text"
                    }
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Settings;
