import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";
import CategoryDetail from "./CategoryDetail";
import type { ApiBookmark, ApiCategory, ListBookmarksParams } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listBookmarks: vi.fn(),
  listCategories: vi.fn(),
  updateCategory: vi.fn(),
}));

import * as api from "@/lib/api";

type Pagination = {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

const mockedListCategories = api.listCategories as unknown as ReturnType<typeof vi.fn>;
const mockedListBookmarks = api.listBookmarks as unknown as ReturnType<typeof vi.fn>;

function makeApiBookmark(overrides: Partial<ApiBookmark> = {}): ApiBookmark {
  return {
    id: "bm-1",
    url: "https://example.com",
    domain: "example.com",
    title: "Example bookmark",
    description: "A useful article",
    status: "indexed",
    category_id: "cat-ai",
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
    tags: ["ai"],
    ...overrides,
  };
}

function makeApiCategory(overrides: Partial<ApiCategory> = {}): ApiCategory {
  return {
    id: "cat-ai",
    name: "AI",
    parent_id: "cat-research",
    color: null,
    icon: null,
    description: null,
    slug: null,
    is_archived: 0,
    is_public: 0,
    created_at: "2026-04-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
    bookmark_count: 22,
    children: [],
    ...overrides,
  };
}

function bookmarkResponse(data: ApiBookmark[], pagination: Pagination) {
  return { data, pagination };
}

function renderCategoryDetail(path = "/categories/cat-ai") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/categories/:id" element={<CategoryDetail />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoryDetail", () => {
  it("renders category metadata, child categories, and the first bookmark page", async () => {
    mockedListCategories.mockResolvedValue({
      data: [
        makeApiCategory({
          id: "cat-research",
          name: "Research",
          parent_id: null,
          color: "#2563eb",
          icon: "brain",
          description: "Research inbox",
          slug: "research",
          is_public: 1,
          bookmark_count: 3,
          children: [
            makeApiCategory({
              color: "#7c3aed",
              icon: "sparkles",
              description: "Machine learning papers and agent notes",
              slug: "ai-research",
              is_archived: 1,
              is_public: 1,
              children: [
                makeApiCategory({
                  id: "cat-agents",
                  name: "Agents",
                  parent_id: "cat-ai",
                  bookmark_count: 4,
                }),
              ],
            }),
          ],
        }),
      ],
    });
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

    renderCategoryDetail();

    expect(await screen.findByRole("heading", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Machine learning papers and agent notes")).toBeInTheDocument();
    expect(screen.getByText("ai-research")).toBeInTheDocument();
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Public").length).toBeGreaterThan(0);
    expect(screen.getByText("22 bookmarks")).toBeInTheDocument();
    expect(screen.getByText("Created Apr 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Updated May 1, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to library" })).toBeInTheDocument();
    expect(screen.getByText("Example bookmark")).toBeInTheDocument();
    expect(screen.getByText("1-20 of 22")).toBeInTheDocument();
    expect(mockedListBookmarks).toHaveBeenCalledWith({
      category_id: "cat-ai",
      limit: 20,
      offset: 0,
    } satisfies ListBookmarksParams);
  });

  it("edits category metadata from the detail page", async () => {
    mockedListCategories.mockResolvedValue({
      data: [
        makeApiCategory({
          color: "#2563eb",
          icon: "brain",
          description: "Machine learning papers",
          slug: "ai-research",
          is_archived: 0,
          is_public: 1,
        }),
      ],
    });
    mockedListBookmarks.mockResolvedValue(
      bookmarkResponse([], {
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      })
    );
    (api.updateCategory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: makeApiCategory({
        color: "#16a34a",
        icon: "sparkles",
        description: "Updated research notes",
        slug: "ai-updated",
        is_archived: 0,
        is_public: 1,
      }),
    });

    renderCategoryDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#16a34a" } });
    fireEvent.change(screen.getByLabelText("Icon"), { target: { value: "sparkles" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "ai-updated" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Updated research notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));

    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith("cat-ai", {
        color: "#16a34a",
        icon: "sparkles",
        description: "Updated research notes",
        slug: "ai-updated",
        is_archived: 0,
        is_public: 1,
      })
    );
  });

  it("keeps color unset when editing other metadata on an uncolored category", async () => {
    mockedListCategories.mockResolvedValue({
      data: [
        makeApiCategory({
          color: null,
          icon: null,
          description: null,
          slug: null,
          is_archived: 0,
          is_public: 0,
        }),
      ],
    });
    mockedListBookmarks.mockResolvedValue(
      bookmarkResponse([], {
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      })
    );
    (api.updateCategory as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: makeApiCategory({
        color: null,
        icon: "sparkles",
        description: null,
        slug: null,
        is_archived: 0,
        is_public: 0,
      }),
    });

    renderCategoryDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Edit metadata" }));
    fireEvent.change(screen.getByLabelText("Icon"), { target: { value: "sparkles" } });
    fireEvent.click(screen.getByRole("button", { name: "Save metadata" }));

    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith("cat-ai", {
        color: null,
        icon: "sparkles",
        description: null,
        slug: null,
        is_archived: 0,
        is_public: 0,
      })
    );
  });

  it("uses daemon pagination when moving between category bookmark pages", async () => {
    mockedListCategories.mockResolvedValue({
      data: [makeApiCategory()],
    });
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

    renderCategoryDetail();

    expect(await screen.findByText("First page bookmark")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenLastCalledWith({
        category_id: "cat-ai",
        limit: 20,
        offset: 20,
      })
    );
    expect(await screen.findByText("Second page bookmark")).toBeInTheDocument();
    expect(screen.getByText("21-21 of 21")).toBeInTheDocument();
  });

  it("recovers when a category bookmark page is beyond the latest total", async () => {
    mockedListCategories.mockResolvedValue({
      data: [makeApiCategory({ bookmark_count: 21 })],
    });
    mockedListBookmarks.mockImplementation((params: ListBookmarksParams) => {
      if (params.offset === 20) {
        return Promise.resolve(
          bookmarkResponse([], {
            total: 19,
            limit: 20,
            offset: 20,
            has_more: false,
          })
        );
      }
      return Promise.resolve(
        bookmarkResponse(
          [makeApiBookmark({ id: "bm-1", title: "First page bookmark" })],
          { total: 21, limit: 20, offset: 0, has_more: true }
        )
      );
    });

    renderCategoryDetail();

    expect(await screen.findByText("First page bookmark")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() =>
      expect(mockedListBookmarks).toHaveBeenCalledWith({
        category_id: "cat-ai",
        limit: 20,
        offset: 20,
      })
    );
    await waitFor(() => expect(screen.getByText("First page bookmark")).toBeInTheDocument());
    expect(screen.queryByText("No bookmarks in this category yet")).not.toBeInTheDocument();
  });

  it("does not fall back to third-party favicon requests for bookmarks without stored icons", async () => {
    mockedListCategories.mockResolvedValue({
      data: [makeApiCategory()],
    });
    mockedListBookmarks.mockResolvedValue(
      bookmarkResponse([makeApiBookmark({ domain: "private.example", favicon_url: null })], {
        total: 1,
        limit: 20,
        offset: 0,
        has_more: false,
      })
    );

    const { container } = renderCategoryDetail();

    expect(await screen.findByText("Example bookmark")).toBeInTheDocument();
    expect(container.querySelector('img[src*="google.com/s2/favicons"]')).not.toBeInTheDocument();
  });

  it("resets pagination before requesting bookmarks for a different category", async () => {
    mockedListCategories.mockResolvedValue({
      data: [
        makeApiCategory({
          id: "cat-ai",
          name: "AI",
          parent_id: null,
          bookmark_count: 21,
          children: [
            makeApiCategory({
              id: "cat-agents",
              name: "Agents",
              parent_id: "cat-ai",
              bookmark_count: 1,
            }),
          ],
        }),
      ],
    });
    mockedListBookmarks.mockImplementation((params: ListBookmarksParams) => {
      if (params.category_id === "cat-agents") {
        return Promise.resolve(
          bookmarkResponse(
            [makeApiBookmark({ id: "bm-agent", title: "Agent article", category_id: "cat-agents" })],
            { total: 1, limit: 20, offset: params.offset ?? 0, has_more: false }
          )
        );
      }
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

    renderCategoryDetail();

    expect(await screen.findByText("First page bookmark")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Second page bookmark")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Agents/ }));
    expect(await screen.findByText("Agent article")).toBeInTheDocument();

    const calls = mockedListBookmarks.mock.calls.map(([params]) => params as ListBookmarksParams);
    expect(calls).toContainEqual({
      category_id: "cat-agents",
      limit: 20,
      offset: 0,
    });
    expect(calls).not.toContainEqual(
      expect.objectContaining({
        category_id: "cat-agents",
        offset: 20,
      })
    );
  });

  it("renders an empty state for categories with no scoped bookmarks", async () => {
    mockedListCategories.mockResolvedValue({
      data: [makeApiCategory({ bookmark_count: 0 })],
    });
    mockedListBookmarks.mockResolvedValue(
      bookmarkResponse([], {
        total: 0,
        limit: 20,
        offset: 0,
        has_more: false,
      })
    );

    renderCategoryDetail();

    expect(await screen.findByRole("heading", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByText("No bookmarks in this category yet")).toBeInTheDocument();
  });

  it("does not request bookmarks for an unknown category id", async () => {
    mockedListCategories.mockResolvedValue({ data: [] });

    renderCategoryDetail("/categories/missing");

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(mockedListBookmarks).not.toHaveBeenCalled();
  });
});
