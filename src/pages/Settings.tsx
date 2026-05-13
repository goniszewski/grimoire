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
  Download,
  Upload,
  RotateCcw,
  Cloud,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useBackupList,
  useCreateBackup,
  useRestoreBackup,
  useRestoreRemoteBackup,
  useBackupListWithRemote,
  useTestS3Connection,
  useBackupSchedule,
  useUpdateBackupSchedule,
  useBackupDestination,
  useUpdateBackupDestination,
} from "@/hooks/use-backup";
import type {
  ApiAiProvider,
  ApiBackupEntry,
  ApiEmbeddingProvider,
  ApiRestoreResult,
  ApiS3Config,
  ApiSettingsPatch,
} from "@/lib/api";
import { Switch } from "@/components/ui/switch";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = ApiAiProvider;

interface AiFormState {
  provider: Provider;
  openai: { api_key: string; model: string };
  ollama: { base_url: string; model: string };
}

interface EmbeddingsFormState {
  provider: ApiEmbeddingProvider;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function restoreSuccessDescription(result: ApiRestoreResult): string {
  return result.rollback_path
    ? `Restart the daemon before using Little Imp again. Rollback: ${result.rollback_path}`
    : "Restart the daemon before using Little Imp again.";
}

const Settings = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: settingsKeys.all,
    queryFn: getSettings,
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

  // ─── Backup & Restore ────────────────────────────────────────────────────────
  const backupList = useBackupList();
  const createBackupMutation = useCreateBackup();
  const restoreMutation = useRestoreBackup();
  const restoreRemoteMutation = useRestoreRemoteBackup();
  // Separate state for the manual-path input — keeps it independent from list-row actions.
  const [manualRestoreName, setManualRestoreName] = useState<string>("");

  // ─── S3 Remote Backup ────────────────────────────────────────────────────────
  const [showRemote, setShowRemote] = useState(false);
  const [s3Form, setS3Form] = useState<ApiS3Config>({
    endpoint: "",
    bucket: "",
    access_key: "",
    secret_key: "",
    region: "us-east-1",
    prefix: "little-imp-backups/",
  });
  const remoteBackupList = useBackupListWithRemote(showRemote && !!s3Form.bucket);
  const testS3Mutation = useTestS3Connection();
  const [s3Dirty, setS3Dirty] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  // ─── Backup destination ───────────────────────────────────────────────────────
  const destinationQuery = useBackupDestination();
  const updateDestinationMutation = useUpdateBackupDestination();
  const [destinationPath, setDestinationPath] = useState("");
  const [destinationDirty, setDestinationDirty] = useState(false);

  useEffect(() => {
    if (!destinationQuery.data || destinationDirty) return;
    setDestinationPath(destinationQuery.data.is_custom ? destinationQuery.data.path : "");
  }, [destinationQuery.data, destinationDirty]);

  // ─── Backup schedule ──────────────────────────────────────────────────────────
  const scheduleQuery = useBackupSchedule();
  const updateScheduleMutation = useUpdateBackupSchedule();
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleCron, setScheduleCron] = useState("0 3 * * *");
  const [scheduleRetention, setScheduleRetention] = useState(7);
  const [scheduleDirty, setScheduleDirty] = useState(false);

  useEffect(() => {
    if (!scheduleQuery.data) return;
    setScheduleEnabled(scheduleQuery.data.enabled);
    setScheduleCron(scheduleQuery.data.cron);
    setScheduleRetention(scheduleQuery.data.retention_count);
    setScheduleDirty(false);
  }, [scheduleQuery.data]);

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

    // Populate S3 form from settings (credentials will be redacted "***")
    if (s.backup.s3) {
      setS3Form((prev) => ({
        ...prev,
        ...s.backup.s3,
        // Keep local password inputs blank when redacted so users re-enter intentionally
        access_key: s.backup.s3.access_key === "***" ? "" : (s.backup.s3.access_key ?? ""),
        secret_key: s.backup.s3.secret_key === "***" ? "" : (s.backup.s3.secret_key ?? ""),
      }));
    }
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

      return updateSettings(patch);
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
        } catch {
          // Keep the HTTP status text fallback when the error body is not JSON.
        }
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

  function updateEmbeddingsProvider(provider: ApiEmbeddingProvider) {
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
                    onValueChange={(v) => updateEmbeddingsProvider(v as ApiEmbeddingProvider)}
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

            <div className="border-t" />

            {/* Backup & Restore */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Backup &amp; Restore</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a local snapshot of your library or restore from a previous backup.
                </p>
              </div>

              <div className="space-y-3">
                {/* Create backup */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      createBackupMutation.mutate(undefined, {
                        onSuccess: (result) => {
                          toast.success("Backup created", {
                            description: `${formatBytes(result.size_bytes)} · ${result.bookmark_count} bookmarks`,
                          });
                        },
                        onError: (err: Error) => {
                          toast.error("Backup failed", { description: err.message });
                        },
                      })
                    }
                    disabled={createBackupMutation.isPending}
                  >
                    {createBackupMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Create backup now
                  </Button>
                </div>

                {/* Backup list — each row's dialog closes over entry.name to avoid shared-state race */}
                {backupList.data && backupList.data.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Recent backups</p>
                    <ul className="space-y-1">
                      {backupList.data.map((entry: ApiBackupEntry) => (
                        <li
                          key={entry.name}
                          className="flex items-center justify-between text-xs rounded border px-3 py-2 bg-muted/30"
                        >
                          <span className="font-mono truncate max-w-xs" title={entry.name}>
                            {entry.name}
                          </span>
                          <span className="text-muted-foreground ml-3 shrink-0">
                            {formatBytes(entry.size_bytes)} · {entry.bookmark_count} bookmarks
                          </span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                                title="Restore this backup"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Restore backup?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This verifies checksums, creates a rollback copy, preserves
                                  local secrets, and replaces your current library with{" "}
                                  <strong>{entry.name}</strong>. The daemon must be restarted
                                  after restoring.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                {/* onClick closes over entry.name — not shared state */}
                                <AlertDialogAction
                                  onClick={() => {
                                    restoreMutation.mutate(entry.name, {
                                      onSuccess: (result) => {
                                        toast.success("Restore complete", {
                                          description: restoreSuccessDescription(result),
                                        });
                                      },
                                      onError: (err: Error) => {
                                        toast.error("Restore failed", { description: err.message });
                                      },
                                    });
                                  }}
                                >
                                  Restore
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Restore by name — separate state from the list above */}
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Restore by name</p>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="2026-03-14T07-45-04-815Z"
                      className="h-8 text-sm font-mono"
                      value={manualRestoreName}
                      onChange={(e) => setManualRestoreName(e.target.value)}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!manualRestoreName || restoreMutation.isPending}
                        >
                          {restoreMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Restore
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore backup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This verifies checksums, creates a rollback copy, preserves local
                            secrets, and replaces your current library with the snapshot{" "}
                            <strong className="font-mono break-all">{manualRestoreName}</strong>.
                            The daemon must be restarted after restoring.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              restoreMutation.mutate(manualRestoreName, {
                                onSuccess: (result) => {
                                  toast.success("Restore complete", {
                                    description: restoreSuccessDescription(result),
                                  });
                                  setManualRestoreName("");
                                },
                                onError: (err: Error) => {
                                  toast.error("Restore failed", { description: err.message });
                                },
                              });
                            }}
                          >
                            Restore
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </section>

            <div className="border-t" />

            {/* Backup Destination */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Backup Folder</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose where local backups are saved. Point to a cloud-synced folder (iCloud Drive,
                  Dropbox, Google Drive…) for automatic offsite copies — no API keys needed.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Backup path</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={destinationPath}
                      onChange={(e) => {
                        setDestinationPath(e.target.value);
                        setDestinationDirty(true);
                      }}
                      placeholder={destinationQuery.data?.is_custom ? "" : destinationQuery.data?.path ?? "~/.local/share/littleimp/backups"}
                      className="h-8 text-sm font-mono"
                    />
                    {/* Directory picker — webkitdirectory lets users choose a folder */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Browse for folder"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.webkitdirectory = true;
                        input.addEventListener("change", () => {
                          const file = input.files?.[0];
                          if (file) {
                            // webkitRelativePath gives "folder/..." — extract base path from the first file
                            const parts = file.webkitRelativePath.split("/");
                            // We only have the relative path from the picker; use the name as a hint.
                            // Browsers don't expose the absolute path for security reasons.
                            // Show the folder name so the user can confirm then type the full path.
                            setDestinationPath(parts[0] ?? "");
                            setDestinationDirty(true);
                            toast.info("Folder selected", {
                              description: "Browsers can't provide the full path. Please verify or complete the absolute path in the field above.",
                            });
                          }
                        });
                        input.click();
                      }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the default location.{" "}
                    {destinationQuery.data && (
                      <>
                        Currently: <span className="font-mono">{destinationQuery.data.path}</span>
                        {destinationQuery.data.writable ? (
                          <CheckCircle2 className="inline h-3 w-3 ml-1 text-green-500" />
                        ) : (
                          <XCircle className="inline h-3 w-3 ml-1 text-destructive" />
                        )}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!destinationDirty || updateDestinationMutation.isPending}
                    onClick={() => {
                      updateDestinationMutation.mutate(destinationPath, {
                        onSuccess: (result) => {
                          setDestinationDirty(false);
                          if (result.data.is_custom) {
                            toast.success("Backup folder saved", { description: result.data.path });
                          } else {
                            toast.success("Backup folder reset to default");
                          }
                        },
                        onError: (err: Error) => {
                          toast.error("Failed to set backup folder", { description: err.message });
                        },
                      });
                    }}
                  >
                    {updateDestinationMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    )}
                    Save folder
                  </Button>
                  {destinationPath && destinationDirty && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setDestinationPath("");
                        setDestinationDirty(true);
                      }}
                    >
                      Reset to default
                    </Button>
                  )}
                  {destinationDirty && (
                    <span className="text-xs text-amber-500 font-mono">Unsaved</span>
                  )}
                </div>
              </div>
            </section>

            <div className="border-t" />

            {/* Remote Backup (S3) */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Remote Backup (S3)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Upload backups to an S3-compatible storage target (AWS S3, Cloudflare R2, MinIO, etc.).
                </p>
              </div>

              <div className="space-y-3">
                {/* S3 config fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Bucket</Label>
                    <Input
                      value={s3Form.bucket}
                      onChange={(e) => { setS3Form((f) => ({ ...f, bucket: e.target.value })); setS3Dirty(true); }}
                      placeholder="my-backup-bucket"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Region</Label>
                    <Input
                      value={s3Form.region}
                      onChange={(e) => { setS3Form((f) => ({ ...f, region: e.target.value })); setS3Dirty(true); }}
                      placeholder="us-east-1"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Access Key</Label>
                    <Input
                      value={s3Form.access_key}
                      onChange={(e) => { setS3Form((f) => ({ ...f, access_key: e.target.value })); setS3Dirty(true); }}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Secret Key</Label>
                    <Input
                      type="password"
                      value={s3Form.secret_key}
                      onChange={(e) => { setS3Form((f) => ({ ...f, secret_key: e.target.value })); setS3Dirty(true); }}
                      placeholder="••••••••••••••••••••"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Endpoint URL <span className="text-muted-foreground">(optional — for R2/MinIO)</span></Label>
                    <Input
                      value={s3Form.endpoint}
                      onChange={(e) => { setS3Form((f) => ({ ...f, endpoint: e.target.value })); setS3Dirty(true); }}
                      placeholder="https://your-account.r2.cloudflarestorage.com"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Key Prefix</Label>
                    <Input
                      value={s3Form.prefix}
                      onChange={(e) => { setS3Form((f) => ({ ...f, prefix: e.target.value })); setS3Dirty(true); }}
                      placeholder="little-imp-backups/"
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!s3Dirty || !s3Form.bucket}
                    onClick={() => {
                      // Omit blank credential fields so we don't overwrite stored secrets
                      // when the user edits non-credential fields (access_key/secret_key are
                      // cleared to "" when the server returns them as redacted "***").
                      const patch: NonNullable<NonNullable<ApiSettingsPatch["backup"]>["s3"]> = {
                        endpoint: s3Form.endpoint,
                        bucket: s3Form.bucket,
                        region: s3Form.region,
                        prefix: s3Form.prefix,
                        ...(s3Form.access_key ? { access_key: s3Form.access_key } : {}),
                        ...(s3Form.secret_key ? { secret_key: s3Form.secret_key } : {}),
                      };
                      updateSettings({ backup: { s3: patch } }).then(() => {
                        setS3Dirty(false);
                        toast.success("S3 settings saved");
                        qc.invalidateQueries({ queryKey: settingsKeys.all });
                      }).catch((err: Error) => {
                        toast.error("Failed to save S3 settings", { description: err.message });
                      });
                    }}
                  >
                    Save S3 settings
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testS3Mutation.isPending || !s3Form.bucket}
                    onClick={() => {
                      setS3TestResult(null);
                      testS3Mutation.mutate(undefined, {
                        onSuccess: (r) => {
                          setS3TestResult(r);
                          toast.success("S3 connection successful");
                        },
                        onError: (err: Error) => {
                          setS3TestResult({ ok: false, message: err.message });
                          toast.error("S3 connection failed", { description: err.message });
                        },
                      });
                    }}
                  >
                    {testS3Mutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Test connection
                  </Button>

                  {s3TestResult && (
                    <span className={`text-xs font-mono ${s3TestResult.ok ? "text-green-500" : "text-destructive"}`}>
                      {s3TestResult.ok ? "Connected" : s3TestResult.message ?? s3TestResult.error}
                    </span>
                  )}
                </div>

                {/* Remote backup list toggle */}
                {s3Form.bucket && (
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setShowRemote((v) => !v)}
                    >
                      <Cloud className="h-3 w-3 mr-1.5" />
                      {showRemote ? "Hide remote backups" : "Show remote backups"}
                    </Button>

                    {showRemote && (
                      <div className="space-y-1">
                        {remoteBackupList.isLoading && (
                          <p className="text-xs text-muted-foreground">Loading…</p>
                        )}
                        {remoteBackupList.data && remoteBackupList.data.filter((e) => e.source === "remote").length === 0 && (
                          <p className="text-xs text-muted-foreground">No remote backups found.</p>
                        )}
                        {remoteBackupList.data && (
                          <ul className="space-y-1">
                            {remoteBackupList.data
                              .filter((e) => e.source === "remote")
                              .map((entry: ApiBackupEntry) => (
                                <li
                                  key={entry.name}
                                  className="flex items-center justify-between text-xs rounded border px-3 py-2 bg-muted/30"
                                >
                                  <Cloud className="h-3 w-3 text-muted-foreground mr-2 shrink-0" />
                                  <span className="font-mono truncate flex-1" title={entry.name}>
                                    {entry.name}
                                  </span>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" title="Restore from remote">
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Restore from remote?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This downloads the backup, verifies checksums, creates a
                                          rollback copy, preserves local secrets, and restores{" "}
                                          <strong className="font-mono break-all">{entry.name}</strong>.
                                          The daemon must be restarted after restoring.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => {
                                            restoreRemoteMutation.mutate(entry.name, {
                                              onSuccess: (result) => {
                                                toast.success("Remote restore complete", {
                                                  description: restoreSuccessDescription(result),
                                                });
                                              },
                                              onError: (err: Error) => {
                                                toast.error("Restore failed", { description: err.message });
                                              },
                                            });
                                          }}
                                        >
                                          Restore
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="border-t" />

            {/* Backup Schedule */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Automatic Snapshots</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create backups on a schedule and automatically remove old snapshots.
                </p>
              </div>

              {scheduleQuery.isLoading ? (
                <div className="text-xs text-muted-foreground">Loading…</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="schedule-enabled"
                      checked={scheduleEnabled}
                      onCheckedChange={(v) => {
                        setScheduleEnabled(v);
                        setScheduleDirty(true);
                      }}
                    />
                    <Label htmlFor="schedule-enabled" className="text-sm cursor-pointer">
                      Enable automatic daily snapshots
                    </Label>
                  </div>

                  {scheduleEnabled && (
                    <div className="space-y-3 pl-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Schedule (cron expression)</Label>
                        <Input
                          value={scheduleCron}
                          onChange={(e) => {
                            setScheduleCron(e.target.value);
                            setScheduleDirty(true);
                          }}
                          placeholder="0 3 * * *"
                          className="h-8 text-sm font-mono max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                          5-part cron: minute hour dom month dow. Default runs daily at 3 AM.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Backups to keep</Label>
                        <Input
                          type="number"
                          min={1}
                          value={scheduleRetention}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (n >= 1) {
                              setScheduleRetention(n);
                              setScheduleDirty(true);
                            }
                          }}
                          className="h-8 text-sm font-mono max-w-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Older snapshots beyond this count are deleted automatically.
                        </p>
                      </div>

                      {scheduleQuery.data?.next_run_at && (
                        <p className="text-xs text-muted-foreground">
                          Next backup:{" "}
                          <span className="font-mono">
                            {new Date(scheduleQuery.data.next_run_at).toLocaleString()}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!scheduleDirty || updateScheduleMutation.isPending}
                      onClick={() => {
                        const cronParts = scheduleCron.trim().split(/\s+/);
                        if (scheduleEnabled && cronParts.length !== 5) {
                          toast.error("Invalid cron expression", {
                            description: "Must be a 5-part cron (e.g. \"0 3 * * *\")",
                          });
                          return;
                        }
                        updateScheduleMutation.mutate(
                          { enabled: scheduleEnabled, cron: scheduleCron, retention_count: scheduleRetention },
                          {
                            onSuccess: () => {
                              setScheduleDirty(false);
                              toast.success("Schedule saved");
                            },
                            onError: (err: Error) => {
                              toast.error("Failed to save schedule", { description: err.message });
                            },
                          }
                        );
                      }}
                    >
                      {updateScheduleMutation.isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      )}
                      Save schedule
                    </Button>
                    {scheduleDirty && (
                      <span className="text-xs text-amber-500 font-mono">Unsaved</span>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Settings;
