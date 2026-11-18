import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AddBookmarkDialog } from "./AddBookmarkDialog";

describe("AddBookmarkDialog failures", () => {
  it("shows the daemon's failure reason when saving one URL fails", async () => {
    render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={vi.fn().mockRejectedValue(new Error("This bookmark is in Trash. Restore it first."))} />);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/article"), { target: { value: "https://example.com/article" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Bookmark" }));
    expect(await screen.findByText("This bookmark is in Trash. Restore it first.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://example.com/article")).toHaveValue("https://example.com/article");
  });

  it("keeps reasons associated with each failed URL in a batch", async () => {
    const onAdd = vi.fn(async (url: string) => {
      throw new Error(url.endsWith("/one") ? "Archived bookmark" : "Server unavailable");
    });
    render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={onAdd} />);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/article"), { target: { value: "https://example.com/one\nhttps://example.com/two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save links" }));
    await waitFor(() => expect(screen.getByRole("list", { name: "Failed links" })).toBeInTheDocument());
    expect(screen.getByText("https://example.com/one: Archived bookmark")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/two: Server unavailable")).toBeInTheDocument();
  });
});

describe("AddBookmarkDialog share-link prefill and drafts", () => {
  const urlBox = () => screen.getByPlaceholderText("https://example.com/article");
  const DRAFT = "grimoire:draft:v1:new";

  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("prefills from a share link and submits title and tags", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={onAdd} prefill={{ url: "https://example.com/a", title: "T", notes: "N", tags: ["x", "y"] }} />);
    expect(urlBox()).toHaveValue("https://example.com/a");
    expect(screen.getByLabelText("Title")).toHaveValue("T");
    expect(screen.getByLabelText("Tags")).toHaveValue("x, y");
    fireEvent.click(screen.getByRole("button", { name: "Save Bookmark" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("https://example.com/a", { readLater: false, notes: "N", title: "T", tags: ["x", "y"] }));
  });

  it("autosaves a draft, restores it on reopen with a notice, and discards it", async () => {
    const first = render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.change(urlBox(), { target: { value: "https://example.com/draft" } });
    await waitFor(() => expect(window.localStorage.getItem(DRAFT)).toContain("https://example.com/draft"));
    first.unmount();

    render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={vi.fn()} />);
    expect(await screen.findByText("Restored unsaved draft")).toBeInTheDocument();
    expect(urlBox()).toHaveValue("https://example.com/draft");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(urlBox()).toHaveValue("");
    expect(window.localStorage.getItem(DRAFT)).toBeNull();
  });

  it("clears the draft on cancel and on successful save", async () => {
    const onOpenChange = vi.fn();
    render(<AddBookmarkDialog open onOpenChange={onOpenChange} onAdd={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.change(urlBox(), { target: { value: "https://example.com/c" } });
    await waitFor(() => expect(window.localStorage.getItem(DRAFT)).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.localStorage.getItem(DRAFT)).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.change(urlBox(), { target: { value: "https://example.com/d" } });
    await waitFor(() => expect(window.localStorage.getItem(DRAFT)).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Save Bookmark" }));
    await waitFor(() => expect(window.localStorage.getItem(DRAFT)).toBeNull());
  });

  it("keeps the draft after a failed submit", async () => {
    render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={vi.fn().mockRejectedValue(new Error("down"))} />);
    fireEvent.change(urlBox(), { target: { value: "https://example.com/f" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Bookmark" }));
    await screen.findByText("down");
    await waitFor(() => expect(window.localStorage.getItem(DRAFT)).toContain("https://example.com/f"));
  });

  it("still saves when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddBookmarkDialog open onOpenChange={vi.fn()} onAdd={onAdd} />);
    fireEvent.change(urlBox(), { target: { value: "https://example.com/ok" } });
    await new Promise((r) => setTimeout(r, 500));
    fireEvent.click(screen.getByRole("button", { name: "Save Bookmark" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
  });
});
