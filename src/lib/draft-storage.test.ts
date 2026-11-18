import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, isNewBookmarkDraft, loadDraft, saveDraft } from "./draft-storage";

describe("draft storage", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  const draft = { urls: "https://a.com", title: "", notes: "n", tags: "", readLater: false };

  it("round-trips and clears a draft", () => {
    expect(saveDraft("new", draft)).toBe(true);
    expect(loadDraft("new", isNewBookmarkDraft)).toEqual(draft);
    clearDraft("new");
    expect(loadDraft("new", isNewBookmarkDraft)).toBeNull();
  });

  it("keeps drafts separate per key", () => {
    saveDraft("new", draft);
    expect(loadDraft("edit:1:notes", isNewBookmarkDraft)).toBeNull();
  });

  it("ignores malformed stored data", () => {
    window.localStorage.setItem("grimoire:draft:v1:new", "{not json");
    expect(loadDraft("new", isNewBookmarkDraft)).toBeNull();
    window.localStorage.setItem("grimoire:draft:v1:new", JSON.stringify({ data: { urls: 1 } }));
    expect(loadDraft("new", isNewBookmarkDraft)).toBeNull();
  });

  it("never throws when localStorage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(saveDraft("new", draft)).toBe(false);
    expect(loadDraft("new", isNewBookmarkDraft)).toBeNull();
    expect(() => clearDraft("new")).not.toThrow();
  });
});
