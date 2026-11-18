import { beforeEach, describe, expect, it, vi } from "vitest";
import { findActiveBookmarkByUrl, parseShareLinkParams, SHARE_LIMITS } from "./share-link";

const listBookmarks = vi.fn();
vi.mock("@/lib/api", () => ({ listBookmarks: (...args: unknown[]) => listBookmarks(...args) }));

const parse = (qs: string) => parseShareLinkParams(new URLSearchParams(qs));

describe("parseShareLinkParams", () => {
  it("parses url, title, note and tags", () => {
    expect(parse("url=https%3A%2F%2Fexample.com%2Fa&title=Hello&note=Why&tags=One, two,ONE")).toEqual({
      url: "https://example.com/a",
      title: "Hello",
      notes: "Why",
      tags: ["one", "two"],
    });
  });

  it("rejects non-http(s) and credentialed urls but keeps other fields", () => {
    expect(parse("url=javascript:alert(1)&title=T")).toEqual({ url: "", title: "T", notes: "", tags: [] });
    expect(parse("url=https://u:p@example.com/&title=T")?.url).toBe("");
    expect(parse("url=file:///etc/passwd")).toBeNull();
    expect(parse("url=data:text/html,x")).toBeNull();
  });

  it("returns null when nothing usable is present", () => {
    expect(parse("")).toBeNull();
    expect(parse("url=nonsense")).toBeNull();
  });

  it("enforces length caps and strips control characters", () => {
    const long = "https://example.com/" + "a".repeat(SHARE_LIMITS.url);
    expect(parse(`url=${encodeURIComponent(long)}`)).toBeNull();
    const tags = Array.from({ length: 50 }, (_, i) => `t${i}`).join(",");
    const result = parse(`title=${"x".repeat(1000)}&note=${"n".repeat(50_000)}&tags=${tags}`);
    expect(result?.title).toHaveLength(SHARE_LIMITS.title);
    expect(result?.notes).toHaveLength(SHARE_LIMITS.note);
    expect(result?.tags).toHaveLength(SHARE_LIMITS.tags);
    expect(parse("title=a%00b%07c%0Ad")?.title).toBe("abc d");
  });

  it("keeps markup as inert text", () => {
    expect(parse("title=%3Cscript%3Ealert(1)%3C%2Fscript%3E")?.title).toBe("<script>alert(1)</script>");
  });
});

describe("findActiveBookmarkByUrl", () => {
  beforeEach(() => listBookmarks.mockReset());

  it("finds an exact, non-archived match filtered by hostname", async () => {
    const hit = { id: "1", url: "https://example.com/a", is_archived: 0 };
    listBookmarks.mockResolvedValue({ data: [{ id: "0", url: "https://example.com/b" }, hit], pagination: { has_more: false } });
    await expect(findActiveBookmarkByUrl("https://example.com/a")).resolves.toBe(hit);
    expect(listBookmarks).toHaveBeenCalledWith(expect.objectContaining({ domain: "example.com" }));
  });

  it("pages until exhausted", async () => {
    listBookmarks
      .mockResolvedValueOnce({ data: [{ id: "0", url: "https://example.com/x" }], pagination: { has_more: true } })
      .mockResolvedValueOnce({ data: [], pagination: { has_more: false } });
    await expect(findActiveBookmarkByUrl("https://example.com/a")).resolves.toBeNull();
    expect(listBookmarks).toHaveBeenCalledTimes(2);
  });

  it("ignores archived matches", async () => {
    listBookmarks.mockResolvedValue({ data: [{ id: "1", url: "https://example.com/a", is_archived: 1 }], pagination: { has_more: false } });
    await expect(findActiveBookmarkByUrl("https://example.com/a")).resolves.toBeNull();
  });
});
