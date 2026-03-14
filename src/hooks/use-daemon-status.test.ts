import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDaemonStatus } from "./use-daemon-status";

vi.mock("@/lib/api", () => ({
  checkHealth: vi.fn(),
}));

import * as api from "@/lib/api";

const mockedCheckHealth = vi.mocked(api.checkHealth);

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useDaemonStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns online=true when health check succeeds", async () => {
    mockedCheckHealth.mockResolvedValue(true);

    const { result } = renderHook(() => useDaemonStatus(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.online).toBe(true);
  });

  it("returns online=false when health check returns false", async () => {
    mockedCheckHealth.mockResolvedValue(false);

    const { result } = renderHook(() => useDaemonStatus(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.online).toBe(false);
  });

  it("returns online=false when health check throws (daemon unreachable)", async () => {
    mockedCheckHealth.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useDaemonStatus(), {
      wrapper: makeWrapper(),
    });

    // Default value is false; after failure it stays false
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.online).toBe(false);
  });

  it("isChecking is true while the health query is in flight", async () => {
    let resolve: (v: boolean) => void;
    const pending = new Promise<boolean>((res) => {
      resolve = res;
    });
    mockedCheckHealth.mockReturnValue(pending);

    const { result } = renderHook(() => useDaemonStatus(), {
      wrapper: makeWrapper(),
    });

    // Immediately after mount the query is fetching
    expect(result.current.isChecking).toBe(true);

    // Unblock and wait for completion
    resolve!(true);
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(result.current.online).toBe(true);
  });
});
