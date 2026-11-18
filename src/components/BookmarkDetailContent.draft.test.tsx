import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BookmarkDetailContent } from "./BookmarkDetailContent";
import type { UIBookmark } from "@/hooks/use-bookmarks";

vi.mock("./PipelineRecoveryPanel", () => ({ PipelineRecoveryPanel: () => null }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-markdown", () => ({ default: ({ children }: { children: string }) => <div>{children}</div> }));

const KEY = "grimoire:draft:v1:edit:bm-1:notes";

function bookmark(notes: string | null = null): UIBookmark {
  return {
    id: "bm-1", url: "https://example.com/a", title: "T", rawTitle: "T", summary: "s", domain: "example.com",
    favicon: "", tags: [], category: "Tech", category_id: "c", status: "indexed", savedAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z", is_pinned: 0, is_archived: 0, read_later: 0, read_at: null,
    opened_count: 0, last_opened_at: null, notes,
  };
}

function renderContent(bm: UIBookmark, onUpdateNotes = vi.fn()) {
  return render(
    <BookmarkDetailContent bookmark={bm} onUpdateTags={vi.fn()} onUpdateCategory={vi.fn()} onUpdateNotes={onUpdateNotes} relatedBookmarks={[]} onSelectRelated={vi.fn()} />,
  );
}

describe("BookmarkDetailContent notes draft", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("autosaves an in-progress notes edit and restores it with a notice", async () => {
    const first = renderContent(bookmark());
    fireEvent.click(screen.getByText(/add a personal note/i));
    fireEvent.change(screen.getByPlaceholderText(/add a personal note/i), { target: { value: "half-written" } });
    await waitFor(() => expect(window.localStorage.getItem(KEY)).toContain("half-written"));
    first.unmount();

    renderContent(bookmark());
    expect(await screen.findByText(/Restored unsaved draft/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/add a personal note/i)).toHaveValue("half-written");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByPlaceholderText(/add a personal note/i)).not.toBeInTheDocument();
  });

  it("clears the draft once the note is saved", async () => {
    const onUpdateNotes = vi.fn();
    renderContent(bookmark(), onUpdateNotes);
    fireEvent.click(screen.getByText(/add a personal note/i));
    fireEvent.change(screen.getByPlaceholderText(/add a personal note/i), { target: { value: "done" } });
    await waitFor(() => expect(window.localStorage.getItem(KEY)).not.toBeNull());
    fireEvent.click(screen.getAllByRole("button")[screen.getAllByRole("button").findIndex((b) => b.querySelector("svg.lucide-check"))]);
    expect(onUpdateNotes).toHaveBeenCalledWith("bm-1", "done");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("works when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    renderContent(bookmark());
    fireEvent.click(screen.getByText(/add a personal note/i));
    expect(screen.getByPlaceholderText(/add a personal note/i)).toBeInTheDocument();
  });
});
