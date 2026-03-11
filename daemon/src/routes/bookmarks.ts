import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { log } from "../logger.js";

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
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseIntParam(val: string | null | undefined, fallback: number, min = 0): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : Math.max(n, min);
}

// ─── Response envelope ────────────────────────────────────────────────────────

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data }, status);
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createBookmarksRoute(deps: BookmarksDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);

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

    // Idempotency: return existing non-archived bookmark if URL already saved
    const existing = repo.findByUrl(url);
    if (existing && !existing.is_archived) {
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
    const limit = Math.min(parseIntParam(c.req.query("limit"), 20), 100);
    const offset = parseIntParam(c.req.query("offset"), 0);

    const result = repo.list({
      limit,
      offset,
      tag: c.req.query("tag") ?? undefined,
      domain: c.req.query("domain") ?? undefined,
      category: c.req.query("category") ?? undefined,
      date_from: c.req.query("date_from") ?? undefined,
      date_to: c.req.query("date_to") ?? undefined,
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

    const patch = body as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};

    if ("title" in patch) {
      if (patch.title !== null && typeof patch.title !== "string") {
        return problem(c, 422, "Unprocessable Entity", "`title` must be a string or null");
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
      allowed.tags = patch.tags as string[];
    }

    const updated = repo.update(id, allowed as Parameters<BookmarkRepository["update"]>[1]);
    return ok(c, updated);
  });

  // DELETE /bookmarks/:id — soft delete
  router.delete("/bookmarks/:id", (c) => {
    const deleted = repo.softDelete(c.req.param("id"));
    if (!deleted) return problem(c, 404, "Not Found", "Bookmark not found");
    return c.body(null, 204);
  });

  // GET /bookmarks/:id/status — pipeline job status
  router.get("/bookmarks/:id/status", (c) => {
    const id = c.req.param("id");
    const bm = repo.findById(id);
    if (!bm) return problem(c, 404, "Not Found", "Bookmark not found");

    const job = repo.getPipelineStatus(id);

    return ok(c, {
      bookmarkId: id,
      bookmarkStatus: bm.status,
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

  return router;
}
