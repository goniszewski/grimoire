import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookmarkGalleryCard } from "./BookmarkGalleryCard";
import type { UIBookmark } from "@/hooks/use-bookmarks";

function makeBookmark(overrides: Partial<UIBookmark> = {}): UIBookmark {
  return {
    id: "bm-1",
    url: "https://example.com/a",
    title: "Sunset photo",
    rawTitle: "Sunset photo",
    summary: "",
    domain: "example.com",
    favicon: "data:image/png;base64,AAAA",
    screenshot: "http://127.0.0.1:3210/media/bookmarks/bm-1/m-1",
    tags: ["art", "photo", "sky", "extra"],
    category: "Uncategorized",
    status: "indexed",
    savedAt: "2026-06-01T08:00:00Z",
    updatedAt: "2026-06-01T08:00:00Z",
    category_id: null,
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

describe("BookmarkGalleryCard", () => {
  it("renders a lazy image with alt text, title caption and limited tags", () => {
    render(<BookmarkGalleryCard bookmark={makeBookmark()} onClick={vi.fn()} />);
    const img = screen.getByAltText("Preview of Sunset photo");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("Sunset photo")).toBeInTheDocument();
    expect(screen.getByText("art")).toBeInTheDocument();
    expect(screen.queryByText("extra")).not.toBeInTheDocument();
  });

  it("opens detail when activated and is keyboard reachable as a button", () => {
    const onClick = vi.fn();
    const bookmark = makeBookmark();
    render(<BookmarkGalleryCard bookmark={bookmark} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Sunset photo" }));
    expect(onClick).toHaveBeenCalledWith(bookmark);
  });

  it("shows a placeholder without an image and after an image load error", () => {
    const { rerender } = render(<BookmarkGalleryCard bookmark={makeBookmark({ screenshot: null })} onClick={vi.fn()} />);
    expect(screen.getByTestId("gallery-placeholder")).toBeInTheDocument();

    rerender(<BookmarkGalleryCard bookmark={makeBookmark({ id: "bm-2" })} onClick={vi.fn()} />);
    fireEvent.error(screen.getByAltText("Preview of Sunset photo"));
    expect(screen.getByTestId("gallery-placeholder")).toBeInTheDocument();
  });

  it("toggles selection instead of opening in selection mode", () => {
    const onClick = vi.fn();
    const onToggleSelect = vi.fn();
    render(<BookmarkGalleryCard bookmark={makeBookmark()} onClick={onClick} selectionMode selected onToggleSelect={onToggleSelect} />);
    const button = screen.getByRole("button", { name: "Select Sunset photo" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onToggleSelect).toHaveBeenCalledWith("bm-1");
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("BookmarkGalleryCard image refresh", () => {
  it("retries when the screenshot URL changes after a load error", () => {
    const { rerender } = render(<BookmarkGalleryCard bookmark={makeBookmark()} onClick={vi.fn()} />);
    fireEvent.error(screen.getByAltText("Preview of Sunset photo"));
    expect(screen.getByTestId("gallery-placeholder")).toBeInTheDocument();
    rerender(<BookmarkGalleryCard bookmark={makeBookmark({ screenshot: "http://127.0.0.1:3210/media/bookmarks/bm-1/m-2" })} onClick={vi.fn()} />);
    expect(screen.getByAltText("Preview of Sunset photo")).toBeInTheDocument();
  });
});
