import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import React from "react";
import TagDetail from "./TagDetail";
import type { ApiBookmark, ApiTag, ListBookmarksParams } from "@/lib/api";
import { bookmarkKeys } from "@/hooks/use-bookmarks";

vi.mock("@/lib/api", () => ({
  listBookmarks: vi.fn(),
  listTags: vi.fn(),
  renameTag: vi.fn(),
}));

import * as api from "@/lib/api";

type Pagination = {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

const mockedListBookmarks = api.listBookmarks as unknown as ReturnType<typeof vi.fn>;
const mockedListTags = api.listTags as unknown as ReturnType<typeof vi.fn>;
const mockedRenameTag = api.renameTag as unknown as ReturnType<typeof vi.fn>;

function makeTag(overrides: Partial<ApiTag> = {}): ApiTag {
  return {
    id: "tag-1",
    name: "typescript",
    created_at: "2026-05-31T12:00:00Z",
    bookmark_count: 22,
    ...overrides,
  };
}

function makeApiBookmark(overrides: Partial<ApiBookmark> = {}): ApiBookmark {
  return {
    id: "bm-1",
    url: "https://example.com",
    domain: "example.com",
    title: "Example bookmark",
    description: "A useful article",
    status: "indexed",
    category_id: null,
    favicon_url: null,
    screenshot_url: null,
    is_pinned: 0,
    is_archived: 0,
    is_trashed: 0,
    trashed_at: null,
    read_later: 0,
    read_at: null,
    opened_count: 0,
    last_opened_at: null,
    notes: null,
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-01T08:00:00Z",
    tags: ["typescript"],
    ...overrides,
  };
}

function bookmarkResponse(data: ApiBookmark[], pagination: Pagination) {
  return { data, pagination };
}

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderTagDetail(path = "/tags/typescript") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderResult = render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/tags/:tag" element={<TagDetail />} />
        </Routes>
        <LocationDisplay />
      </QueryClientProvider>
    </MemoryRouter>
  );
  return { ...renderResult, queryClient: qc };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListTags.mockResolvedValue({ data: [makeTag()] });
  mockedRenameTag.mockResolvedValue({
    data: {
      id: "tag-1",
      name: "react-query",
      created_at: "2026-05-31T12:00:00Z",
    },
  });
  mockedListBookmarks.mockResolvedValue(
    bookmarkResponse([makeApiBookmark()], {
      total: 1,
      limit: 20,
      offset: 0,
      has_more: false,
    })
  );
});

describe("TagDetail", () => {
  it("renders a loading state while tag metadata loads", () => {
    mockedListTags.mockReturnValue(new Promise(() => {}));

    renderTagDetail();

    expect(screen.getByText("Loading tag...")).toBeInTheDocument();
    expect(mockedListBookmarks).not.toHaveBeenCalled();
  });

  it("renders an unavailable state when tag metadata cannot load", async () => {
    mockedListTags.mockRejectedValue(new Error("offline"));

    renderTagDetail();

    expect(await screen.findByText("Tags unavailable")).toBeInTheDocument();
    expect(screen.getByText("The tag list could not be loaded.")).toBeInTheDocument();
    expect(mockedListBookmarks).not.toHaveBeenCalled();
  });

  it("renders tag metadata and the first daemon-paginated bookmark page", async () => {
    mockedListBookmarks.mockResolvedValue(
      bookmarkResponse(Array.from({ length: 20 }, (_, index) =>
        makeApiBookmark({
          id: `bm-${index + 1}`,
          title: index === 0 ? "Example bookmark" : `Bookmark ${index + 1}`,
        })
      ), {
        total: 22,
        limit: 20,
        offset: 0,
        has_more: true,
      })
    );

    renderTagDetail();

    expect(await screen.findByRole("heading", { name: "#typescript" })).toBeInTheDocument();
    expect(screen.getByText("22 bookmarks")).toBeInTheDocument();
    expect(screen.getByText("Created May 31, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open #typescript in library" })).toHaveAttribute(
      "href",
      "/?tag=typescript"
    );
    expect(screen.getByRole("link", { name: "Manage tags" })).toHaveAttribute("href", "/tags");
    expect(screen.getByRole("button", { name: "Rename #typescript tag" })).toBeInTheDocument();
    expect(screen.getByText("Example bookmark")).toBeInTheDocument();
    expect(screen.getByText("1-20 of 22")).toBeInTheDocument();
    expect(mockedListBookmarks).toHaveBeenCalledWith({
      tag: "typescript",
      limit: 20,
      offset: 0,
    } satisfies ListBookmarksParams);
  });

  it("uses daemon pagination when moving between scoped tag pages", async () => {
    mockedListTags.mockResolvedValue({ data: [makeTag({ bookmark_count: 21 })] });
    mockedListBookmarks.mockImplementation((params: ListBookmarksParams) => {
      if (params.offset === 20) {
        return Promise.resolve(
          bookmarkResponse(
            [makeApiBookmark({ id: "bm-21", title: "Second page bookmark" })],
            { total: 21, limit: 20, offset: 20, has_more: false }
          )
        );
      }
      return Promise.resolve(
        bookmarkResponse(
          [makeApiBookmark({ id: "bm-1", title: "First page bookmark" })],
          { total: 21, limit: 20, offset: 0, has_more: true }
        )
      );
    });

    renderTagDetail();

    expect(await screen.findByText("First page bookmark")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith({
        tag: "typescript",
        limit: 20,
        offset: 20,
      })
    );
    expect(await screen.findByText("Second page bookmark")).toBeInTheDocument();
    expect(screen.getByText("21-21 of 21")).toBeInTheDocument();
  });

  it("renders an empty state for known tags without active bookmarks", async () => {
    mockedListTags.mockResolvedValue({ data: [makeTag({ bookmark_count: 0 })] });
    mockedListBookmarks.mockResolvedValue(
      bookmarkResponse([], {
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      })
    );

    renderTagDetail();

    expect(await screen.findByRole("heading", { name: "#typescript" })).toBeInTheDocument();
    expect(screen.getByText("No bookmarks with this tag yet")).toBeInTheDocument();
  });

  it("does not request scoped bookmarks for an unknown tag", async () => {
    mockedListTags.mockResolvedValue({ data: [] });

    renderTagDetail("/tags/missing");

    expect(await screen.findByText("Tag not found")).toBeInTheDocument();
    expect(mockedListBookmarks).not.toHaveBeenCalled();
  });

  it("renames the current tag and navigates to the new detail route", async () => {
    mockedListTags
      .mockResolvedValueOnce({ data: [makeTag()] })
      .mockResolvedValue({ data: [makeTag({ name: "react-query" })] });

    const { queryClient } = renderTagDetail();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(await screen.findByRole("button", { name: "Rename #typescript tag" }));
    expect(screen.getByText("Rename #typescript")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New tag name"), { target: { value: " React-Query " } });
    fireEvent.click(screen.getByRole("button", { name: "Rename tag" }));

    await waitFor(() => expect(mockedRenameTag).toHaveBeenCalledWith("tag-1", "react-query"));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.tags });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.archive });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookmarkKeys.trash });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["search"] });
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/tags/react-query"));
    expect(await screen.findByRole("heading", { name: "#react-query" })).toBeInTheDocument();
  });
});
