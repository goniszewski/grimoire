import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { BookmarkRepository } from "../../db/bookmark-repository.js";
import { JobStatus } from "../../types/job.js";
import { makeTestDb } from "../helpers/db.js";

type ReprocessResponse = {
  data: {
    batch_id: string;
    mode: string;
    requested: number;
    enqueued: number;
    skipped: number;
    job_ids: string[];
    status_url: string | null;
  };
};

type ReprocessStatusResponse = {
  data: {
    batch_id: string;
    total: number;
    pending: number;
    running: number;
    done: number;
    failed: number;
  };
};

describe("Reprocess API", () => {
  let db: Database;
  let queue: JobQueue;
  let repo: BookmarkRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = makeTestDb();
    queue = new JobQueue(db);
    repo = new BookmarkRepository(db);
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });
  });

  afterEach(() => {
    db.close();
  });

  function insertBookmark(url: string, opts: { archived?: 0 | 1; trashed?: 0 | 1 } = {}) {
    const bookmark = repo.create(url, `Saved ${url}`);
    db.run(
      "UPDATE bookmarks SET status = 'indexed', is_archived = ?, is_trashed = ? WHERE id = ?",
      [opts.archived ?? 0, opts.trashed ?? 0, bookmark.id]
    );
    return repo.findByUrl(url)!;
  }

  function insertJob(bookmarkId: string, url: string, status: JobStatus, createdAt: string) {
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO jobs (id, type, status, payload, attempts, max_attempts, created_at, next_run_at)
       VALUES (?, 'ingest', ?, ?, 0, 3, ?, ?)`,
      [id, status, JSON.stringify({ bookmarkId, url }), createdAt, createdAt]
    );
    return id;
  }

  function readJob(id: string) {
    return db
      .query<{ id: string; type: string; status: string; payload: string }, [string]>(
        "SELECT id, type, status, payload FROM jobs WHERE id = ?"
      )
      .get(id);
  }

  it("enqueues a durable selected-bookmark reprocess job without duplicating the bookmark", async () => {
    const bookmark = insertBookmark("https://example.com/selected");

    const res = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "selected", bookmark_id: bookmark.id }),
    });

    expect(res.status).toBe(202);
    const json = (await res.json()) as ReprocessResponse;
    expect(json.data.mode).toBe("selected");
    expect(json.data.requested).toBe(1);
    expect(json.data.enqueued).toBe(1);
    expect(json.data.skipped).toBe(0);
    expect(json.data.job_ids).toHaveLength(1);
    expect(json.data.status_url).toBe(`/reprocess/${json.data.batch_id}`);

    const row = readJob(json.data.job_ids[0]);
    expect(row?.type).toBe("reprocess");
    expect(row?.status).toBe(JobStatus.Pending);
    expect(JSON.parse(row!.payload)).toEqual({
      bookmarkId: bookmark.id,
      url: bookmark.url,
      mode: "full",
      replaceAiFields: false,
      batchId: json.data.batch_id,
    });

    const duplicateCount = db
      .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM bookmarks WHERE url = ?")
      .get(bookmark.url)?.count;
    expect(duplicateCount).toBe(1);
  });

  it("failed-only mode enqueues only bookmarks whose latest pipeline job failed", async () => {
    const failed = insertBookmark("https://example.com/failed");
    const recovered = insertBookmark("https://example.com/recovered");
    const neverFailed = insertBookmark("https://example.com/clean");

    insertJob(failed.id, failed.url, JobStatus.Failed, "2026-01-01T00:00:00.000Z");
    insertJob(recovered.id, recovered.url, JobStatus.Failed, "2026-01-01T00:00:00.000Z");
    insertJob(recovered.id, recovered.url, JobStatus.Done, "2026-01-01T00:01:00.000Z");
    insertJob(neverFailed.id, neverFailed.url, JobStatus.Done, "2026-01-01T00:00:00.000Z");

    const res = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "failed_only" }),
    });

    expect(res.status).toBe(202);
    const json = (await res.json()) as ReprocessResponse;
    expect(json.data.requested).toBe(1);
    expect(json.data.enqueued).toBe(1);

    const row = readJob(json.data.job_ids[0]);
    const payload = JSON.parse(row!.payload) as { bookmarkId: string };
    expect(payload.bookmarkId).toBe(failed.id);
  });

  it("returns a non-pollable empty batch when all targets already have active work", async () => {
    const bookmark = insertBookmark("https://example.com/already-running");
    insertJob(bookmark.id, bookmark.url, JobStatus.Pending, "2026-01-01T00:00:00.000Z");

    const res = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "selected", bookmark_id: bookmark.id }),
    });

    expect(res.status).toBe(202);
    const json = (await res.json()) as ReprocessResponse;
    expect(json.data.requested).toBe(1);
    expect(json.data.enqueued).toBe(0);
    expect(json.data.skipped).toBe(1);
    expect(json.data.job_ids).toEqual([]);
    expect(json.data.status_url).toBeNull();

    const statusRes = await app.request(`/reprocess/${json.data.batch_id}`);
    expect(statusRes.status).toBe(404);
  });

  it("rejects non-boolean replace_ai_fields values", async () => {
    const bookmark = insertBookmark("https://example.com/invalid-replace");

    const res = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "selected",
        bookmark_id: bookmark.id,
        replace_ai_fields: "true",
      }),
    });

    expect(res.status).toBe(422);
  });

  it("all mode includes archived bookmarks but skips trashed bookmarks", async () => {
    const active = insertBookmark("https://example.com/active");
    const archived = insertBookmark("https://example.com/archived", { archived: 1 });
    const trashed = insertBookmark("https://example.com/trashed", { trashed: 1 });

    const res = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "all" }),
    });

    expect(res.status).toBe(202);
    const json = (await res.json()) as ReprocessResponse;
    expect(json.data.requested).toBe(2);
    expect(json.data.enqueued).toBe(2);

    const payloads = json.data.job_ids.map((id) => JSON.parse(readJob(id)!.payload) as { bookmarkId: string });
    expect(payloads.map((p) => p.bookmarkId).sort()).toEqual([active.id, archived.id].sort());
    expect(payloads.map((p) => p.bookmarkId)).not.toContain(trashed.id);
  });

  it("embeddings-only mode enqueues embedding refresh jobs for all non-trashed bookmarks", async () => {
    const bookmark = insertBookmark("https://example.com/embed");

    const res = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "embeddings_only" }),
    });

    expect(res.status).toBe(202);
    const json = (await res.json()) as ReprocessResponse;
    expect(json.data.requested).toBe(1);
    expect(json.data.enqueued).toBe(1);

    const payload = JSON.parse(readJob(json.data.job_ids[0])!.payload);
    expect(payload).toMatchObject({
      bookmarkId: bookmark.id,
      url: bookmark.url,
      mode: "embeddings_only",
      replaceAiFields: false,
      batchId: json.data.batch_id,
    });
  });

  it("returns pollable batch status counts for durable reprocess jobs", async () => {
    const bookmark = insertBookmark("https://example.com/status");
    const enqueueRes = await app.request("/bookmarks/reprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "selected", bookmark_id: bookmark.id }),
    });
    const enqueued = (await enqueueRes.json()) as ReprocessResponse;

    const statusRes = await app.request(`/reprocess/${enqueued.data.batch_id}`);

    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as ReprocessStatusResponse;
    expect(status.data).toMatchObject({
      batch_id: enqueued.data.batch_id,
      total: 1,
      pending: 1,
      running: 0,
      done: 0,
      failed: 0,
    });
  });
});
