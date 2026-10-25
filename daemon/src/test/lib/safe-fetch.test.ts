import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { fetchFollowingSafeRedirects, isRedirectStatus } from "../../lib/safe-fetch.js";

const publicResolver = async () => ["93.184.216.34"];
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

    const response = await fetchFollowingSafeRedirects("https://catalog.example.test/start", { resolveHost: publicResolver });

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

    const response = await fetchFollowingSafeRedirects("https://catalog.example.test/models", { resolveHost: publicResolver });

    expect(response.status).toBe(304);
    expect(calls).toEqual(["https://catalog.example.test/models"]);
  });

  it("blocks a public name that resolves to a private address before any request", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("secret");
    }) as unknown as typeof fetch;

    await expect(
      fetchFollowingSafeRedirects("https://rebind.example.com/", {
        resolveHost: async () => ["169.254.169.254"],
      })
    ).rejects.toThrow(/private host blocked/);
    expect(called).toBe(false);
  });

  it("re-resolves every redirect hop and blocks a hop that resolves privately", async () => {
    const requested: string[] = [];
    globalThis.fetch = (async (input) => {
      requested.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: "https://internal.example.com/admin" },
      });
    }) as typeof fetch;

    const resolveHost = async (host: string) =>
      host === "internal.example.com" ? ["10.0.0.5"] : ["93.184.216.34"];

    await expect(
      fetchFollowingSafeRedirects("https://start.example.com/", { resolveHost })
    ).rejects.toThrow(/private host blocked/);
    expect(requested).toEqual(["https://start.example.com/"]);
  });

  it("still resolves when the caller skips the initial syntactic check", async () => {
    globalThis.fetch = (async () => new Response("ok")) as unknown as typeof fetch;
    await expect(
      fetchFollowingSafeRedirects("https://rebind.example.com/", {
        skipInitialHostCheck: true,
        resolveHost: async () => ["127.0.0.1"],
      })
    ).rejects.toThrow(/private host blocked/);
  });
});
