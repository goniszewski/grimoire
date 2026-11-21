import { describe, expect, it } from "vitest";
import { parseSharedLink } from "./share-target";

const parse = (query: string) => parseSharedLink(new URLSearchParams(query));

describe("parseSharedLink", () => {
  it("uses the url field when present", () => {
    expect(parse("url=https%3A%2F%2Fexample.com%2Fa&title=Example")).toEqual({
      url: "https://example.com/a",
      title: "Example",
    });
  });

  it("falls back to a link embedded in text, as Android Chrome sends it", () => {
    expect(parse("text=Great%20read%20https%3A%2F%2Fexample.com%2Fpost%3Fa%3D1&title=")).toEqual({
      url: "https://example.com/post?a=1",
      title: undefined,
    });
  });

  it("prefers url over text and strips trailing sentence punctuation", () => {
    expect(parse("url=&text=See%20https%3A%2F%2Fexample.com%2Fx.")?.url).toBe("https://example.com/x");
    expect(parse("url=https%3A%2F%2Fa.example&text=https%3A%2F%2Fb.example")?.url).toBe("https://a.example/");
  });

  it("rejects non-http links and empty shares", () => {
    expect(parse("url=javascript%3Aalert(1)")).toBeNull();
    expect(parse("url=ftp%3A%2F%2Fexample.com")).toBeNull();
    expect(parse("text=just%20some%20words")).toBeNull();
    expect(parse("")).toBeNull();
  });
});
