import { describe, expect, it } from "vitest";
import { generateBookmarkletUrl } from "./bookmarklet";

describe("generateBookmarkletUrl", () => {
  it("returns a javascript: URI", () => {
    const url = generateBookmarkletUrl("test-token");
    expect(url.startsWith("javascript:")).toBe(true);
  });

  it("embeds the token via JSON.stringify inside encodeURIComponent", () => {
    const url = generateBookmarkletUrl("limp_test_token_abc123");
    expect(url).toContain('encodeURIComponent("limp_test_token_abc123")');
  });

  it("embeds the default daemon URL via JSON.stringify", () => {
    const url = generateBookmarkletUrl("tok");
    expect(url).toContain('i.src="http://127.0.0.1:3210"+');
    expect(url).toContain("/capture/bookmarklet?url=");
  });

  it("uses a custom daemon URL when provided", () => {
    const url = generateBookmarkletUrl("tok", "http://localhost:9999");
    expect(url).not.toContain("127.0.0.1:3210");
    expect(url).toContain('i.src="http://localhost:9999"+');
  });

  it("escapes quotes and backslashes in tokens safely", () => {
    const token = 'tok"en\\value';
    const url = generateBookmarkletUrl(token);
    expect(url).toContain(JSON.stringify(token));
    expect(url).toContain('encodeURIComponent("tok\\"en\\\\value")');
  });

  it("produces a valid IIFE wrapper structure", () => {
    const url = generateBookmarkletUrl("tok");
    const script = url.slice("javascript:".length);
    expect(script.startsWith("!function(){")).toBe(true);
    expect(script.endsWith("}();")).toBe(true);
  });

  it("includes the bookmarklet sentinel element id check", () => {
    const url = generateBookmarkletUrl("tok");
    expect(url).toContain("__limp_bm");
  });

  it("constructs the correct iframe src pattern with url, title, and token params", () => {
    const url = generateBookmarkletUrl("my-token");
    expect(url).toContain("capture/bookmarklet?url=");
    expect(url).toContain("&title=");
    expect(url).toContain("&token=");
  });

  it("copes with tokens containing special characters", () => {
    const token = "tok+en/speci@l#chars";
    const url = generateBookmarkletUrl(token);
    expect(url).toContain(`encodeURIComponent(${JSON.stringify(token)})`);
  });

  it("copes with daemon URLs containing path segments", () => {
    const daemonUrl = "http://192.168.1.1:8080/path";
    const url = generateBookmarkletUrl("tok", daemonUrl);
    expect(url).toContain(`i.src=${JSON.stringify(daemonUrl)}+`);
  });

  it("generates distinct outputs for different tokens", () => {
    const url1 = generateBookmarkletUrl("token-a");
    const url2 = generateBookmarkletUrl("token-b");
    expect(url1).not.toBe(url2);
    expect(url1).toContain("token-a");
    expect(url2).toContain("token-b");
  });
});
