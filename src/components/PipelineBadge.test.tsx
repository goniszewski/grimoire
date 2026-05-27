import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PipelineBadge } from "./PipelineBadge";

vi.mock("@/lib/api", () => ({
  getBookmarkStatus: vi.fn(),
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

function renderBadge(initialStatus: "saved" | "fetched" | "extracted" | "ai_enriched" | "indexed") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <PipelineBadge bookmarkId="bm-1" initialStatus={initialStatus} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
      job: null,
    },
  });
});

describe("PipelineBadge", () => {
  it("fetches status for indexed bookmarks so later reprocess failures are visible", async () => {
    renderBadge("indexed");

    expect(await screen.findByText("Failed: Embedding")).toBeInTheDocument();
    expect(mockedGetBookmarkStatus).toHaveBeenCalledWith("bm-1");
  });

  it("prioritizes an active retry job over a stale persisted failure", async () => {
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

    renderBadge("indexed");

    await waitFor(() => expect(mockedGetBookmarkStatus).toHaveBeenCalledWith("bm-1"));
    expect(screen.getByText("Indexed")).toBeInTheDocument();
    expect(screen.queryByText("Failed: Embedding")).not.toBeInTheDocument();
  });
});
