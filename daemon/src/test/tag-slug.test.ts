import { describe, expect, it } from "bun:test";
import { slugifyTagName } from "../lib/tag-slug.js";

describe("slugifyTagName", () => {
  it.each([
    ["Web Dev", "web-dev"],
    ["über", "uber"],
    ["Crème brûlée", "creme-brulee"],
    ["c++", "c-plus-plus"],
    ["C#", "c-sharp"],
    ["R&D", "r-and-d"],
    ["node.js", "node-js"],
    ["  --spaced__out--  ", "spaced-out"],
    ["already-valid", "already-valid"],
    ["#hashtag", "hashtag"],
  ])("turns %p into %p", (input, expected) => {
    expect(slugifyTagName(input)).toBe(expected);
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(slugifyTagName("日本語")).toBe("");
    expect(slugifyTagName("!!!")).toBe("");
    expect(slugifyTagName("")).toBe("");
  });

  it("caps the length at 50 characters without a trailing hyphen", () => {
    const slug = slugifyTagName(`${"a".repeat(49)} b`);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("always produces output the tag API accepts", () => {
    for (const input of ["Web Dev", "c++", "über", "a--b", "x".repeat(80), "tag with  many   spaces"]) {
      const slug = slugifyTagName(input);
      expect(slug === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)).toBe(true);
    }
  });
});
