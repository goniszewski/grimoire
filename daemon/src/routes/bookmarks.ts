import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { JobQueue } from "../queue.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { SearchRepository } from "../db/search-repository.js";
import { log } from "../logger.js";
import { isPrivateHost } from "../lib/network.js";
import { resolveRuntimeSettings } from "../runtime-settings.js";
import { JobStatus } from "../types/job.js";
import { dismissPipelineFailure, getPipelineFailure } from "../pipeline/failures.js";

interface BookmarksDeps {
  db: Database;
  queue: JobQueue;
}

// ─── RFC 7807 problem helper ──────────────────────────────────────────────────

function problem(
  c: Context,
  status: 400 | 404 | 409 | 422 | 500,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function parseIntParam(val: string | null | undefined, fallback: number, min = 0): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : Math.max(n, min);
}

function parseBooleanFlagParam(val: string | null | undefined): 0 | 1 | undefined | "invalid" {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === "true" || val === "1") return 1;
  if (val === "false" || val === "0") return 0;
  return "invalid";
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

const bookmarkPatchFields = new Set([
  "title",
  "category_id",
  "tags",
  "is_pinned",
  "read_later",
  "is_archived",
  "read_at",
  "notes",
]);

// ─── Response envelope ────────────────────────────────────────────────────────

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data }, status);
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createBookmarksRoute(deps: BookmarksDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);
  const searchRepo = new SearchRepository(deps.db);

  // POST /bookmarks — ingest a URL
  router.post("/bookmarks", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).url !== "string"
    ) {
      return problem(c, 422, "Unprocessable Entity", "`url` field (string) is required");
    }

    const { url, title } = body as { url: string; title?: unknown };

    if (!isValidUrl(url)) {
      return problem(c, 422, "Unprocessable Entity", "Invalid URL — must be http or https");
    }

    // Idempotency: return existing active (not archived, not trashed) bookmark if URL already saved
    const existing = repo.findByUrl(url);
    if (existing) {
      if (existing.is_trashed) {
        // URL exists but is in trash — inserting would violate the UNIQUE constraint.
        return problem(c, 409, "Conflict",
          "This URL is already in your trash. Restore or permanently delete it before re-adding.");
      }
      if (existing.is_archived) {
        // URL exists but is archived — inserting would violate the UNIQUE constraint.
        return problem(c, 409, "Conflict",
          "This URL is already in your archive. Restore it from the archive before re-adding.");
      }
      // Active bookmark — return it idempotently
      const bm = repo.findById(existing.id)!;
      return ok(c, bm, 200);
    }

    const titleStr = typeof title === "string" && title.trim() ? title.trim() : undefined;
    const bookmark = repo.create(url, titleStr);

    // Enqueue the ingestion pipeline job
    const job = deps.queue.enqueue("ingest", {
      bookmarkId: bookmark.id,
      url: bookmark.url,
    });

    log.info("Bookmark ingested", { bookmarkId: bookmark.id, url, jobId: job.id });

    const bm = repo.findById(bookmark.id)!;
    return ok(c, bm, 201);
  });

  // GET /bookmarks — list with pagination + filters
  router.get("/bookmarks", (c) => {
    const archived = c.req.query("archived") === "true";
    // Archive page may have large collections; allow up to 500 for archived queries
    const maxLimit = archived ? 500 : 100;
    const limit = Math.min(parseIntParam(c.req.query("limit"), 20), maxLimit);
    const offset = parseIntParam(c.req.query("offset"), 0);
    const readLater = parseBooleanFlagParam(c.req.query("read_later"));
    if (readLater === "invalid") {
      return problem(c, 422, "Unprocessable Entity", "`read_later` must be true, false, 1, or 0");
    }

    const result = repo.list({
      limit,
      offset,
      tag: c.req.query("tag") ?? undefined,
      domain: c.req.query("domain") ?? undefined,
      category_id: c.req.query("category_id") ?? undefined,
      category: c.req.query("category") ?? undefined,
      date_from: c.req.query("date_from") ?? undefined,
      date_to: c.req.query("date_to") ?? undefined,
      read_later: readLater,
      archived,
    });

    return c.json({
      data: result.items,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        has_more: result.offset + result.items.length < result.total,
      },
    });
  });

  // GET /bookmarks/:id — single bookmark with content
  router.get("/bookmarks/:id", (c) => {
    const bm = repo.findByIdWithContent(c.req.param("id"));
    if (!bm) return problem(c, 404, "Not Found", "Bookmark not found");
    return ok(c, bm);
  });

  // PUT /bookmarks/:id — update title, tags, category
  router.put("/bookmarks/:id", async (c) => {
    const id = c.req.param("id");
    if (!repo.findById(id)) {
      return problem(c, 404, "Not Found", "Bookmark not found");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return problem(c, 422, "Unprocessable Entity", "Bookmark patch body must be a JSON object");
    }

    const patch = body as Record<string, unknown>;
    const unsupportedFields = Object.keys(patch).filter((field) => !bookmarkPatchFields.has(field));
    if (unsupportedFields.length > 0) {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        `Unsupported bookmark patch field${unsupportedFields.length === 1 ? "" : "s"}: ${unsupportedFields.join(", ")}`
      );
    }

    const allowed: Record<string, unknown> = {};

    if ("title" in patch) {
      if (patch.title !== null && (typeof patch.title !== "string" || patch.title.trim() === "")) {
        return problem(c, 422, "Unprocessable Entity", "`title` must be a non-empty string or null");
      }
      if (typeof patch.title === "string" && patch.title.length > 2000) {
        return problem(c, 422, "Unprocessable Entity", "`title` must not exceed 2000 characters");
      }
      allowed.title = patch.title as string | undefined;
    }

    if ("category_id" in patch) {
      if (patch.category_id !== null && typeof patch.category_id !== "string") {
        return problem(c, 422, "Unprocessable Entity", "`category_id` must be a string or null");
      }
      allowed.category_id = patch.category_id as string | null;
    }

    if ("tags" in patch) {
      if (
        !Array.isArray(patch.tags) ||
        (patch.tags as unknown[]).some((t) => typeof t !== "string")
      ) {
        return problem(c, 422, "Unprocessable Entity", "`tags` must be an array of strings");
      }
      if ((patch.tags as string[]).some((t) => t.length > 100)) {
        return problem(c, 422, "Unprocessable Entity", "Each tag must not exceed 100 characters");
      }
      allowed.tags = patch.tags as string[];
    }

    if ("is_pinned" in patch) {
      if (patch.is_pinned !== 0 && patch.is_pinned !== 1) {
        return problem(c, 422, "Unprocessable Entity", "`is_pinned` must be 0 or 1");
      }
      allowed.is_pinned = patch.is_pinned as 0 | 1;
    }

    if ("read_later" in patch) {
      if (patch.read_later !== 0 && patch.read_later !== 1) {
        return problem(c, 422, "Unprocessable Entity", "`read_later` must be 0 or 1");
      }
      allowed.read_later = patch.read_later as 0 | 1;
    }

    if ("is_archived" in patch) {
      if (patch.is_archived !== 0 && patch.is_archived !== 1) {
        return problem(c, 422, "Unprocessable Entity", "`is_archived` must be 0 or 1");
      }
      allowed.is_archived = patch.is_archived as 0 | 1;
    }

    if ("read_at" in patch) {
      if (patch.read_at !== null) {
        if (typeof patch.read_at !== "string" || isNaN(Date.parse(patch.read_at as string))) {
          return problem(c, 422, "Unprocessable Entity", "`read_at` must be an ISO 8601 date string or null");
        }
      }
      allowed.read_at = patch.read_at as string | null;
    }

    if ("notes" in patch) {
      if (patch.notes !== null && typeof patch.notes !== "string") {
        return problem(c, 422, "Unprocessable Entity", "`notes` must be a string or null");
      }
      if (typeof patch.notes === "string" && patch.notes.length > 100_000) {
        return problem(c, 422, "Unprocessable Entity", "`notes` must not exceed 100 000 characters");
      }
      allowed.notes = patch.notes as string | null;
    }

    const updated = repo.update(id, allowed as Parameters<BookmarkRepository["update"]>[1]);
    if (!updated) return problem(c, 404, "Not Found", "Bookmark not found");
    return ok(c, updated);
  });

  // POST /bookmarks/:id/open — record a user-triggered external open
  router.post("/bookmarks/:id/open", (c) => {
    const opened = repo.recordOpen(c.req.param("id"));
    if (!opened) return problem(c, 404, "Not Found", "Bookmark not found");
    return ok(c, opened);
  });

  // DELETE /bookmarks/:id — soft delete (moves to trash)
  router.delete("/bookmarks/:id", (c) => {
    const deleted = repo.softDelete(c.req.param("id"));
    if (!deleted) return problem(c, 404, "Not Found", "Bookmark not found");
    return c.body(null, 204);
  });

  // POST /bookmarks/:id/restore — restore from trash
  router.post("/bookmarks/:id/restore", (c) => {
    const restored = repo.restore(c.req.param("id"));
    if (!restored) return problem(c, 404, "Not Found", "Bookmark not found or not in trash");
    const bm = repo.findById(c.req.param("id"));
    if (!bm) return problem(c, 500, "Internal Server Error", "Bookmark restored but could not be fetched");
    return ok(c, bm);
  });

  // DELETE /bookmarks/:id/permanent — hard delete immediately (bookmark must be in trash)
  router.delete("/bookmarks/:id/permanent", (c) => {
    const deleted = repo.permanentDelete(c.req.param("id"));
    if (!deleted) return problem(c, 404, "Not Found", "Bookmark not found or not in trash");
    return c.body(null, 204);
  });

  // GET /trash — list trashed bookmarks
  router.get("/trash", (c) => {
    const items = repo.listTrashed();
    return ok(c, items);
  });

  // GET /bookmarks/:id/related — semantically similar bookmarks
  router.get("/bookmarks/:id/related", (c) => {
    const id = c.req.param("id");
    if (!repo.findById(id)) return problem(c, 404, "Not Found", "Bookmark not found");

    const { embeddingConfig } = resolveRuntimeSettings();
    if (!embeddingConfig) {
      return problem(c, 422, "Unprocessable Entity",
        "Related bookmarks require an embedding provider to be configured");
    }

    const limit = Math.min(
      parseInt(c.req.query("limit") ?? "10", 10) || 10,
      50
    );

    const related = searchRepo.findRelated(id, embeddingConfig.model, limit);
    return ok(c, related);
  });

  // GET /bookmarks/:id/status — pipeline job status
  router.get("/bookmarks/:id/status", (c) => {
    const id = c.req.param("id");
    const bm = repo.findById(id);
    if (!bm) return problem(c, 404, "Not Found", "Bookmark not found");

    const job = repo.getPipelineStatus(id);
    const lastFailure = getPipelineFailure(deps.db, id);

    return ok(c, {
      bookmarkId: id,
      bookmarkStatus: bm.status,
      last_failure: lastFailure,
      job: job
        ? {
            id: job.id,
            type: job.type,
            status: job.status,
            error: job.error,
            created_at: job.created_at,
            started_at: job.started_at,
            finished_at: job.finished_at,
          }
        : null,
    });
  });

  // POST /bookmarks/:id/retry — enqueue reprocessing for one bookmark
  router.post("/bookmarks/:id/retry", (c) => {
    const id = c.req.param("id");
    const bookmark = repo.findById(id);
    if (!bookmark) return problem(c, 404, "Not Found", "Bookmark not found");

    const batchId = randomUUID();
    const jobIds: string[] = [];
    let skipped = 0;

    if (hasActivePipelineJob(deps.db, id)) {
      skipped = 1;
    } else {
      const job = deps.queue.enqueue("reprocess", {
        bookmarkId: bookmark.id,
        url: bookmark.url,
        mode: "full",
        replaceAiFields: false,
        batchId,
      });
      jobIds.push(job.id);
    }

    return c.json({
      data: {
        batch_id: batchId,
        mode: "selected",
        requested: 1,
        enqueued: jobIds.length,
        skipped,
        job_ids: jobIds,
        status_url: jobIds.length > 0 ? `/reprocess/${batchId}` : null,
      },
    }, 202);
  });

  // POST /bookmarks/:id/failure/dismiss — hide the current non-blocking failure
  router.post("/bookmarks/:id/failure/dismiss", (c) => {
    const id = c.req.param("id");
    if (!repo.findById(id)) return problem(c, 404, "Not Found", "Bookmark not found");

    const latestJob = repo.getPipelineStatus(id);
    if (latestJob?.status === JobStatus.Failed) {
      return problem(
        c,
        409,
        "Conflict",
        "Blocking pipeline failures must be retried before they can be dismissed"
      );
    }

    dismissPipelineFailure(deps.db, id);
    return c.body(null, 204);
  });

  return router;
}
