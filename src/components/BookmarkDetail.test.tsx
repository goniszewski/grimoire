import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookmarkDetail } from "./BookmarkDetail";
import type { UIBookmark } from "@/hooks/use-bookmarks";
import type React from "react";
import * as api from "@/lib/api";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    open ? <div>{children}</div> : null
  ),
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("./BookmarkDetailContent", () => ({
  BookmarkDetailContent: ({ bookmark }: { bookmark: UIBookmark & { content?: { markdown: string | null } | null } }) => (
    <div data-testid="detail-content">
      <span>{bookmark.content?.markdown ?? "no detail content"}</span>
      <span>{bookmark.media?.screenshot?.url ?? "no media"}</span>
    </div>
  ),
}));

function makeBookmark(overrides: Partial<UIBookmark> = {}): UIBookmark {
  return {
    id: "bm-1",
    url: "https://example.com/article",
    title: "Test Article",
    rawTitle: "Test Article",
    summary: "A short summary",
    domain: "example.com",
    favicon: "https://example.com/favicon.ico",
    tags: ["typescript"],
    category: "Tech",
    category_id: "cat-1",
    status: "indexed",
    savedAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    is_pinned: 0,
    is_archived: 0,
    read_later: 0,
    read_at: null,
    opened_count: 0,
    last_opened_at: null,
    notes: null,
    ...overrides,
  };
}

function renderWithQueryClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BookmarkDetail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the detail endpoint while open and passes extracted content to the detail body", async () => {
    const getBookmarkMock = vi.spyOn(api, "getBookmark") as unknown as {
      mockResolvedValue: (value: unknown) => void;
    };
    getBookmarkMock.mockResolvedValue({
      data: {
        id: "bm-1",
        url: "https://example.com/article",
        domain: "example.com",
        title: "Test Article",
        description: "A short summary",
        status: "indexed",
        category_id: "cat-1",
        favicon_url: "https://example.com/favicon.ico",
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
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T10:00:00Z",
        tags: ["typescript"],
        content: {
          bookmark_id: "bm-1",
          raw_html: null,
          markdown: "Readable detail body",
          summary: "A short summary",
          author: "Ada Lovelace",
          published_at: "2024-01-12T09:00:00Z",
          word_count: 1284,
          language: "en",
          extracted_at: "2024-01-15T10:05:00Z",
        },
        media: {
          favicon: null,
          screenshot: {
            id: "media-preview",
            kind: "screenshot",
            url: "http://127.0.0.1:3210/media/bookmarks/bm-1/preview",
            source_url: "https://example.com/preview.png",
            media_type: "image/png",
            size_bytes: 2048,
            alt: "Page preview",
          },
          images: [],
        },
      },
    });

    renderWithQueryClient(
      <BookmarkDetail
        bookmark={makeBookmark()}
        open
        onOpenChange={vi.fn()}
        onUpdateTags={vi.fn()}
        onUpdateCategory={vi.fn()}
        onUpdateField={vi.fn()}
        onUpdateNotes={vi.fn()}
        relatedBookmarks={[]}
        onSelectRelated={vi.fn()}
      />
    );

    await waitFor(() => expect(api.getBookmark).toHaveBeenCalledWith("bm-1"));
    expect(await screen.findByTestId("detail-content")).toHaveTextContent("Readable detail body");
    expect(screen.getByTestId("detail-content")).toHaveTextContent("/media/bookmarks/bm-1/preview");
  });

  it("calls onUpdateField when the editable title is changed and confirmed", async () => {
    const user = userEvent.setup();
    const onUpdateField = vi.fn();
    const getBookmarkMock = vi.spyOn(api, "getBookmark") as unknown as {
      mockResolvedValue: (value: unknown) => void;
    };
    getBookmarkMock.mockResolvedValue({ data: { content: null } });

    renderWithQueryClient(
      <BookmarkDetail
        bookmark={makeBookmark()}
        open
        onOpenChange={vi.fn()}
        onUpdateTags={vi.fn()}
        onUpdateCategory={vi.fn()}
        onUpdateField={onUpdateField}
        onUpdateNotes={vi.fn()}
        relatedBookmarks={[]}
        onSelectRelated={vi.fn()}
      />
    );

    const title = screen.getByText("Test Article", { selector: "span" });
    const editButton = title.closest("div[class*='group/title']")?.querySelector("button");
    expect(editButton).not.toBeNull();
    await user.click(editButton!);

    const input = screen.getByDisplayValue("Test Article");
    await user.clear(input);
    await user.type(input, "Renamed Article");
    const confirmButton = input.closest("div")?.querySelector("button");
    expect(confirmButton).not.toBeNull();
    await user.click(confirmButton!);

    expect(onUpdateField).toHaveBeenCalledWith("bm-1", "title", "Renamed Article");
  });

  it("exposes the title editor to keyboard and assistive-technology users", async () => {
    const getBookmarkMock = vi.spyOn(api, "getBookmark") as unknown as {
      mockResolvedValue: (value: unknown) => void;
    };
    getBookmarkMock.mockResolvedValue({ data: { content: null } });

    renderWithQueryClient(
      <BookmarkDetail
        bookmark={makeBookmark()}
        open
        onOpenChange={vi.fn()}
        onUpdateTags={vi.fn()}
        onUpdateCategory={vi.fn()}
        onUpdateField={vi.fn()}
        onUpdateNotes={vi.fn()}
        relatedBookmarks={[]}
        onSelectRelated={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Edit bookmark title" })).toHaveClass(
      "focus-visible:opacity-100"
    );
  });
});
