/**
 * POST /import — Netscape HTML bookmark file import.
 *
 * Accepts multipart/form-data with a `file` field containing a .html bookmark
 * export from Chrome, Firefox, Safari, or Edge.
 *
 * Returns an import summary immediately after parsing.
 * Each bookmark is enqueued as an "ingest" job for the background pipeline.
 *
 * GET /import/:importId/progress — SSE stream for real-time progress.
 */

import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import {
  parseNetscapeBookmarks,
  type ParsedBookmark,
  type ParsedFolder,
} from "../import/netscape-parser.js";
import { log } from "../logger.js";

interface ImportDeps {
  db: Database;
  queue: JobQueue;
}

// ─── RFC 7807 problem helper ──────────────────────────────────────────────────

function problem(
  c: Context,
  status: 400 | 413 | 415 | 422 | 500,
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

// ─── In-memory progress store ─────────────────────────────────────────────────
// Maps importId → array of SSE event strings waiting to be sent.
// Cleaned up after the SSE stream closes.

interface ProgressState {
  queued: number;
  skipped: number;
  total: number;
  folders: number;
  categoriesCreated: number;
  categoriesReused: number;
  done: boolean;
  error?: string;
}

const progressMap = new Map<string, ProgressState>();

// ─── Max upload size: 10 MB ───────────────────────────────────────────────────
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_CATEGORY_LEVELS = 3;
const MAX_IMPORT_CATEGORY_NAME_LENGTH = 100;

// TTL for progress entries not consumed by an SSE client (5 minutes).
const PROGRESS_TTL_MS = 5 * 60 * 1000;

function scheduleProgressCleanup(importId: string): void {
  setTimeout(() => {
    progressMap.delete(importId);
  }, PROGRESS_TTL_MS);
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createImportRoute(deps: ImportDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);

  // POST /import
  router.post("/import", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return problem(c, 415, "Unsupported Media Type", "Request must be multipart/form-data");
    }

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return problem(c, 400, "Bad Request", "Failed to parse multipart body");
    }

    const fileField = formData.get("file");
    if (!fileField || typeof fileField === "string") {
      return problem(c, 422, "Unprocessable Entity", "A `file` field is required");
    }

    const file = fileField as File;

    // Pre-check from Content-Disposition header (fast path, client-supplied).
    if (file.size > MAX_BYTES) {
      return problem(c, 413, "Payload Too Large", `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit`);
    }

    const text = await file.text();

    // Enforce the cap on actual decoded byte length — clients can lie about file.size.
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      return problem(c, 413, "Payload Too Large", `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit`);
    }

    // Basic sanity check: must look like a Netscape bookmark file
    if (!/<A\s/i.test(text) && !/<DL/i.test(text)) {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        "File does not appear to be a Netscape bookmark HTML export"
      );
    }

    const { bookmarks, folders, warnings } = parseNetscapeBookmarks(text);

    if (warnings.length > 0) {
      log.warn("Import: parser warnings", { count: warnings.length, sample: warnings.slice(0, 3) });
    }

    // Generate a stable import ID for the SSE progress stream
    const importId = crypto.randomUUID();

    // Initialise progress state before spawning background work.
    // Schedule a TTL cleanup in case no SSE client ever connects.
    progressMap.set(importId, {
      queued: 0,
      skipped: 0,
      total: bookmarks.length,
      folders: folders.length,
      categoriesCreated: 0,
      categoriesReused: 0,
      done: false,
    });
    scheduleProgressCleanup(importId);

    // Process bookmarks in the background — don't block the HTTP response
    processImport(importId, bookmarks, folders, repo, categoryRepo, deps.queue).catch((err) => {
      const state = progressMap.get(importId);
      if (state) {
        state.done = true;
        state.error = err instanceof Error ? err.message : String(err);
      }
      log.error("Import: background processing failed", {
        importId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    log.info("Import: started", {
      importId,
      total: bookmarks.length,
      folders: folders.length,
      warnings: warnings.length,
    });

    return c.json({
      data: {
        importId,
        total: bookmarks.length,
        folders: folders.length,
        warnings: warnings.length,
        progressUrl: `/import/${importId}/progress`,
      },
    });
  });

  // GET /import/:importId/progress — SSE stream
  router.get("/import/:importId/progress", (c) => {
    const importId = c.req.param("importId");

    if (!progressMap.has(importId)) {
      return c.json(
        {
          type: "https://littleimp.app/problems/not-found",
          title: "Not Found",
          status: 404,
          detail: "Import ID not found",
        },
        404,
        { "Content-Type": "application/problem+json" }
      );
    }

    // Server-Sent Events
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();

        function send(event: string, data: unknown) {
          // Strip CR/LF to prevent SSE protocol injection.
          const safeEvent = event.replace(/[\r\n]/g, "");
          const payload = `event: ${safeEvent}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(enc.encode(payload));
        }

        function poll() {
          // Guard against both client-disconnect (cancelled) and a previous
          // iteration already closing the controller (closed flag below).
          if (cancelled) return;

          const state = progressMap.get(importId);
          if (!state) {
            // State was cleaned up externally; close only if not cancelled.
            if (!cancelled) controller.close();
            return;
          }

          send("progress", {
            queued: state.queued,
            skipped: state.skipped,
            total: state.total,
            folders: state.folders,
            categoriesCreated: state.categoriesCreated,
            categoriesReused: state.categoriesReused,
            done: state.done,
            error: state.error ?? null,
          });

          if (state.done) {
            progressMap.delete(importId);
            cancelled = true; // prevent any further enqueue/close after this
            controller.close();
            return;
          }

          // Poll every 250 ms
          setTimeout(poll, 250);
        }

        // Send initial event immediately
        poll();
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  return router;
}

// ─── Background processor ─────────────────────────────────────────────────────

async function processImport(
  importId: string,
  bookmarks: ParsedBookmark[],
  folders: ParsedFolder[],
  repo: BookmarkRepository,
  categoryRepo: CategoryRepository,
  queue: JobQueue
): Promise<void> {
  const state = progressMap.get(importId);
  if (!state) return;

  const categoryPathCache = new Map<string, string>();
  const categoryStats = { created: 0, reused: 0 };

  for (const folder of folders) {
    ensureImportCategoryPath(folder.path, categoryRepo, categoryPathCache, categoryStats);
  }

  state.categoriesCreated = categoryStats.created;
  state.categoriesReused = categoryStats.reused;

  // Process in batches to avoid blocking the event loop for large imports
  const BATCH_SIZE = 50;

  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batch = bookmarks.slice(i, i + BATCH_SIZE);

    for (const bm of batch) {
      // Deduplication: skip if URL already exists and is not archived
      const existing = repo.findByUrl(bm.url);
      if (existing && !existing.is_archived) {
        state.skipped++;
        continue;
      }

      const categoryId = bm.folders.length > 0
        ? ensureImportCategoryPath(bm.folders, categoryRepo, categoryPathCache, categoryStats)
        : null;

      state.categoriesCreated = categoryStats.created;
      state.categoriesReused = categoryStats.reused;

      // Create bookmark record
      const created = repo.create(bm.url, bm.title, categoryId);

      // Apply tags derived from Netscape TAGS attribute
      if (bm.tags.length > 0) {
        repo.setTags(created.id, bm.tags);
      }

      // Enqueue ingest pipeline job
      queue.enqueue("ingest", { bookmarkId: created.id, url: bm.url });

      state.queued++;
    }

    // Yield to event loop between batches
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  state.done = true;
  log.info("Import: complete", {
    importId,
    queued: state.queued,
    skipped: state.skipped,
    categoriesCreated: state.categoriesCreated,
    categoriesReused: state.categoriesReused,
  });
}

function ensureImportCategoryPath(
  path: string[],
  categoryRepo: CategoryRepository,
  cache: Map<string, string>,
  stats: { created: number; reused: number }
): string | null {
  let parentId: string | null = null;
  let currentId: string | null = null;
  const segments: string[] = [];

  for (const name of importCategorySegments(path)) {
    segments.push(name);
    const key = JSON.stringify(segments);
    const cached = cache.get(key);
    if (cached) {
      parentId = cached;
      currentId = cached;
      continue;
    }

    const existing = categoryRepo.findByNameAndParent(name, parentId);
    if (existing) {
      cache.set(key, existing.id);
      parentId = existing.id;
      currentId = existing.id;
      stats.reused++;
      continue;
    }

    const created = categoryRepo.create(name, parentId);
    cache.set(key, created.id);
    parentId = created.id;
    currentId = created.id;
    stats.created++;
  }

  return currentId;
}

function importCategorySegments(path: string[]): string[] {
  return path
    .map((segment) => segment.trim())
    .map((segment) => segment.slice(0, MAX_IMPORT_CATEGORY_NAME_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_IMPORT_CATEGORY_LEVELS);
}
