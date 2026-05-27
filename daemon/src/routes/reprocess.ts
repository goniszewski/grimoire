import { randomUUID } from "crypto";
import { Hono, Context } from "hono";
import type { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { JobStatus, type ReprocessJobMode } from "../types/job.js";
import { log } from "../logger.js";

interface ReprocessDeps {
  db: Database;
  queue: JobQueue;
}

type ReprocessRequestMode = "selected" | "failed_only" | "all" | "embeddings_only";

interface ReprocessTarget {
  id: string;
  url: string;
}

function problem(
  c: Context,
  status: 400 | 404 | 422,
  title: string,
  detail?: string
) {
  return c.json(
    {
      type: `https://littleimp.app/problems/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status,
      detail,
    },
    status,
    { "Content-Type": "application/problem+json" }
  );
}

function ok<T>(c: Context, data: T, status: 200 | 202 = 200) {
  return c.json({ data }, status);
}

function parseMode(raw: unknown): ReprocessRequestMode | null {
  if (
    raw === "selected" ||
    raw === "failed_only" ||
    raw === "all" ||
    raw === "embeddings_only"
  ) {
    return raw;
  }
  return null;
}

function hasActivePipelineJob(db: Database, bookmarkId: string): boolean {
  const row = db
    .query<{ count: number }, [string, JobStatus, JobStatus]>(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE json_extract(payload, '$.bookmarkId') = ?
         AND type IN ('ingest', 'reprocess')
         AND status IN (?, ?)`
    )
    .get(bookmarkId, JobStatus.Pending, JobStatus.Running);
  return (row?.count ?? 0) > 0;
}

function getAllTargets(db: Database): ReprocessTarget[] {
  return db
    .query<ReprocessTarget, []>(
      `SELECT id, url
       FROM bookmarks
       WHERE is_trashed = 0
       ORDER BY created_at DESC`
    )
    .all();
}

function getFailedTargets(db: Database): ReprocessTarget[] {
  return db
    .query<ReprocessTarget, [JobStatus]>(
      `SELECT b.id, b.url
       FROM bookmarks b
       WHERE b.is_trashed = 0
         AND (
           EXISTS (
             SELECT 1
             FROM pipeline_failures pf
             WHERE pf.bookmark_id = b.id
               AND pf.dismissed_at IS NULL
           )
           OR (
             SELECT j.status
             FROM jobs j
             WHERE json_extract(j.payload, '$.bookmarkId') = b.id
               AND j.type IN ('ingest', 'reprocess')
             ORDER BY j.created_at DESC
             LIMIT 1
           ) = ?
         )
       ORDER BY b.created_at DESC`
    )
    .all(JobStatus.Failed);
}

function getBatchStatus(db: Database, batchId: string) {
  const rows = db
    .query<{ status: JobStatus; count: number }, [string]>(
      `SELECT status, COUNT(*) AS count
       FROM jobs
       WHERE type = 'reprocess'
         AND json_extract(payload, '$.batchId') = ?
       GROUP BY status`
    )
    .all(batchId);

  const counts = {
    pending: 0,
    running: 0,
    done: 0,
    failed: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.count;
  }

  return {
    batch_id: batchId,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    ...counts,
  };
}

export function createReprocessRoute(deps: ReprocessDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);

  router.post("/bookmarks/reprocess", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    if (typeof body !== "object" || body === null) {
      return problem(c, 422, "Unprocessable Entity", "Request body must be an object");
    }

    const request = body as Record<string, unknown>;
    const mode = parseMode(request.mode);
    if (!mode) {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        "`mode` must be selected, failed_only, all, or embeddings_only"
      );
    }
    if ("replace_ai_fields" in request && typeof request.replace_ai_fields !== "boolean") {
      return problem(c, 422, "Unprocessable Entity", "`replace_ai_fields` must be a boolean");
    }

    let targets: ReprocessTarget[];
    if (mode === "selected") {
      if (typeof request.bookmark_id !== "string" || !request.bookmark_id.trim()) {
        return problem(c, 422, "Unprocessable Entity", "`bookmark_id` is required for selected mode");
      }
      const bookmark = repo.findById(request.bookmark_id);
      if (!bookmark) return problem(c, 404, "Not Found", "Bookmark not found");
      targets = [{ id: bookmark.id, url: bookmark.url }];
    } else if (mode === "failed_only") {
      targets = getFailedTargets(deps.db);
    } else {
      targets = getAllTargets(deps.db);
    }

    const batchId = randomUUID();
    const jobMode: ReprocessJobMode = mode === "embeddings_only" ? "embeddings_only" : "full";
    const replaceAiFields = request.replace_ai_fields === true;
    const jobIds: string[] = [];
    let skipped = 0;

    for (const target of targets) {
      if (hasActivePipelineJob(deps.db, target.id)) {
        skipped++;
        continue;
      }

      const job = deps.queue.enqueue("reprocess", {
        bookmarkId: target.id,
        url: target.url,
        mode: jobMode,
        replaceAiFields,
        batchId,
      });
      jobIds.push(job.id);
    }

    log.info("Reprocess batch enqueued", {
      batchId,
      mode,
      requested: targets.length,
      enqueued: jobIds.length,
      skipped,
    });

    return ok(c, {
      batch_id: batchId,
      mode,
      requested: targets.length,
      enqueued: jobIds.length,
      skipped,
      job_ids: jobIds,
      status_url: jobIds.length > 0 ? `/reprocess/${batchId}` : null,
    }, 202);
  });

  router.get("/reprocess/:batchId", (c) => {
    const batchId = c.req.param("batchId");
    const status = getBatchStatus(deps.db, batchId);
    if (status.total === 0) return problem(c, 404, "Not Found", "Reprocess batch not found");
    return ok(c, status);
  });

  return router;
}
