import { describe, expect, it } from "vitest";
import { generateBookmarkletUrl } from "./bookmarklet";

describe("generateBookmarkletUrl", () => {
  it("returns a javascript: URI", () => {
    const url = generateBookmarkletUrl("test-token");
    expect(url.startsWith("javascript:")).toBe(true);
  });

  it("embeds the token literally in the script (wrapped in encodeURIComponent at runtime)", () => {
    const url = generateBookmarkletUrl("limp_test_token_abc123");
    // The token appears as a string literal inside encodeURIComponent("...") in the script
    expect(url).toContain('encodeURIComponent("limp_test_token_abc123")');
  });

  it("embeds the default daemon URL literally in the script", () => {
    const url = generateBookmarkletUrl("tok");
    expect(url).toContain('i.src="http://127.0.0.1:3210/capture/bookmarklet?url=');
  });

  it("uses a custom daemon URL when provided", () => {
    const url = generateBookmarkletUrl("tok", "http://localhost:9999");
    expect(url).not.toContain("127.0.0.1:3210");
    expect(url).toContain('i.src="http://localhost:9999/capture/bookmarklet?url=');
  });

  it("does not expose the token in plaintext outside the encodeURIComponent wrapper", () => {
    const token = "supersecret_token_value";
    const url = generateBookmarkletUrl(token);
    // The token must only appear inside encodeURIComponent("...")
    // and not as a bare URL parameter value
    const idx = url.indexOf(token);
    expect(idx).toBeGreaterThanOrEqual(0);
    // The characters before the token should be the encodeURIComponent(" wrapper
    const before = url.slice(Math.max(0, idx - 20), idx);
    expect(before).toContain('encodeURIComponent("');
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
    expect(url).toContain('capture/bookmarklet?url="');
    expect(url).toContain('&title="');
    expect(url).toContain('&token=');
  });

  it("copes with tokens containing special characters", () => {
    const token = "tok+en/speci@l#chars";
    const url = generateBookmarkletUrl(token);
    // The special characters appear literally inside the JavaScript string
    expect(url).toContain(`encodeURIComponent("${token}")`);
  });

  it("copes with daemon URLs containing path segments", () => {
    const daemonUrl = "http://192.168.1.1:8080/path";
    const url = generateBookmarkletUrl("tok", daemonUrl);
    expect(url).toContain('i.src="http://192.168.1.1:8080/path/capture/bookmarklet?url=');
  });

  it("generates distinct outputs for different tokens", () => {
    const url1 = generateBookmarkletUrl("token-a");
    const url2 = generateBookmarkletUrl("token-b");
    expect(url1).not.toBe(url2);
    expect(url1).toContain("token-a");
    expect(url2).toContain("token-b");
  });
});
