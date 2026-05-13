import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useSuggestions } from "./use-suggestions";
import type { ApiSuggestion } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listSuggestions: vi.fn(),
  acceptSuggestion: vi.fn(),
  rejectSuggestion: vi.fn(),
}));

import * as api from "@/lib/api";

const mockedListSuggestions = api.listSuggestions as unknown as ReturnType<typeof vi.fn>;
const mockedAcceptSuggestion = api.acceptSuggestion as unknown as ReturnType<typeof vi.fn>;
const mockedRejectSuggestion = api.rejectSuggestion as unknown as ReturnType<typeof vi.fn>;

function makeSuggestion(overrides: Partial<ApiSuggestion> = {}): ApiSuggestion {
  return {
    id: "sug-1",
    bookmarkId: "bm-1",
    type: "new_subcategory",
    value: "Create subcategory: Testing",
    metadata: {},
    confidence: 0.8,
    status: "pending",
    created_at: "2024-01-01T00:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list and pendingCount=0 initially when no suggestions", async () => {
    mockedListSuggestions.mockResolvedValue({ data: [], meta: { pending: 0 } });

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("returns suggestions and correct pendingCount", async () => {
    const sug1 = makeSuggestion({ id: "sug-1" });
    const sug2 = makeSuggestion({ id: "sug-2", type: "duplicate_bookmark" });
    mockedListSuggestions.mockResolvedValue({
      data: [sug1, sug2],
      meta: { pending: 2 },
    });

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.pendingCount).toBe(2);
  });

  it("isError is true when the list query fails", async () => {
    mockedListSuggestions.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.suggestions).toEqual([]);
  });

  it("accept removes the suggestion optimistically", async () => {
    const sug = makeSuggestion();
    mockedListSuggestions.mockResolvedValue({ data: [sug], meta: { pending: 1 } });
    // After invalidation the list query returns empty
    mockedListSuggestions.mockResolvedValueOnce({ data: [sug], meta: { pending: 1 } });
    mockedAcceptSuggestion.mockResolvedValue({ data: { ...sug, status: "accepted" } });
    mockedListSuggestions.mockResolvedValue({ data: [], meta: { pending: 0 } });

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => {
      result.current.accept("sug-1");
    });

    // Optimistic update: suggestion removed immediately
    await waitFor(() => expect(result.current.suggestions).toHaveLength(0));
    expect(result.current.pendingCount).toBe(0);
    expect(mockedAcceptSuggestion).toHaveBeenCalledWith("sug-1");
  });

  it("reject removes the suggestion optimistically", async () => {
    const sug = makeSuggestion();
    mockedListSuggestions.mockResolvedValue({ data: [sug], meta: { pending: 1 } });
    mockedListSuggestions.mockResolvedValueOnce({ data: [sug], meta: { pending: 1 } });
    mockedRejectSuggestion.mockResolvedValue({ data: { ...sug, status: "rejected" } });
    mockedListSuggestions.mockResolvedValue({ data: [], meta: { pending: 0 } });

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => {
      result.current.reject("sug-1");
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(0));
    expect(mockedRejectSuggestion).toHaveBeenCalledWith("sug-1");
  });

  it("accept rolls back on API error", async () => {
    const sug = makeSuggestion();
    mockedListSuggestions.mockResolvedValue({ data: [sug], meta: { pending: 1 } });
    mockedAcceptSuggestion.mockRejectedValue(new Error("Accept failed"));

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => {
      result.current.accept("sug-1");
    });

    // After optimistic remove + rollback on error, suggestion is restored
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
  });

  it("reject rolls back on API error", async () => {
    const sug = makeSuggestion();
    mockedListSuggestions.mockResolvedValue({ data: [sug], meta: { pending: 1 } });
    mockedRejectSuggestion.mockRejectedValue(new Error("Reject failed"));

    const { result } = renderHook(() => useSuggestions(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));

    act(() => {
      result.current.reject("sug-1");
    });

    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
  });
});
