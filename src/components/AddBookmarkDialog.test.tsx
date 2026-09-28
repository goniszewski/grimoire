import { describe, expect, it, vi } from "vitest";
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
