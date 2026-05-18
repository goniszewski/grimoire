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
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
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
}));

import * as api from "@/lib/api";
import * as backupHooks from "@/hooks/use-backup";

const mockedGetSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;
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

function settingsResponse() {
  return {
    data: {
      ai: {
        provider: "none" as const,
        openai: { api_key: "", model: "gpt-4o-mini" },
        ollama: { base_url: "http://localhost:11434", model: "llama3" },
        embeddings: { provider: "openai" as const, model: "text-embedding-3-small" },
      },
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
  mockedGetSettings.mockResolvedValue(settingsResponse());
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
});

describe("Settings backup verification", () => {
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
});
