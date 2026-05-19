import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function releasesResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Updates API", () => {
  let app: ReturnType<typeof createApp>;
  let db: Database;
  let originalFetch: typeof globalThis.fetch;
  let calls: FetchCall[];

  beforeEach(() => {
    db = makeTestDb();
    app = createApp({ db, queue: new JobQueue(), startTime: new Date(), version: "0.0.0-test" });
    originalFetch = globalThis.fetch;
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    db.close();
  });

  it("GET /updates/check reports the newest compatible release from a configured source", async () => {
    const source = "https://updates.example.test/releases";
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      return releasesResponse([
        {
          tag_name: "v0.3.0-beta.1",
          name: "Little Imp 0.3.0 beta 1",
          draft: false,
          prerelease: true,
          published_at: "2026-05-19T10:00:00Z",
          html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.3.0-beta.1",
        },
        {
          tag_name: "v0.2.0",
          name: "Little Imp 0.2.0",
          draft: false,
          prerelease: false,
          published_at: "2026-05-18T10:00:00Z",
          html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0",
        },
      ]);
    }) as typeof fetch;

    const res = await app.request(`/updates/check?channel=stable&source=${encodeURIComponent(source)}`);

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(source);
    expect(calls[0].init?.headers).toEqual({
      accept: "application/vnd.github+json",
      "user-agent": "littleimp-update-check/0.1.0-beta",
    });
    const json = await res.json() as {
      data: {
        current_version: string;
        update_available: boolean;
        source: string;
        channel: string;
        latest: {
          version: string;
          tag: string;
          name: string;
          prerelease: boolean;
          published_at: string;
          url: string;
        } | null;
      };
    };
    expect(json.data).toEqual({
      current_version: "0.1.0-beta",
      update_available: true,
      source,
      channel: "stable",
      latest: {
        version: "0.2.0",
        tag: "v0.2.0",
        name: "Little Imp 0.2.0",
        prerelease: false,
        published_at: "2026-05-18T10:00:00Z",
        url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0",
      },
    });
  });

  it("GET /updates/check rejects invalid channels before calling the release source", async () => {
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      return releasesResponse([]);
    }) as typeof fetch;

    const res = await app.request("/updates/check?channel=nightly");

    expect(res.status).toBe(422);
    expect(calls).toHaveLength(0);
    const problem = await res.json() as { detail?: string };
    expect(problem.detail).toContain("channel must be stable or beta");
  });

  it("GET /updates/check rejects private source hosts before fetching", async () => {
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      return releasesResponse([]);
    }) as typeof fetch;

    const res = await app.request(
      `/updates/check?source=${encodeURIComponent("http://127.0.0.1:11434/releases")}`
    );

    expect(res.status).toBe(422);
    expect(calls).toHaveLength(0);
    const problem = await res.json() as { detail?: string };
    expect(problem.detail).toContain("private or loopback");
  });
});
