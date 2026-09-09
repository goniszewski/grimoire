import { afterEach, describe, expect, it, vi } from "vitest";
import { recordBookmarkOpen } from "./api";
import { MAX_OPEN_TABS, openSelectedBookmarks } from "./bookmark-open";
vi.mock("./api", () => ({ recordBookmarkOpen: vi.fn(async () => ({ data: {} })) }));
const bookmark = { id: "a", url: "https://example.com" };
afterEach(() => vi.restoreAllMocks());
describe("open selected", () => {
  it("rejects oversized batches before opening any tabs", () => {
    const open = vi.spyOn(window, "open");
    expect(openSelectedBookmarks(Array(MAX_OPEN_TABS + 1).fill(bookmark)).opened).toBe(0);
    expect(open).not.toHaveBeenCalled();
  });
  it("skips unsafe URLs", () => {
    const open = vi.spyOn(window, "open");
    expect(openSelectedBookmarks([{ id: "bad", url: "javascript:alert(1)" }]).unsafeIds).toEqual(["bad"]);
    expect(open).not.toHaveBeenCalled();
  });
  it("reports blocked tabs without recording an open", () => {
    vi.mocked(recordBookmarkOpen).mockClear();
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(openSelectedBookmarks([bookmark])).toEqual({ opened: 0, blockedIds: ["a"], unsafeIds: [] });
    expect(recordBookmarkOpen).not.toHaveBeenCalled();
  });
  it("severs opener access before navigating and records only successful opens", () => {
    const doc = document.implementation.createHTMLDocument();
    const tab = { opener: window as Window | null, document: doc, close: vi.fn() };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(tab.opener).toBeNull();
      expect(this.rel).toBe("noreferrer");
      expect(this.referrerPolicy).toBe("no-referrer");
      expect(this.href).toBe("https://example.com/");
    });
    vi.spyOn(window, "open").mockReturnValueOnce(tab as unknown as Window).mockReturnValueOnce(null);
    const result = openSelectedBookmarks([bookmark, { ...bookmark, id: "b" }]);
    expect(result).toEqual({ opened: 1, blockedIds: ["b"], unsafeIds: [] });
    expect(click).toHaveBeenCalledOnce();
  });
});
