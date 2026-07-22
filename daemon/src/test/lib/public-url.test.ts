import { describe, expect, it } from "bun:test";
import {
  isPublicHttpUrl,
  parsePublicHttpUrl,
  redactUrlForLog,
} from "../../lib/public-url.js";

describe("parsePublicHttpUrl", () => {
  it("accepts public http(s) URLs", () => {
    expect(parsePublicHttpUrl("https://example.com/a").ok).toBe(true);
    expect(isPublicHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects private hosts, credentials, and non-http schemes", () => {
    expect(parsePublicHttpUrl("http://127.0.0.1/x")).toEqual({ ok: false, reason: "private" });
    expect(parsePublicHttpUrl("https://user:pass@example.com/x")).toEqual({
      ok: false,
      reason: "credentials",
    });
    expect(parsePublicHttpUrl("javascript:alert(1)")).toEqual({ ok: false, reason: "protocol" });
    expect(parsePublicHttpUrl("not a url")).toEqual({ ok: false, reason: "invalid" });
  });

  it("redacts credentials and query strings for logs", () => {
    expect(redactUrlForLog("https://user:secret@example.com/path?token=1#frag")).toBe(
      "https://example.com/path"
    );
  });
});
