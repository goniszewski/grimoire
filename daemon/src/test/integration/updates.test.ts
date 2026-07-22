import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";
import { DEFAULT_UPDATE_SOURCE } from "../../update/service.js";

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

  it("GET /updates/check reports the newest compatible release from the default source", async () => {
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      return releasesResponse([
        {
          tag_name: "v1.1.0-beta.1",
          name: "Grimoire 1.1.0 beta 1",
          draft: false,
          prerelease: true,
          published_at: "2026-05-19T10:00:00Z",
          html_url: "https://github.com/goniszewski/grimoire/releases/tag/v1.1.0-beta.1",
        },
        {
          tag_name: "v1.0.1",
          name: "Grimoire 1.0.1",
          draft: false,
          prerelease: false,
          published_at: "2026-05-18T10:00:00Z",
          html_url: "https://github.com/goniszewski/grimoire/releases/tag/v1.0.1",
        },
      ]);
    }) as typeof fetch;

    const res = await app.request(`/updates/check?channel=stable`);

    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(DEFAULT_UPDATE_SOURCE);
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
      current_version: "1.0.0",
      update_available: true,
      source: DEFAULT_UPDATE_SOURCE,
      channel: "stable",
      latest: {
        version: "1.0.1",
        tag: "v1.0.1",
        name: "Grimoire 1.0.1",
        prerelease: false,
        published_at: "2026-05-18T10:00:00Z",
        url: "https://github.com/goniszewski/grimoire/releases/tag/v1.0.1",
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

  it("GET /updates/check rejects arbitrary source query parameters", async () => {
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
    expect(problem.detail).toContain("source query parameter is not accepted");
  });

  it("GET /updates/check includes the source and HTTP status when the release source fails", async () => {
    globalThis.fetch = (async (url, init) => {
      calls.push({ url: String(url), init });
      return releasesResponse({ message: "Not Found" }, 404);
    }) as typeof fetch;

    const res = await app.request(`/updates/check`);

    expect(res.status).toBe(502);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(DEFAULT_UPDATE_SOURCE);
    const problem = await res.json() as { detail?: string };
    expect(problem.detail).toBe(`Update source ${DEFAULT_UPDATE_SOURCE} returned 404: Not Found`);
  });
});
