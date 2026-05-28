import { act, type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AIPalette } from "./AIPalette";

vi.mock("@/components/ui/command", () => ({
  CommandDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  CommandInput: ({
    placeholder,
    value,
    onValueChange,
  }: {
    placeholder: string;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <input
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children, heading }: { children: ReactNode; heading: string }) => (
    <section aria-label={heading}>{children}</section>
  ),
  CommandItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  CommandSeparator: () => <hr />,
}));

vi.mock("@/lib/api", () => ({
  searchBookmarks: vi.fn(),
}));

import { searchBookmarks } from "@/lib/api";

type MockedSearchBookmarks = typeof searchBookmarks & {
  mockResolvedValue(value: unknown): MockedSearchBookmarks;
  mockResolvedValueOnce(value: unknown): MockedSearchBookmarks;
  mockRejectedValueOnce(value: unknown): MockedSearchBookmarks;
  mockReturnValueOnce(value: unknown): MockedSearchBookmarks;
};

const mockedSearchBookmarks = searchBookmarks as MockedSearchBookmarks;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("AIPalette", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockedSearchBookmarks.mockResolvedValue({
      data: [],
      pagination: { total: 0, limit: 8, offset: 0, has_more: false },
      meta: { mode: "hybrid" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches command-palette queries with hybrid mode", async () => {
    render(
      <AIPalette
        open
        onOpenChange={vi.fn()}
        onSelectBookmark={vi.fn()}
        onAddBookmark={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search bookmarks/i), {
      target: { value: "release readiness docs" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(mockedSearchBookmarks).toHaveBeenCalledWith({
      q: "release readiness docs",
      mode: "hybrid",
      limit: 8,
    });
  });

  it("falls back to keyword search when hybrid search needs an embedding provider", async () => {
    mockedSearchBookmarks
      .mockRejectedValueOnce({
        status: 422,
        detail: "mode=hybrid requires an embedding provider to be configured",
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { total: 0, limit: 8, offset: 0, has_more: false },
        meta: { mode: "keyword" },
      });

    render(
      <AIPalette
        open
        onOpenChange={vi.fn()}
        onSelectBookmark={vi.fn()}
        onAddBookmark={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search bookmarks/i), {
      target: { value: "release readiness docs" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(mockedSearchBookmarks).toHaveBeenNthCalledWith(1, {
      q: "release readiness docs",
      mode: "hybrid",
      limit: 8,
    });
    expect(mockedSearchBookmarks).toHaveBeenNthCalledWith(2, {
      q: "release readiness docs",
      mode: "keyword",
      limit: 8,
    });
  });

  it("ignores search results that resolve after the palette closes", async () => {
    const pendingSearch = deferred<{
      data: Array<{ id: string; title: string; url: string; domain: string; favicon_url: null }>;
      pagination: { total: number; limit: number; offset: number; has_more: boolean };
      meta: { mode: "hybrid" };
    }>();

    mockedSearchBookmarks.mockReturnValueOnce(pendingSearch.promise);

    const props = {
      onOpenChange: vi.fn(),
      onSelectBookmark: vi.fn(),
      onAddBookmark: vi.fn(),
    };
    const { rerender } = render(<AIPalette open {...props} />);

    fireEvent.change(screen.getByPlaceholderText(/search bookmarks/i), {
      target: { value: "stale query" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    rerender(<AIPalette open={false} {...props} />);

    await act(async () => {
      pendingSearch.resolve({
        data: [
          {
            id: "bm-stale",
            title: "Stale bookmark",
            url: "https://example.com/stale",
            domain: "example.com",
            favicon_url: null,
          },
        ],
        pagination: { total: 1, limit: 8, offset: 0, has_more: false },
        meta: { mode: "hybrid" },
      });
      await pendingSearch.promise;
    });

    rerender(<AIPalette open {...props} />);

    expect(screen.queryByText("Stale bookmark")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search bookmarks/i)).toHaveValue("");
  });
});
