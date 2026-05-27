import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { BookmarkRepository } from "../../db/bookmark-repository.js";
import { runPipeline } from "../../pipeline/pipeline.js";
import { JobStatus } from "../../types/job.js";
import { makeTestDb } from "../helpers/db.js";
import { mockFetch } from "../helpers/fetch.js";

type StatusResponse = {
  data: {
    bookmarkId: string;
    bookmarkStatus: string;
    last_failure: null | {
      stage: string;
      message: string;
      configuration_related: boolean;
      retryable: boolean;
      failed_at: string;
      dismissed_at: string | null;
    };
  };
};

type RetryResponse = {
  data: {
    mode: string;
    requested: number;
    enqueued: number;
    skipped: number;
    job_ids: string[];
  };
};

function withUrl(res: Response, url: string): Response {
  return new Proxy(res, {
    get(target, prop) {
      if (prop === "url") return url;
      const val = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

describe("Pipeline recovery API", () => {
  let db: Database;
  let queue: JobQueue;
  let repo: BookmarkRepository;
  let app: ReturnType<typeof createApp>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    db = makeTestDb();
    queue = new JobQueue(db);
    repo = new BookmarkRepository(db);
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    db.close();
  });

  function insertBookmark(url: string) {
    return repo.create(url, `Saved ${url}`);
  }

  it("records fetch failures in bookmark pipeline status", async () => {
    const bookmark = insertBookmark("https://example.com/missing");
    globalThis.fetch = mockFetch(async () =>
      withUrl(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
        bookmark.url
      )
    );

    await expect(runPipeline(db, { bookmarkId: bookmark.id, url: bookmark.url })).rejects.toThrow("HTTP 404");

    const statusRes = await app.request(`/bookmarks/${bookmark.id}/status`);
    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as StatusResponse;

    expect(status.data.bookmarkStatus).toBe("saved");
    expect(status.data.last_failure).toMatchObject({
      stage: "fetch",
      message: expect.stringContaining("HTTP 404"),
      configuration_related: false,
      retryable: true,
      dismissed_at: null,
    });
    expect(Date.parse(status.data.last_failure!.failed_at)).not.toBeNaN();
  });

  it("retries one failed bookmark without creating a duplicate bookmark", async () => {
    const bookmark = insertBookmark("https://example.com/retry-one");
    db.run(
      `INSERT INTO pipeline_failures (bookmark_id, stage, message, configuration_related, retryable)
       VALUES (?, 'fetch', 'HTTP 500: Server Error', 0, 1)`,
      [bookmark.id]
    );

    const res = await app.request(`/bookmarks/${bookmark.id}/retry`, { method: "POST" });

    expect(res.status).toBe(202);
    const json = (await res.json()) as RetryResponse;
    expect(json.data.mode).toBe("selected");
    expect(json.data.requested).toBe(1);
    expect(json.data.enqueued).toBe(1);
    expect(json.data.skipped).toBe(0);
    expect(json.data.job_ids).toHaveLength(1);

    const duplicateCount = db
      .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM bookmarks WHERE url = ?")
      .get(bookmark.url)?.count;
    expect(duplicateCount).toBe(1);
  });

  it("dismisses a non-blocking pipeline failure from bookmark status", async () => {
    const bookmark = insertBookmark("https://example.com/dismiss");
    db.run(
      `INSERT INTO pipeline_failures (bookmark_id, stage, message, configuration_related, retryable)
       VALUES (?, 'ai_enrich', 'Provider API key is invalid', 1, 1)`,
      [bookmark.id]
    );

    const dismissRes = await app.request(`/bookmarks/${bookmark.id}/failure/dismiss`, { method: "POST" });
    expect(dismissRes.status).toBe(204);

    const statusRes = await app.request(`/bookmarks/${bookmark.id}/status`);
    const status = (await statusRes.json()) as StatusResponse;
    expect(status.data.last_failure).toBeNull();
  });

  it("does not dismiss blocking failed jobs", async () => {
    const bookmark = insertBookmark("https://example.com/blocking");
    db.run(
      `INSERT INTO pipeline_failures (bookmark_id, stage, message, configuration_related, retryable)
       VALUES (?, 'fetch', 'HTTP 500: Server Error', 0, 1)`,
      [bookmark.id]
    );
    db.run(
      `INSERT INTO jobs (
         id, type, status, payload, error, attempts, max_attempts, created_at, next_run_at, finished_at
       )
       VALUES (?, 'ingest', ?, ?, 'HTTP 500: Server Error', 3, 3, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        JobStatus.Failed,
        JSON.stringify({ bookmarkId: bookmark.id, url: bookmark.url }),
        "2026-01-01T00:00:00Z",
        "2026-01-01T00:00:00Z",
        "2026-01-01T00:00:00Z",
      ]
    );

    const dismissRes = await app.request(`/bookmarks/${bookmark.id}/failure/dismiss`, { method: "POST" });
    expect(dismissRes.status).toBe(409);

    const statusRes = await app.request(`/bookmarks/${bookmark.id}/status`);
    const status = (await statusRes.json()) as StatusResponse;
    expect(status.data.last_failure).toMatchObject({
      stage: "fetch",
      dismissed_at: null,
    });
  });
});
