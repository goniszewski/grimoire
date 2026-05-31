import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import Settings from "./Settings";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  DAEMON_URL: "http://127.0.0.1:3210",
  ApiError: class ApiError extends Error {},
  checkForUpdates: vi.fn(),
  getReprocessStatus: vi.fn(),
  getDiagnostics: vi.fn(),
  getSettings: vi.fn(),
  reprocessBookmarks: vi.fn(),
  updateSettings: vi.fn(),
  checkHealthAfterRestore: vi.fn(),
}));

vi.mock("@/hooks/use-backup", () => ({
  useBackupList: vi.fn(),
  useCreateBackup: vi.fn(),
  useRestoreBackup: vi.fn(),
  useRestoreRemoteBackup: vi.fn(),
  useBackupListWithRemote: vi.fn(),
  useTestS3Connection: vi.fn(),
  useBackupSchedule: vi.fn(),
  useUpdateBackupSchedule: vi.fn(),
  useBackupDestination: vi.fn(),
  useUpdateBackupDestination: vi.fn(),
  useVerifyBackup: vi.fn(),
  useCreateEncryptedBackupPackage: vi.fn(),
  useVerifyEncryptedBackupPackage: vi.fn(),
  useRestoreEncryptedBackupPackage: vi.fn(),
}));

import * as api from "@/lib/api";
import * as backupHooks from "@/hooks/use-backup";

const mockedGetSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;
const mockedCheckForUpdates = (api as unknown as { checkForUpdates: ReturnType<typeof vi.fn> }).checkForUpdates;
const mockedCheckHealthAfterRestore = (api as unknown as { checkHealthAfterRestore: ReturnType<typeof vi.fn> }).checkHealthAfterRestore;
const mockedGetDiagnostics = (api as unknown as { getDiagnostics: ReturnType<typeof vi.fn> }).getDiagnostics;
const mockedReprocessBookmarks = (api as unknown as { reprocessBookmarks: ReturnType<typeof vi.fn> }).reprocessBookmarks;
const mockedGetReprocessStatus = (api as unknown as { getReprocessStatus: ReturnType<typeof vi.fn> }).getReprocessStatus;
const mockedUseBackupList = backupHooks.useBackupList as unknown as ReturnType<typeof vi.fn>;
const mockedUseCreateBackup = backupHooks.useCreateBackup as unknown as ReturnType<typeof vi.fn>;
const mockedUseRestoreBackup = backupHooks.useRestoreBackup as unknown as ReturnType<typeof vi.fn>;
const mockedUseRestoreRemoteBackup = backupHooks.useRestoreRemoteBackup as unknown as ReturnType<typeof vi.fn>;
const mockedUseBackupListWithRemote = backupHooks.useBackupListWithRemote as unknown as ReturnType<typeof vi.fn>;
const mockedUseTestS3Connection = backupHooks.useTestS3Connection as unknown as ReturnType<typeof vi.fn>;
const mockedUseBackupSchedule = backupHooks.useBackupSchedule as unknown as ReturnType<typeof vi.fn>;
const mockedUseUpdateBackupSchedule = backupHooks.useUpdateBackupSchedule as unknown as ReturnType<typeof vi.fn>;
const mockedUseBackupDestination = backupHooks.useBackupDestination as unknown as ReturnType<typeof vi.fn>;
const mockedUseUpdateBackupDestination = backupHooks.useUpdateBackupDestination as unknown as ReturnType<typeof vi.fn>;
const mockedUseVerifyBackup = backupHooks.useVerifyBackup as unknown as ReturnType<typeof vi.fn>;
const mockedUseCreateEncryptedBackupPackage = backupHooks.useCreateEncryptedBackupPackage as unknown as ReturnType<typeof vi.fn>;
const mockedUseVerifyEncryptedBackupPackage = backupHooks.useVerifyEncryptedBackupPackage as unknown as ReturnType<typeof vi.fn>;
const mockedUseRestoreEncryptedBackupPackage = backupHooks.useRestoreEncryptedBackupPackage as unknown as ReturnType<typeof vi.fn>;

function settingsResponse(aiPatch: Record<string, unknown> = {}) {
  const ai = {
    provider: "none" as const,
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
    embeddings: {
      provider: "openai" as const,
      model: "text-embedding-3-small",
      openai_compatible: {
        api_key: "",
        base_url: "http://localhost:8000/v1",
        model: "custom-embedding-model",
      },
    },
    ...aiPatch,
  };

  return {
    data: {
      ai,
      app: {
        autostart: false,
        theme: "system" as const,
        lock: { enabled: false, pin_hash: "" },
      },
      backup: {
        local: { destination_path: "" },
        schedule: { enabled: false, cron: "0 3 * * *", retention_count: 7 },
        s3: {
          endpoint: "",
          bucket: "",
          access_key: "",
          secret_key: "",
          region: "us-east-1",
          prefix: "little-imp-backups/",
        },
      },
      runtime: {
        llm: {
          enabled: false,
          provider: "none" as const,
          model: null,
          base_url: null,
        },
        embeddings: {
          enabled: false,
          provider: "openai" as const,
          model: "text-embedding-3-small",
          base_url: "https://api.openai.com/v1",
        },
        capabilities: {
          enrichment: false,
          semantic_search: false,
          related_bookmarks: false,
          organization_agent: false,
        },
      },
    },
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockedGetSettings.mockResolvedValue(settingsResponse());
  mockedGetDiagnostics.mockResolvedValue({
    data: {
      generated_at: "2026-05-27T08:00:00.000Z",
      version: "0.1.0-beta",
      platform: { os: "darwin", arch: "arm64", node_env: "production", host: "127.0.0.1", port: 3210 },
      install: { mode: "native" },
      paths: {
        data_dir: "/Users/me/.local/share/littleimp",
        database_path: "/Users/me/.local/share/littleimp/littleimp.db",
        config_file: "/Users/me/.config/littleimp/config.json",
        backup_dir: "/Users/me/.local/share/littleimp/backups",
        log_files: [
          { label: "daemon stdout", path: "/Users/me/.local/share/littleimp/logs/daemon.log" },
          { label: "daemon stderr", path: "/Users/me/.local/share/littleimp/logs/daemon.error.log" },
        ],
      },
      daemon: { status: "ok", uptime_ms: 1000, queue_size: 0, queue: { pending: 0, running: 0, done: 0, failed: 0 } },
      providers: {
        llm: { provider: "none", configured: false, model: null, base_url: null },
        embeddings: { provider: "openai", configured: false, model: "text-embedding-3-small", base_url: "https://api.openai.com/v1" },
      },
      backup: {
        local: { path: "/Users/me/.local/share/littleimp/backups", is_custom: false, writable: true },
        schedule: { enabled: false, cron: "0 3 * * *", retention_count: 7, next_run_at: null },
        s3: { configured: false, endpoint: "", bucket: "", region: "us-east-1", prefix: "little-imp-backups/" },
      },
      search: { keyword: true, semantic: false, hybrid: false },
      omitted_secrets: ["AI provider API keys", "app lock PIN hash"],
    },
  });
  mockedCheckForUpdates.mockResolvedValue({
    data: {
      current_version: "0.1.0-beta",
      update_available: false,
      source: "https://api.github.com/repos/goniszewski/little-imp/releases",
      channel: "beta",
      latest: null,
    },
  });
  mockedCheckHealthAfterRestore.mockResolvedValue(false);
  mockedReprocessBookmarks.mockResolvedValue({
    data: {
      batch_id: "batch-1",
      mode: "failed_only",
      requested: 3,
      enqueued: 2,
      skipped: 1,
      job_ids: ["job-1", "job-2"],
      status_url: "/reprocess/batch-1",
    },
  });
  mockedGetReprocessStatus.mockResolvedValue({
    data: {
      batch_id: "batch-1",
      total: 2,
      pending: 1,
      running: 0,
      done: 1,
      failed: 0,
    },
  });
  mockedUseBackupList.mockReturnValue({
    data: [
      {
        name: "2026-05-18T10-00-00-000Z",
        path: "/tmp/backups/2026-05-18T10-00-00-000Z",
        size_bytes: 2048,
        bookmark_count: 3,
        created_at: "2026-05-18T10:00:00.000Z",
        source: "local",
      },
    ],
  });
  mockedUseCreateBackup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseRestoreBackup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseRestoreRemoteBackup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseBackupListWithRemote.mockReturnValue({ data: [], isLoading: false });
  mockedUseTestS3Connection.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseBackupSchedule.mockReturnValue({
    data: { enabled: false, cron: "0 3 * * *", retention_count: 7, next_run_at: null },
    isLoading: false,
  });
  mockedUseUpdateBackupSchedule.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseBackupDestination.mockReturnValue({
    data: { path: "/tmp/backups", is_custom: false, writable: true },
    isLoading: false,
  });
  mockedUseUpdateBackupDestination.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseVerifyBackup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseCreateEncryptedBackupPackage.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseVerifyEncryptedBackupPackage.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockedUseRestoreEncryptedBackupPackage.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("Settings update checks", () => {
  it("renders when the daemon returns an older settings shape", async () => {
    const legacySettings = settingsResponse();
    delete (legacySettings.data.ai as Partial<typeof legacySettings.data.ai>).anthropic;
    delete (legacySettings.data.ai as Partial<typeof legacySettings.data.ai>).openrouter;
    delete (legacySettings.data.ai as Partial<typeof legacySettings.data.ai>).openai_compatible;
    delete (legacySettings.data.ai as Partial<typeof legacySettings.data.ai>).deepseek;
    delete (legacySettings.data.ai.embeddings as Partial<typeof legacySettings.data.ai.embeddings>).openai_compatible;
    mockedGetSettings.mockResolvedValue(legacySettings);

    render(<Settings />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Updates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
  });

  it("checks for updates and shows the available release", async () => {
    mockedCheckForUpdates.mockResolvedValue({
      data: {
        current_version: "0.1.0-beta",
        update_available: true,
        source: "https://api.github.com/repos/goniszewski/little-imp/releases",
        channel: "beta",
        latest: {
          version: "0.2.0-beta.1",
          tag: "v0.2.0-beta.1",
          name: "Little Imp 0.2.0 beta 1",
          prerelease: true,
          published_at: "2026-05-19T10:00:00.000Z",
          url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0-beta.1",
        },
      },
    });

    render(<Settings />, { wrapper: makeWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Check for updates" }));

    await waitFor(() => {
      expect(mockedCheckForUpdates).toHaveBeenCalledWith();
    });
    expect(await screen.findByText(/v0\.2\.0-beta\.1 is available/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View release" })).toHaveAttribute(
      "href",
      "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0-beta.1"
    );
  });
});

describe("Settings backup verification", () => {
  it("refreshes diagnostics after creating a backup", async () => {
    const createMutate = vi.fn((
      _variables: undefined,
      options: {
        onSuccess: (result: {
          name: string;
          path: string;
          size_bytes: number;
          bookmark_count: number;
          created_at: string;
        }) => void;
      }
    ) => {
      options.onSuccess({
        name: "2026-05-31T11-30-20-798Z",
        path: "/tmp/backups/2026-05-31T11-30-20-798Z",
        size_bytes: 2048,
        bookmark_count: 1,
        created_at: "2026-05-31T11:30:20.798Z",
      });
    });
    mockedUseCreateBackup.mockReturnValue({ mutate: createMutate, isPending: false });

    render(<Settings />, { wrapper: makeWrapper() });

    await screen.findByText("Diagnostics");
    await waitFor(() => {
      expect(mockedGetDiagnostics).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Create backup now" }));

    await waitFor(() => {
      expect(mockedGetDiagnostics).toHaveBeenCalledTimes(2);
    });
  });

  it("offers a verify action for local backup rows", async () => {
    const verifyMutate = vi.fn();
    mockedUseVerifyBackup.mockReturnValue({ mutate: verifyMutate, isPending: false });

    render(<Settings />, { wrapper: makeWrapper() });

    await screen.findByText("Recent backups");
    fireEvent.click(screen.getByTitle("Verify backup integrity"));

    await waitFor(() => {
      expect(verifyMutate).toHaveBeenCalledWith(
        "2026-05-18T10-00-00-000Z",
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  it("blocks Settings with restart and rollback guidance after restore succeeds", async () => {
    const restartCommand = "launchctl stop com.littleimp.daemon && launchctl start com.littleimp.daemon";
    const restoreMutate = vi.fn((_name: string, options: {
      onSuccess: (result: {
        restored_at: string;
        bookmark_count: number;
        checksum_verified: boolean;
        rollback_path: string;
        restart_required: boolean;
        restart_command: string;
        health_url: string;
        rollback_instructions: string[];
      }) => void;
    }) => {
      options.onSuccess({
        restored_at: "2026-05-15T12:00:00.000Z",
        bookmark_count: 3,
        checksum_verified: true,
        rollback_path: "/tmp/rollback",
        restart_required: true,
        restart_command: restartCommand,
        health_url: "http://127.0.0.1:3210/health",
        rollback_instructions: [
          "If the restored library is not correct, stop littleimpd and copy /tmp/rollback/littleimp.db back to the data directory.",
        ],
      });
    });
    mockedUseRestoreBackup.mockReturnValue({ mutate: restoreMutate, isPending: false });

    render(<Settings />, { wrapper: makeWrapper() });

    await screen.findByText("Recent backups");
    fireEvent.click(screen.getByTitle("Restore this backup"));
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));

    expect(await screen.findByRole("dialog", { name: "Restart Little Imp" })).toBeInTheDocument();
    expect(screen.getByText(restartCommand)).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:3210/health")).toBeInTheDocument();
    expect(screen.getByText(/\/tmp\/rollback\/littleimp\.db/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await waitFor(() =>
      expect(mockedCheckHealthAfterRestore).toHaveBeenCalledWith(
        "2026-05-15T12:00:00.000Z",
        "http://127.0.0.1:3210/health"
      )
    );
  });

  it("offers an encrypted package action for local backup rows", async () => {
    const packageMutate = vi.fn();
    mockedUseCreateEncryptedBackupPackage.mockReturnValue({ mutate: packageMutate, isPending: false });

    render(<Settings />, { wrapper: makeWrapper() });

    await screen.findByText("Recent backups");
    fireEvent.click(screen.getByTitle("Create encrypted package"));
    fireEvent.change(screen.getByLabelText("Package password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create package" }));

    await waitFor(() => {
      expect(packageMutate).toHaveBeenCalledWith(
        {
          name: "2026-05-18T10-00-00-000Z",
          password: "correct horse battery staple",
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  it("verifies an encrypted package path with a per-operation password", async () => {
    const verifyEncryptedMutate = vi.fn();
    mockedUseVerifyEncryptedBackupPackage.mockReturnValue({ mutate: verifyEncryptedMutate, isPending: false });

    render(<Settings />, { wrapper: makeWrapper() });

    await screen.findByText("Encrypted Packages");
    fireEvent.change(screen.getByLabelText("Encrypted package path"), {
      target: { value: "/tmp/backups/2026-05-18T10-00-00-000Z.littleimp-backup.enc" },
    });
    fireEvent.change(screen.getByLabelText("Encrypted package password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify package" }));

    await waitFor(() => {
      expect(verifyEncryptedMutate).toHaveBeenCalledWith(
        {
          path: "/tmp/backups/2026-05-18T10-00-00-000Z.littleimp-backup.enc",
          password: "correct horse battery staple",
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });

  it("restores an encrypted package path only after explicit confirmation", async () => {
    const restoreEncryptedMutate = vi.fn();
    mockedUseRestoreEncryptedBackupPackage.mockReturnValue({ mutate: restoreEncryptedMutate, isPending: false });

    render(<Settings />, { wrapper: makeWrapper() });

    await screen.findByText("Encrypted Packages");
    fireEvent.change(screen.getByLabelText("Encrypted package path"), {
      target: { value: "/tmp/backups/2026-05-18T10-00-00-000Z.littleimp-backup.enc" },
    });
    fireEvent.change(screen.getByLabelText("Encrypted package password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore package" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restore encrypted package" }));

    await waitFor(() => {
      expect(restoreEncryptedMutate).toHaveBeenCalledWith(
        {
          path: "/tmp/backups/2026-05-18T10-00-00-000Z.littleimp-backup.enc",
          password: "correct horse battery staple",
        },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );
    });
  });
});

describe("Settings library maintenance", () => {
  it("queues failed-bookmark reprocessing and shows batch progress counts", async () => {
    render(<Settings />, { wrapper: makeWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Retry failed" }));

    await waitFor(() => {
      expect(mockedReprocessBookmarks).toHaveBeenCalledWith({
        mode: "failed_only",
        replace_ai_fields: false,
      });
    });
    expect(await screen.findByText("2 jobs queued")).toBeInTheDocument();
    expect(await screen.findByText("1 pending")).toBeInTheDocument();
    expect(screen.getByText("1 done")).toBeInTheDocument();
  });

  it("queues all-bookmark reprocessing with AI field replacement when enabled", async () => {
    render(<Settings />, { wrapper: makeWrapper() });

    fireEvent.click(await screen.findByLabelText("Allow AI field updates"));
    fireEvent.click(screen.getByRole("button", { name: "Reprocess all" }));

    await waitFor(() => {
      expect(mockedReprocessBookmarks).toHaveBeenCalledWith({
        mode: "all",
        replace_ai_fields: true,
      });
    });
  });

  it("queues embedding-only refresh jobs", async () => {
    render(<Settings />, { wrapper: makeWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Rebuild embeddings" }));

    await waitFor(() => {
      expect(mockedReprocessBookmarks).toHaveBeenCalledWith({
        mode: "embeddings_only",
        replace_ai_fields: false,
      });
    });
  });

  it("does not poll batch status when every reprocess target was skipped", async () => {
    mockedReprocessBookmarks.mockResolvedValueOnce({
      data: {
        batch_id: "batch-empty",
        mode: "failed_only",
        requested: 1,
        enqueued: 0,
        skipped: 1,
        job_ids: [],
        status_url: null,
      },
    });

    render(<Settings />, { wrapper: makeWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Retry failed" }));

    expect(await screen.findByText("0 jobs queued")).toBeInTheDocument();
    expect(screen.getByText("1 skipped")).toBeInTheDocument();
    expect(mockedGetReprocessStatus).not.toHaveBeenCalled();
  });
});

describe("Settings diagnostics", () => {
  it("shows diagnostics and copies the redacted support bundle", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<Settings />, { wrapper: makeWrapper() });

    expect(await screen.findByText("Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("0.1.0-beta")).toBeInTheDocument();
    expect(screen.getByText("native · darwin/arm64")).toBeInTheDocument();
    expect(screen.getByText("/Users/me/.local/share/littleimp")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"version": "0.1.0-beta"'));
    });
    expect(writeText.mock.calls[0][0]).not.toContain("openai-secret");
    expect(writeText.mock.calls[0][0]).not.toContain("s3-secret-key");
  });
});

describe("Settings AI providers", () => {
  it("renders provider-specific Anthropic fields from settings", async () => {
    mockedGetSettings.mockResolvedValue(settingsResponse({
      provider: "anthropic" as const,
      anthropic: {
        api_key: "***",
        base_url: "https://api.anthropic.com",
        model: "claude-sonnet-4-6",
      },
    }));

    render(<Settings />, { wrapper: makeWrapper() });

    expect(await screen.findByDisplayValue("https://api.anthropic.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("claude-sonnet-4-6")).toBeInTheDocument();
    expect(screen.getByDisplayValue("***")).toBeInTheDocument();
  });

  it("omits an unchanged redacted OpenRouter key when saving provider fields", async () => {
    const updateSettings = api.updateSettings as unknown as ReturnType<typeof vi.fn>;
    updateSettings.mockResolvedValue(settingsResponse());
    mockedGetSettings.mockResolvedValue(settingsResponse({
      provider: "openrouter" as const,
      openrouter: {
        api_key: "***",
        base_url: "https://openrouter.ai/api/v1",
        model: "~openai/gpt-latest",
      },
    }));

    render(<Settings />, { wrapper: makeWrapper() });

    const model = await screen.findByDisplayValue("~openai/gpt-latest");
    fireEvent.change(model, { target: { value: "openai/gpt-5.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          ai: expect.objectContaining({
            provider: "openrouter",
            openrouter: {
              base_url: "https://openrouter.ai/api/v1",
              model: "openai/gpt-5.2",
            },
          }),
        })
      );
    });
  });

  it("renders custom OpenAI-compatible embedding fields separately from the LLM provider", async () => {
    mockedGetSettings.mockResolvedValue(settingsResponse({
      embeddings: {
        provider: "openai_compatible" as const,
        model: "text-embedding-3-small",
        openai_compatible: {
          api_key: "***",
          base_url: "https://embeddings.example.test/v1",
          model: "custom-embed",
        },
      },
    }));

    render(<Settings />, { wrapper: makeWrapper() });

    expect(await screen.findByDisplayValue("https://embeddings.example.test/v1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("custom-embed")).toBeInTheDocument();
  });
});
