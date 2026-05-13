import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSettings } from "./use-settings";

vi.mock("@/lib/api", () => ({
  getSettings: vi.fn(),
}));

import * as api from "@/lib/api";

const mockedGetSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function settingsResponse(runtimeEnrichment: boolean) {
  return {
    data: {
      ai: {
        provider: "openai" as const,
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
          enabled: runtimeEnrichment,
          provider: "openai" as const,
          model: runtimeEnrichment ? "gpt-4o-mini" : null,
          base_url: runtimeEnrichment ? "https://api.openai.com/v1" : null,
        },
        embeddings: {
          enabled: false,
          provider: "openai" as const,
          model: "text-embedding-3-small",
          base_url: "https://api.openai.com/v1",
        },
        capabilities: {
          enrichment: runtimeEnrichment,
          semantic_search: false,
          related_bookmarks: false,
          organization_agent: false,
        },
      },
    },
  };
}

describe("useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports aiEnabled=false when the selected provider lacks effective runtime capability", async () => {
    mockedGetSettings.mockResolvedValue(settingsResponse(false));

    const { result } = renderHook(() => useSettings(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.aiProvider).toBe("openai");
    expect(result.current.aiEnabled).toBe(false);
  });

  it("reports aiEnabled=true when runtime enrichment capability is available", async () => {
    mockedGetSettings.mockResolvedValue(settingsResponse(true));

    const { result } = renderHook(() => useSettings(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.aiEnabled).toBe(true);
  });
});
