import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenSelectedBookmarks } from "./OpenSelectedBookmarks";
import { openSelectedBookmarks } from "@/lib/bookmark-open";
vi.mock("@/lib/bookmark-open", () => ({ MAX_OPEN_TABS: 10, openSelectedBookmarks: vi.fn() }));
const bookmarks = [{ id: "a", title: "Alpha", url: "https://example.com/a" }, { id: "b", title: "Beta", url: "https://example.com/b" }];
beforeEach(() => vi.clearAllMocks());
describe("open selected confirmation", () => {
  it("requires a separate confirmation and retries only blocked tabs", () => {
    vi.mocked(openSelectedBookmarks).mockReturnValueOnce({ opened: 1, blockedIds: ["b"], unsafeIds: [] }).mockReturnValueOnce({ opened: 1, blockedIds: [], unsafeIds: [] });
    render(<OpenSelectedBookmarks bookmarks={bookmarks} />);
    fireEvent.click(screen.getByRole("button", { name: "Open selected (2)" }));
    expect(openSelectedBookmarks).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open 2 tabs" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 blocked");
    fireEvent.click(screen.getByRole("button", { name: "Retry remaining tabs" }));
    expect(openSelectedBookmarks).toHaveBeenLastCalledWith([bookmarks[1]]);
    expect(screen.getByRole("button", { name: "Done" })).toBeVisible();
  });
  it("explains the limit instead of opening an oversized selection", () => {
    render(<OpenSelectedBookmarks bookmarks={Array.from({length: 11}, (_, i) => ({...bookmarks[0], id: String(i)}))} />);
    fireEvent.click(screen.getByRole("button", { name: "Open selected (11)" }));
    expect(screen.getByText(/Select at most 10/)).toBeVisible();
    expect(screen.queryByRole("button", {name: "Open 11 tabs"})).not.toBeInTheDocument();
  });
});

it("keeps confirmation and its limit tied to the reviewed snapshot during refresh", () => {
  const { rerender } = render(<OpenSelectedBookmarks bookmarks={bookmarks} />);
  fireEvent.click(screen.getByRole("button", { name: "Open selected (2)" }));
  rerender(<OpenSelectedBookmarks bookmarks={Array.from({ length: 11 }, (_, i) => ({ ...bookmarks[0], id: String(i) }))} />);
  expect(screen.getByRole("button", { name: "Open 2 tabs" })).toBeVisible();
});
it("restores focus to the opening button after keyboard dismissal", async () => {
  const user = userEvent.setup();
  render(<OpenSelectedBookmarks bookmarks={bookmarks} />);
  const trigger = screen.getByRole("button", { name: "Open selected (2)" });
  await user.click(trigger);
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});
