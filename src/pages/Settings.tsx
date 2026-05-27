import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  checkForUpdates,
  checkHealthAfterRestore,
  getReprocessStatus,
  getSettings,
  reprocessBookmarks,
  updateSettings,
  DAEMON_URL,
  ApiError,
} from "@/lib/api";
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
  ShieldCheck,
  LockKeyhole,
  RefreshCw,
  ExternalLink,
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
  useVerifyBackup,
  useBackupListWithRemote,
  useTestS3Connection,
  useBackupSchedule,
  useUpdateBackupSchedule,
  useBackupDestination,
  useUpdateBackupDestination,
  useCreateEncryptedBackupPackage,
  useVerifyEncryptedBackupPackage,
  useRestoreEncryptedBackupPackage,
} from "@/hooks/use-backup";
import type {
  ApiAiProvider,
  ApiBackupEntry,
  ApiEmbeddingProvider,
  ApiEncryptedBackupPackageResult,
  ApiReprocessBatch,
  ApiReprocessRequest,
  ApiRestoreResult,
  ApiS3Config,
  ApiSettings,
  ApiSettingsPatch,
  ApiUpdateCheckResult,
} from "@/lib/api";
import { Switch } from "@/components/ui/switch";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = ApiAiProvider;
type ApiKeyProvider = "anthropic" | "openrouter" | "openai_compatible" | "deepseek";

interface ApiKeyProviderFormState {
  api_key: string;
  base_url: string;
  model: string;
}

interface AiFormState {
  provider: Provider;
  openai: { api_key: string; model: string };
  ollama: { base_url: string; model: string };
  anthropic: ApiKeyProviderFormState;
  openrouter: ApiKeyProviderFormState;
  openai_compatible: ApiKeyProviderFormState;
  deepseek: ApiKeyProviderFormState;
}

interface EmbeddingsFormState {
  provider: ApiEmbeddingProvider;
  model: string;
  openai_compatible: ApiKeyProviderFormState;
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

function secretProviderPatch(provider: ApiKeyProviderFormState) {
  const patch: { api_key?: string; base_url: string; model: string } = {
    base_url: provider.base_url,
    model: provider.model,
  };
  if (!isKeyRedacted(provider.api_key)) {
    patch.api_key = provider.api_key;
  }
  return patch;
}

const apiKeyProviderMeta: Record<ApiKeyProvider, {
  apiKeyPlaceholder: string;
  baseUrlPlaceholder: string;
  modelPlaceholder: string;
}> = {
  anthropic: {
    apiKeyPlaceholder: "sk-ant-...",
    baseUrlPlaceholder: "https://api.anthropic.com",
    modelPlaceholder: "claude-sonnet-4-6",
  },
  openrouter: {
    apiKeyPlaceholder: "sk-or-...",
    baseUrlPlaceholder: "https://openrouter.ai/api/v1",
    modelPlaceholder: "~openai/gpt-latest",
  },
  openai_compatible: {
    apiKeyPlaceholder: "optional",
    baseUrlPlaceholder: "http://localhost:8000/v1",
    modelPlaceholder: "custom-chat-model",
  },
  deepseek: {
    apiKeyPlaceholder: "sk-...",
    baseUrlPlaceholder: "https://api.deepseek.com",
    modelPlaceholder: "deepseek-v4-flash",
  },
};

function defaultAiFormState(): AiFormState {
  return {
    provider: "none",
    openai: { api_key: "", model: "gpt-4o-mini" },
    ollama: { base_url: "http://localhost:11434", model: "llama3" },
    anthropic: {
      api_key: "",
      base_url: "https://api.anthropic.com",
      model: "claude-sonnet-4-6",
    },
    openrouter: {
      api_key: "",
      base_url: "https://openrouter.ai/api/v1",
      model: "~openai/gpt-latest",
    },
    openai_compatible: {
      api_key: "",
      base_url: "http://localhost:8000/v1",
      model: "custom-chat-model",
    },
    deepseek: {
      api_key: "",
      base_url: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    },
  };
}

function defaultEmbeddingsFormState(): EmbeddingsFormState {
  return {
    provider: "openai",
    model: "text-embedding-3-small",
    openai_compatible: {
      api_key: "",
      base_url: "http://localhost:8000/v1",
      model: "custom-embedding-model",
    },
  };
}

function mergeApiKeyProvider(
  defaults: ApiKeyProviderFormState,
  settings: Partial<ApiKeyProviderFormState> | undefined
): ApiKeyProviderFormState {
  return { ...defaults, ...settings };
}

function aiFormStateFromSettings(settings: Partial<ApiSettings["ai"]> | undefined): AiFormState {
  const defaults = defaultAiFormState();
  return {
    ...defaults,
    provider: settings?.provider ?? defaults.provider,
    openai: { ...defaults.openai, ...(settings?.openai as Partial<AiFormState["openai"]> | undefined) },
    ollama: { ...defaults.ollama, ...(settings?.ollama as Partial<AiFormState["ollama"]> | undefined) },
    anthropic: mergeApiKeyProvider(defaults.anthropic, settings?.anthropic),
    openrouter: mergeApiKeyProvider(defaults.openrouter, settings?.openrouter),
    openai_compatible: mergeApiKeyProvider(defaults.openai_compatible, settings?.openai_compatible),
    deepseek: mergeApiKeyProvider(defaults.deepseek, settings?.deepseek),
  };
}

function embeddingsFormStateFromSettings(
  settings: Partial<ApiSettings["ai"]["embeddings"]> | undefined
): EmbeddingsFormState {
  const defaults = defaultEmbeddingsFormState();
  return {
    ...defaults,
    provider: settings?.provider ?? defaults.provider,
    model: settings?.model ?? defaults.model,
    openai_compatible: mergeApiKeyProvider(defaults.openai_compatible, settings?.openai_compatible),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function restoreSuccessDescription(result: ApiRestoreResult): string {
  return `Restart before using Little Imp again: ${result.restart_command}`;
}

function updateCheckMessage(result: ApiUpdateCheckResult): string {
  if (result.update_available) {
    return `${result.latest?.tag ?? result.latest?.version ?? "A newer release"} is available`;
  }
  return `Little Imp ${result.current_version} is up to date`;
}

function encryptedPackageDescription(result: ApiEncryptedBackupPackageResult): string {
  return `${formatBytes(result.size_bytes)} · ${result.path}`;
}

function reprocessQueuedDescription(result: ApiReprocessBatch): string {
  const skipped = result.skipped > 0 ? ` · ${result.skipped} skipped` : "";
  return `${result.enqueued} jobs queued${skipped}`;
}

const RESTORE_RECOVERY_STORAGE_KEY = "littleimp.restoreRecovery";

function readStoredRestoreRecovery(): ApiRestoreResult | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(RESTORE_RECOVERY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ApiRestoreResult;
    if (
      typeof parsed.restored_at === "string" &&
      typeof parsed.bookmark_count === "number" &&
      typeof parsed.checksum_verified === "boolean" &&
      typeof parsed.rollback_path === "string" &&
      parsed.restart_required === true &&
      typeof parsed.restart_command === "string" &&
      typeof parsed.health_url === "string" &&
      Array.isArray(parsed.rollback_instructions)
    ) {
      return parsed;
    }
    window.localStorage.removeItem(RESTORE_RECOVERY_STORAGE_KEY);
  } catch {
    window.localStorage.removeItem(RESTORE_RECOVERY_STORAGE_KEY);
  }
  return null;
}

interface RestoreRecoveryDialogProps {
  result: ApiRestoreResult;
  healthy: boolean;
  checking: boolean;
  onCheckNow: () => void;
  onContinue: () => void;
}

function RestoreRecoveryDialog({
  result,
  healthy,
  checking,
  onCheckNow,
  onContinue,
}: RestoreRecoveryDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm px-4 py-6 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-recovery-title"
        className="mx-auto max-w-2xl rounded border bg-background shadow-lg"
      >
        <div className="border-b px-5 py-4 space-y-1">
          <h2 id="restore-recovery-title" className="text-base font-semibold">
            Restart Little Imp
          </h2>
          <p className="text-xs text-muted-foreground">
            Restore finished, but the current daemon process must be restarted before the restored
            database is usable.
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <Alert variant={healthy ? "default" : "destructive"}>
            {healthy ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {healthy
                ? "Daemon health is back. The restored app is ready to use."
                : `Waiting for ${result.health_url} to become healthy after restart.`}
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label className="text-xs">Restart command</Label>
            <pre className="whitespace-pre-wrap break-all rounded bg-muted px-3 py-2 text-xs font-mono">
              {result.restart_command}
            </pre>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Health check</Label>
              <code className="block rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {result.health_url}
              </code>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rollback path</Label>
              <code className="block rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {result.rollback_path}
              </code>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Rollback instructions</Label>
            <ul className="space-y-1 rounded border bg-muted/30 px-3 py-2 text-xs">
              {result.rollback_instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" size="sm" onClick={onCheckNow} disabled={checking}>
            {checking && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Check now
          </Button>
          <Button size="sm" onClick={onContinue} disabled={!healthy}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

interface EncryptedPackageActionProps {
  entry: ApiBackupEntry;
  disabled: boolean;
  active: boolean;
  onCreate: (name: string, password: string) => void;
}

function EncryptedPackageAction({
  entry,
  disabled,
  active,
  onCreate,
}: EncryptedPackageActionProps) {
  const [password, setPassword] = useState("");
  const passwordInputId = `encrypted-package-password-${entry.name}`;

  return (
    <AlertDialog onOpenChange={(open) => {
      if (!open) setPassword("");
    }}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-2"
          title="Create encrypted package"
          disabled={disabled}
        >
          {active ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <LockKeyhole className="h-3 w-3" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create encrypted package?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates an encrypted package file beside{" "}
            <strong className="font-mono break-all">{entry.name}</strong>. Keep the password safe:
            it is required to verify or restore the package.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={passwordInputId} className="text-xs">Package password</Label>
          <Input
            id={passwordInputId}
            type="password"
            autoComplete="new-password"
            className="h-8 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!password || disabled}
            onClick={() => onCreate(entry.name, password)}
          >
            Create package
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const Settings = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: settingsKeys.all,
    queryFn: getSettings,
  });

  const [ai, setAi] = useState<AiFormState>(() => defaultAiFormState());

  const [embeddings, setEmbeddings] = useState<EmbeddingsFormState>(() => defaultEmbeddingsFormState());

  const [dirty, setDirty] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // ─── Updates ────────────────────────────────────────────────────────────────
  const updateCheckMutation = useMutation({
    mutationFn: () => checkForUpdates(),
    onError: (err: Error) => {
      toast.error("Update check failed", { description: err.message });
    },
  });
  const updateCheckResult = updateCheckMutation.data?.data ?? null;

  // ─── Library maintenance / reprocessing ───────────────────────────────────
  const [replaceAiFields, setReplaceAiFields] = useState(false);
  const [reprocessBatch, setReprocessBatch] = useState<ApiReprocessBatch | null>(null);
  const reprocessMutation = useMutation({
    mutationFn: (mode: ApiReprocessRequest["mode"]) =>
      reprocessBookmarks({ mode, replace_ai_fields: replaceAiFields }),
    onSuccess: (result) => {
      setReprocessBatch(result.data);
      if (result.data.status_url) {
        qc.invalidateQueries({ queryKey: ["reprocess", result.data.batch_id] });
      }
      toast.success("Reprocess queued", { description: reprocessQueuedDescription(result.data) });
    },
    onError: (err: Error) => {
      toast.error("Reprocess failed", { description: err.message });
    },
  });
  const reprocessStatusQuery = useQuery({
    queryKey: ["reprocess", reprocessBatch?.batch_id],
    queryFn: () => getReprocessStatus(reprocessBatch!.batch_id),
    enabled: !!reprocessBatch?.status_url,
    refetchInterval: (query) => {
      const status = query.state.data?.data;
      if (!status) return 2_000;
      return status.pending + status.running > 0 ? 2_000 : false;
    },
  });
  const reprocessStatus = reprocessStatusQuery.data?.data ?? null;

  // ─── Backup & Restore ────────────────────────────────────────────────────────
  const backupList = useBackupList();
  const createBackupMutation = useCreateBackup();
  const restoreMutation = useRestoreBackup();
  const restoreRemoteMutation = useRestoreRemoteBackup();
  const verifyBackupMutation = useVerifyBackup();
  const createEncryptedPackageMutation = useCreateEncryptedBackupPackage();
  const verifyEncryptedPackageMutation = useVerifyEncryptedBackupPackage();
  const restoreEncryptedPackageMutation = useRestoreEncryptedBackupPackage();
  const [verifyingBackupName, setVerifyingBackupName] = useState<string | null>(null);
  const [encryptingBackupName, setEncryptingBackupName] = useState<string | null>(null);
  const [encryptedPackagePath, setEncryptedPackagePath] = useState("");
  const [encryptedPackagePassword, setEncryptedPackagePassword] = useState("");
  const backupOperationPending =
    createBackupMutation.isPending ||
    restoreMutation.isPending ||
    restoreRemoteMutation.isPending ||
    verifyBackupMutation.isPending ||
    createEncryptedPackageMutation.isPending ||
    verifyEncryptedPackageMutation.isPending ||
    restoreEncryptedPackageMutation.isPending;
  // Separate state for the manual-path input — keeps it independent from list-row actions.
  const [manualRestoreName, setManualRestoreName] = useState<string>("");
  const [restoreRecovery, setRestoreRecovery] = useState<ApiRestoreResult | null>(() =>
    readStoredRestoreRecovery()
  );
  const restoreHealthQuery = useQuery({
    queryKey: ["restore-recovery-health", restoreRecovery?.restored_at, restoreRecovery?.health_url],
    queryFn: () =>
      restoreRecovery
        ? checkHealthAfterRestore(restoreRecovery.restored_at, restoreRecovery.health_url)
        : Promise.resolve(false),
    enabled: !!restoreRecovery,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      return query.state.data === true ? false : 2_000;
    },
  });

  useEffect(() => {
    if (!restoreRecovery) {
      window.localStorage.removeItem(RESTORE_RECOVERY_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(RESTORE_RECOVERY_STORAGE_KEY, JSON.stringify(restoreRecovery));
  }, [restoreRecovery]);

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
    const aiSettings = s.ai as Partial<ApiSettings["ai"]> | undefined;
    setAi(aiFormStateFromSettings(aiSettings));
    setEmbeddings(embeddingsFormStateFromSettings(aiSettings?.embeddings));
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
          anthropic: secretProviderPatch(ai.anthropic),
          openrouter: secretProviderPatch(ai.openrouter),
          openai_compatible: secretProviderPatch(ai.openai_compatible),
          deepseek: secretProviderPatch(ai.deepseek),
          embeddings: {
            provider: embeddings.provider,
            model: embeddings.model,
            openai_compatible: secretProviderPatch(embeddings.openai_compatible),
          },
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

  function updateAiApiKeyProvider(provider: ApiKeyProvider, patch: Partial<ApiKeyProviderFormState>) {
    setAi((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));
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

  function updateEmbeddingOpenAiCompatible(patch: Partial<ApiKeyProviderFormState>) {
    setEmbeddings((prev) => ({
      ...prev,
      openai_compatible: { ...prev.openai_compatible, ...patch },
    }));
    setDirty(true);
  }

  const canSave = dirty && !isLoading && !isError && !saveMutation.isPending;
  const canTest = ai.provider !== "none" && !dirty && !testing;

  function handleVerifyBackup(name: string) {
    setVerifyingBackupName(name);
    verifyBackupMutation.mutate(name, {
      onSuccess: (result) => {
        toast.success("Backup verified", {
          description: `${result.verified_files.length} files checked · ${result.bookmark_count} bookmarks`,
        });
      },
      onError: (err: Error) => {
        toast.error("Backup verification failed", { description: err.message });
      },
      onSettled: () => {
        setVerifyingBackupName(null);
      },
    });
  }

  function handleCreateEncryptedPackage(name: string, password: string) {
    setEncryptingBackupName(name);
    createEncryptedPackageMutation.mutate({ name, password }, {
      onSuccess: (result) => {
        setEncryptedPackagePath(result.path);
        toast.success("Encrypted package created", {
          description: encryptedPackageDescription(result),
        });
      },
      onError: (err: Error) => {
        toast.error("Encrypted package failed", { description: err.message });
      },
      onSettled: () => {
        setEncryptingBackupName(null);
      },
    });
  }

  function handleVerifyEncryptedPackage() {
    const path = encryptedPackagePath.trim();
    const password = encryptedPackagePassword;
    verifyEncryptedPackageMutation.mutate({ path, password }, {
      onSuccess: (result) => {
        toast.success("Encrypted package verified", {
          description: `${result.verified_files.length} files checked · ${result.bookmark_count} bookmarks`,
        });
      },
      onError: (err: Error) => {
        toast.error("Encrypted package verification failed", { description: err.message });
      },
      onSettled: () => {
        setEncryptedPackagePassword("");
      },
    });
  }

  function handleRestoreEncryptedPackage() {
    const path = encryptedPackagePath.trim();
    const password = encryptedPackagePassword;
    restoreEncryptedPackageMutation.mutate({ path, password }, {
      onSuccess: (result) => {
        setRestoreRecovery(result);
        toast.success("Encrypted package restored", {
          description: restoreSuccessDescription(result),
        });
        setEncryptedPackagePath("");
      },
      onError: (err: Error) => {
        toast.error("Encrypted package restore failed", { description: err.message });
      },
      onSettled: () => {
        setEncryptedPackagePassword("");
      },
    });
  }

  function handleRestoreSuccess(result: ApiRestoreResult) {
    setRestoreRecovery(result);
    toast.success("Restore complete", {
      description: restoreSuccessDescription(result),
    });
  }

  function renderApiKeyProviderFields(provider: ApiKeyProvider) {
    const config = ai[provider];
    const meta = apiKeyProviderMeta[provider];
    return (
      <>
        <div className="space-y-1.5">
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            value={config.api_key}
            onChange={(e) => updateAiApiKeyProvider(provider, { api_key: e.target.value })}
            placeholder={meta.apiKeyPlaceholder}
            className="h-8 text-sm font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Base URL</Label>
          <Input
            value={config.base_url}
            onChange={(e) => updateAiApiKeyProvider(provider, { base_url: e.target.value })}
            placeholder={meta.baseUrlPlaceholder}
            className="h-8 text-sm font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <Input
            value={config.model}
            onChange={(e) => updateAiApiKeyProvider(provider, { model: e.target.value })}
            placeholder={meta.modelPlaceholder}
            className="h-8 text-sm font-mono"
          />
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {restoreRecovery && (
        <RestoreRecoveryDialog
          result={restoreRecovery}
          healthy={restoreHealthQuery.data === true}
          checking={restoreHealthQuery.isFetching}
          onCheckNow={() => void restoreHealthQuery.refetch()}
          onContinue={() => {
            setRestoreRecovery(null);
            qc.clear();
          }}
        />
      )}
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
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                      <SelectItem value="openai_compatible">OpenAI compatible</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
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

                {ai.provider === "anthropic" && renderApiKeyProviderFields("anthropic")}
                {ai.provider === "openrouter" && renderApiKeyProviderFields("openrouter")}
                {ai.provider === "openai_compatible" && renderApiKeyProviderFields("openai_compatible")}
                {ai.provider === "deepseek" && renderApiKeyProviderFields("deepseek")}

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
                      <SelectItem value="openai_compatible">OpenAI compatible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {embeddings.provider === "openai_compatible" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        type="password"
                        value={embeddings.openai_compatible.api_key}
                        onChange={(e) => updateEmbeddingOpenAiCompatible({ api_key: e.target.value })}
                        placeholder="optional"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Base URL</Label>
                      <Input
                        value={embeddings.openai_compatible.base_url}
                        onChange={(e) => updateEmbeddingOpenAiCompatible({ base_url: e.target.value })}
                        placeholder="http://localhost:8000/v1"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model</Label>
                      <Input
                        value={embeddings.openai_compatible.model}
                        onChange={(e) => updateEmbeddingOpenAiCompatible({ model: e.target.value })}
                        placeholder="custom-embedding-model"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  </>
                ) : (
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
                )}
              </div>
            </section>

            <div className="border-t" />

            {/* Library Maintenance */}
            <section className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Library Maintenance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Re-run failed work, refresh existing bookmarks, or rebuild embeddings after provider changes.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded border px-3 py-2 bg-muted/30">
                  <Label htmlFor="replace-ai-fields" className="text-xs">
                    Allow AI field updates
                  </Label>
                  <Switch
                    id="replace-ai-fields"
                    checked={replaceAiFields}
                    onCheckedChange={setReplaceAiFields}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reprocessMutation.isPending}
                    onClick={() => reprocessMutation.mutate("failed_only")}
                  >
                    {reprocessMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Retry failed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reprocessMutation.isPending}
                    onClick={() => reprocessMutation.mutate("all")}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Reprocess all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reprocessMutation.isPending}
                    onClick={() => reprocessMutation.mutate("embeddings_only")}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Rebuild embeddings
                  </Button>
                </div>

                {reprocessBatch && (
                  <div className="rounded border px-3 py-2 text-xs bg-muted/30 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{reprocessBatch.enqueued} jobs queued</span>
                      <span className="font-mono text-muted-foreground truncate max-w-[12rem]">
                        {reprocessBatch.batch_id}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                      {reprocessBatch.skipped > 0 && <span>{reprocessBatch.skipped} skipped</span>}
                      {reprocessStatus && (
                        <>
                          <span>{reprocessStatus.pending} pending</span>
                          <span>{reprocessStatus.running} running</span>
                          <span>{reprocessStatus.done} done</span>
                          <span>{reprocessStatus.failed} failed</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="border-t" />

            {/* Updates */}
            <section className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Updates</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Check the configured release channel for a newer Little Imp version.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateCheckMutation.mutate()}
                  disabled={updateCheckMutation.isPending}
                  className="shrink-0"
                >
                  {updateCheckMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Check for updates
                </Button>
              </div>

              {updateCheckMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {updateCheckMutation.error instanceof Error
                      ? updateCheckMutation.error.message
                      : "Could not check for updates"}
                  </AlertDescription>
                </Alert>
              )}

              {updateCheckResult && (
                <div className="rounded border px-3 py-2 text-xs bg-muted/30 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {updateCheckResult.update_available ? (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                    <span className="font-medium">{updateCheckMessage(updateCheckResult)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <span>Channel: {updateCheckResult.channel}</span>
                    <span>Current: {updateCheckResult.current_version}</span>
                    {updateCheckResult.latest && (
                      <a
                        href={updateCheckResult.latest.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View release
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
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
                    disabled={backupOperationPending}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-2"
                            title="Verify backup integrity"
                            disabled={backupOperationPending}
                            onClick={() => handleVerifyBackup(entry.name)}
                          >
                            {verifyingBackupName === entry.name ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                          </Button>
                          <EncryptedPackageAction
                            entry={entry}
                            disabled={backupOperationPending}
                            active={encryptingBackupName === entry.name}
                            onCreate={handleCreateEncryptedPackage}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                                title="Restore this backup"
                                disabled={backupOperationPending}
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
                                        handleRestoreSuccess(result);
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
                          disabled={!manualRestoreName || backupOperationPending}
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
                                  handleRestoreSuccess(result);
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

                <div className="space-y-2">
                  <div>
                    <h3 className="text-xs font-medium">Encrypted Packages</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verify or restore a package file that the daemon can read from the configured backup folder.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_14rem] gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="encrypted-package-path" className="text-xs">
                        Encrypted package path
                      </Label>
                      <Input
                        id="encrypted-package-path"
                        placeholder="/Users/me/.../backups/backup.littleimp-backup.enc"
                        className="h-8 text-sm font-mono"
                        value={encryptedPackagePath}
                        onChange={(e) => setEncryptedPackagePath(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="encrypted-package-password" className="text-xs">
                        Encrypted package password
                      </Label>
                      <Input
                        id="encrypted-package-password"
                        type="password"
                        autoComplete="new-password"
                        className="h-8 text-sm"
                        value={encryptedPackagePassword}
                        onChange={(e) => setEncryptedPackagePassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!encryptedPackagePath.trim() || !encryptedPackagePassword || backupOperationPending}
                      onClick={handleVerifyEncryptedPackage}
                    >
                      {verifyEncryptedPackageMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Verify package
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!encryptedPackagePath.trim() || !encryptedPackagePassword || backupOperationPending}
                        >
                          {restoreEncryptedPackageMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Restore package
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore encrypted package?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This decrypts and verifies the package, creates a rollback copy,
                            preserves local secrets, and replaces your current library with{" "}
                            <strong className="font-mono break-all">{encryptedPackagePath}</strong>.
                            The daemon must be restarted after restoring.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRestoreEncryptedPackage}>
                            Restore encrypted package
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
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 ml-2"
                                        title="Restore from remote"
                                        disabled={backupOperationPending}
                                      >
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
                                                setRestoreRecovery(result);
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
