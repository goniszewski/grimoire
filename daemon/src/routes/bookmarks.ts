import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { SearchRepository } from "../db/search-repository.js";
import { Config } from "../config.js";
import { log } from "../logger.js";
import { isPrivateHost } from "../lib/network.js";

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
      if (!existing.is_archived) {
        const bm = repo.findById(existing.id)!;
        return ok(c, bm, 200);
      }
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

    const result = repo.list({
      limit,
      offset,
      tag: c.req.query("tag") ?? undefined,
      domain: c.req.query("domain") ?? undefined,
      category: c.req.query("category") ?? undefined,
      date_from: c.req.query("date_from") ?? undefined,
      date_to: c.req.query("date_to") ?? undefined,
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

    const patch = body as Record<string, unknown>;
    const allowed: Record<string, unknown> = {};

    if ("title" in patch) {
      if (patch.title !== null && (typeof patch.title !== "string" || patch.title.trim() === "")) {
        return problem(c, 422, "Unprocessable Entity", "`title` must be a non-empty string or null");
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

    if ("is_pinned" in patch) {
      if (patch.is_pinned !== 0 && patch.is_pinned !== 1) {
        return problem(c, 422, "Unprocessable Entity", "`is_pinned` must be 0 or 1");
      }
      allowed.is_pinned = patch.is_pinned as 0 | 1;
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

    if (!Config.EMBEDDING_API_KEY) {
      return problem(c, 422, "Unprocessable Entity",
        "Related bookmarks require EMBEDDING_API_KEY to be configured");
    }

    const limit = Math.min(
      parseInt(c.req.query("limit") ?? "10", 10) || 10,
      50
    );

    const related = searchRepo.findRelated(id, Config.EMBEDDING_MODEL, limit);
    return ok(c, related);
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
