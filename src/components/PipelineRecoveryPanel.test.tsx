import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PipelineRecoveryPanel } from "./PipelineRecoveryPanel";

vi.mock("@/lib/api", () => ({
  getBookmarkStatus: vi.fn(),
  retryBookmarkPipeline: vi.fn(),
  dismissBookmarkFailure: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import * as api from "@/lib/api";

type MockedAsyncFn<Args extends unknown[], Result> = ((...args: Args) => Promise<Result>) & {
  mockResolvedValue(value: Result): void;
};

const mockedGetBookmarkStatus = api.getBookmarkStatus as unknown as MockedAsyncFn<[string], {
  data: {
    bookmarkId: string;
    bookmarkStatus: "saved" | "fetched" | "extracted" | "ai_enriched" | "indexed";
    last_failure: {
      stage: "fetch" | "extract" | "ai_enrich" | "embed" | "index";
      message: string;
      configuration_related: boolean;
      retryable: boolean;
      failed_at: string;
      dismissed_at: string | null;
    } | null;
    job: null | {
      status: "pending" | "running" | "done" | "failed";
      error: string | null;
    };
  };
}>;
const mockedRetryBookmarkPipeline = api.retryBookmarkPipeline as unknown as MockedAsyncFn<[string], { data: unknown }>;
const mockedDismissBookmarkFailure = api.dismissBookmarkFailure as unknown as MockedAsyncFn<[string], void>;

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PipelineRecoveryPanel bookmarkId="bm-1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetBookmarkStatus.mockResolvedValue({
    data: {
      bookmarkId: "bm-1",
      bookmarkStatus: "extracted",
      last_failure: {
        stage: "ai_enrich",
        message: "Provider API key is invalid",
        configuration_related: true,
        retryable: true,
        failed_at: "2026-05-27T08:00:00Z",
        dismissed_at: null,
      },
      job: null,
    },
  });
  mockedRetryBookmarkPipeline.mockResolvedValue({ data: {} });
  mockedDismissBookmarkFailure.mockResolvedValue(undefined);
});

describe("PipelineRecoveryPanel", () => {
  it("shows actionable failure details and settings guidance", async () => {
    renderPanel();

    expect(await screen.findByText("AI enrichment failed")).toBeInTheDocument();
    expect(screen.getByText("Provider API key is invalid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
  });

  it("retries and dismisses the current bookmark failure", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /retry/i }));
    expect(mockedRetryBookmarkPipeline).toHaveBeenCalledWith("bm-1");

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    await waitFor(() => expect(mockedDismissBookmarkFailure).toHaveBeenCalledWith("bm-1"));
  });

  it("hides stale failure actions while a retry job is active", async () => {
    mockedGetBookmarkStatus.mockResolvedValue({
      data: {
        bookmarkId: "bm-1",
        bookmarkStatus: "indexed",
        last_failure: {
          stage: "embed",
          message: "Embedding provider unavailable",
          configuration_related: true,
          retryable: true,
          failed_at: "2026-05-27T08:00:00Z",
          dismissed_at: null,
        },
        job: { status: "pending", error: null },
      },
    });

    renderPanel();

    await waitFor(() => expect(mockedGetBookmarkStatus).toHaveBeenCalledWith("bm-1"));
    expect(screen.queryByText("Embedding failed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("does not offer dismiss for blocking failed jobs", async () => {
    mockedGetBookmarkStatus.mockResolvedValue({
      data: {
        bookmarkId: "bm-1",
        bookmarkStatus: "saved",
        last_failure: {
          stage: "fetch",
          message: "HTTP 500: Server Error",
          configuration_related: false,
          retryable: true,
          failed_at: "2026-05-27T08:00:00Z",
          dismissed_at: null,
        },
        job: { status: "failed", error: "HTTP 500: Server Error" },
      },
    });

    renderPanel();

    expect(await screen.findByText("Fetch failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
