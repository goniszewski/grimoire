import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { fetchFollowingSafeRedirects, isRedirectStatus } from "../../lib/safe-fetch.js";

let fetchBeforeTest: typeof fetch;

beforeEach(() => {
  fetchBeforeTest = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = fetchBeforeTest;
});

describe("safe fetch", () => {
  it("only classifies Fetch redirect statuses as redirects", () => {
    expect([301, 302, 303, 307, 308].every(isRedirectStatus)).toBe(true);
    expect([300, 304, 305, 306, 400].some(isRedirectStatus)).toBe(false);
  });

  it("follows public redirects with manual validation", async () => {
    const calls: Array<{ url: string; redirect: RequestRedirect | undefined }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), redirect: init?.redirect });
      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://catalog.example.test/models" },
        });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }) as typeof fetch;

    const response = await fetchFollowingSafeRedirects("https://catalog.example.test/start");

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { url: "https://catalog.example.test/start", redirect: "manual" },
      { url: "https://catalog.example.test/models", redirect: "manual" },
    ]);
  });

  it("returns non-redirect 3xx responses without requiring a Location header", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input) => {
      calls.push(String(input));
      return new Response(null, { status: 304 });
    }) as typeof fetch;

    const response = await fetchFollowingSafeRedirects("https://catalog.example.test/models");

    expect(response.status).toBe(304);
    expect(calls).toEqual(["https://catalog.example.test/models"]);
  });
});
