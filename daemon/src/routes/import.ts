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
  type ParsedSkippedBookmark,
  type ParseResult,
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
  merged: number;
  restored: number;
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

const IMPORT_ROW_CLASSIFICATIONS = [
  "new",
  "active_duplicate",
  "archived_duplicate",
  "trashed_duplicate",
  "invalid_url",
  "private_url",
] as const;

type ImportRowClassification = (typeof IMPORT_ROW_CLASSIFICATIONS)[number];
type ActiveDuplicatePolicy = "skip" | "merge";
type RestoreDuplicatePolicy = "skip" | "restore_merge";

interface ImportDuplicatePolicy {
  active: ActiveDuplicatePolicy;
  archived: RestoreDuplicatePolicy;
  trashed: RestoreDuplicatePolicy;
}

interface ImportPreviewRow {
  classification: ImportRowClassification;
  action: "create" | "skip" | "merge" | "restore_merge";
  url: string | null;
  title: string;
  notes: string | null;
  tags: string[];
  folders: string[];
  existingBookmarkId: string | null;
  existingState: "active" | "archived" | "trashed" | null;
  skipReason: string | null;
  sourceIndex: number;
  bookmark?: ParsedBookmark;
}

interface ImportPreviewSummary {
  totalRows: number;
  importableRows: number;
  new: number;
  activeDuplicates: number;
  archivedDuplicates: number;
  trashedDuplicates: number;
  invalidUrls: number;
  privateUrls: number;
  created: number;
  merged: number;
  restored: number;
  skipped: number;
}

interface ImportAnalysis {
  duplicatePolicy: ImportDuplicatePolicy;
  summary: ImportPreviewSummary;
  rows: ImportPreviewRow[];
  folders: string[][];
  tags: string[];
  warnings: string[];
}

const DEFAULT_DUPLICATE_POLICY: ImportDuplicatePolicy = {
  active: "skip",
  archived: "skip",
  trashed: "skip",
};

// TTL for progress entries not consumed by an SSE client (5 minutes).
const PROGRESS_TTL_MS = 5 * 60 * 1000;

function scheduleProgressCleanup(importId: string): void {
  setTimeout(() => {
    progressMap.delete(importId);
  }, PROGRESS_TTL_MS);
}

async function readImportRequest(c: Context): Promise<{ text: string; formData: FormData } | Response> {
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

  return { text, formData };
}

function parseDuplicatePolicy(formData: FormData): ImportDuplicatePolicy | string {
  const raw = formData.get("duplicatePolicy");
  if (raw === null) return { ...DEFAULT_DUPLICATE_POLICY };
  if (typeof raw !== "string") {
    return "`duplicatePolicy` must be a JSON object string";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "`duplicatePolicy` must be valid JSON";
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "`duplicatePolicy` must be a JSON object";
  }

  const input = parsed as Record<string, unknown>;
  const policy: ImportDuplicatePolicy = { ...DEFAULT_DUPLICATE_POLICY };

  if ("active" in input) {
    if (input.active !== "skip" && input.active !== "merge") {
      return "`duplicatePolicy.active` must be \"skip\" or \"merge\"";
    }
    policy.active = input.active;
  }

  if ("archived" in input) {
    if (input.archived !== "skip" && input.archived !== "restore_merge") {
      return "`duplicatePolicy.archived` must be \"skip\" or \"restore_merge\"";
    }
    policy.archived = input.archived;
  }

  if ("trashed" in input) {
    if (input.trashed !== "skip" && input.trashed !== "restore_merge") {
      return "`duplicatePolicy.trashed` must be \"skip\" or \"restore_merge\"";
    }
    policy.trashed = input.trashed;
  }

  return policy;
}

function classifySkippedBookmark(skipped: ParsedSkippedBookmark): ImportRowClassification {
  return skipped.reason === "private_url" ? "private_url" : "invalid_url";
}

function analyzeImport(
  parsed: ParseResult,
  repo: BookmarkRepository,
  duplicatePolicy: ImportDuplicatePolicy
): ImportAnalysis {
  const existingByUrl = new Map(
    repo.findByUrls(parsed.bookmarks.map((bookmark) => bookmark.url)).map((row) => [row.url, row])
  );
  const seenNewUrls = new Set<string>();
  const rows: ImportPreviewRow[] = [];
  const summary: ImportPreviewSummary = {
    totalRows: parsed.bookmarks.length + parsed.skipped.length,
    importableRows: parsed.bookmarks.length,
    new: 0,
    activeDuplicates: 0,
    archivedDuplicates: 0,
    trashedDuplicates: 0,
    invalidUrls: 0,
    privateUrls: 0,
    created: 0,
    merged: 0,
    restored: 0,
    skipped: 0,
  };

  for (const bookmark of parsed.bookmarks) {
    const existing = existingByUrl.get(bookmark.url);
    let classification: ImportRowClassification = "new";
    let action: ImportPreviewRow["action"] = "create";
    let existingState: ImportPreviewRow["existingState"] = null;

    if (existing?.is_trashed) {
      classification = "trashed_duplicate";
      existingState = "trashed";
      action = duplicatePolicy.trashed === "restore_merge" ? "restore_merge" : "skip";
      summary.trashedDuplicates++;
    } else if (existing?.is_archived) {
      classification = "archived_duplicate";
      existingState = "archived";
      action = duplicatePolicy.archived === "restore_merge" ? "restore_merge" : "skip";
      summary.archivedDuplicates++;
    } else if (existing) {
      classification = "active_duplicate";
      existingState = "active";
      action = duplicatePolicy.active === "merge" ? "merge" : "skip";
      summary.activeDuplicates++;
    } else if (seenNewUrls.has(bookmark.url)) {
      classification = "active_duplicate";
      existingState = "active";
      action = duplicatePolicy.active === "merge" ? "merge" : "skip";
      summary.activeDuplicates++;
    } else {
      summary.new++;
      seenNewUrls.add(bookmark.url);
    }

    if (action === "create") summary.created++;
    if (action === "merge") summary.merged++;
    if (action === "restore_merge") summary.restored++;
    if (action === "skip") summary.skipped++;

    rows.push({
      classification,
      action,
      url: bookmark.url,
      title: bookmark.title,
      notes: bookmark.notes,
      tags: bookmark.tags,
      folders: bookmark.folders,
      existingBookmarkId: existing?.id ?? null,
      existingState,
      skipReason: action === "skip" ? classification : null,
      sourceIndex: bookmark.index,
      bookmark,
    });
  }

  for (const skipped of parsed.skipped) {
    const classification = classifySkippedBookmark(skipped);
    if (classification === "private_url") summary.privateUrls++;
    else summary.invalidUrls++;
    summary.skipped++;

    rows.push({
      classification,
      action: "skip",
      url: skipped.url,
      title: skipped.title,
      notes: null,
      tags: skipped.tags,
      folders: skipped.folders,
      existingBookmarkId: null,
      existingState: null,
      skipReason: skipped.message,
      sourceIndex: skipped.index,
    });
  }

  rows.sort((a, b) => a.sourceIndex - b.sourceIndex);

  const tagSet = new Set<string>();
  for (const bookmark of parsed.bookmarks) {
    for (const tag of bookmark.tags) tagSet.add(tag);
  }

  return {
    duplicatePolicy,
    summary,
    rows,
    folders: parsed.folders.map((folder) => folder.path),
    tags: [...tagSet].sort((a, b) => a.localeCompare(b)),
    warnings: parsed.warnings,
  };
}

function importPreviewPayload(analysis: ImportAnalysis) {
  return {
    duplicatePolicy: analysis.duplicatePolicy,
    summary: analysis.summary,
    folders: analysis.folders,
    tags: analysis.tags,
    warnings: analysis.warnings,
    rows: analysis.rows.map(({ bookmark: _bookmark, sourceIndex: _sourceIndex, ...row }) => row),
  };
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createImportRoute(deps: ImportDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);

  // POST /import/preview
  router.post("/import/preview", async (c) => {
    const input = await readImportRequest(c);
    if (input instanceof Response) return input;

    const duplicatePolicy = parseDuplicatePolicy(input.formData);
    if (typeof duplicatePolicy === "string") {
      return problem(c, 422, "Unprocessable Entity", duplicatePolicy);
    }

    const parsed = parseNetscapeBookmarks(input.text);
    if (parsed.warnings.length > 0) {
      log.warn("Import preview: parser warnings", { count: parsed.warnings.length, sample: parsed.warnings.slice(0, 3) });
    }

    const analysis = analyzeImport(parsed, repo, duplicatePolicy);
    return c.json({ data: importPreviewPayload(analysis) });
  });

  // POST /import
  router.post("/import", async (c) => {
    const input = await readImportRequest(c);
    if (input instanceof Response) return input;

    const duplicatePolicy = parseDuplicatePolicy(input.formData);
    if (typeof duplicatePolicy === "string") {
      return problem(c, 422, "Unprocessable Entity", duplicatePolicy);
    }

    const parsed = parseNetscapeBookmarks(input.text);
    const analysis = analyzeImport(parsed, repo, duplicatePolicy);

    if (parsed.warnings.length > 0) {
      log.warn("Import: parser warnings", { count: parsed.warnings.length, sample: parsed.warnings.slice(0, 3) });
    }

    // Generate a stable import ID for the SSE progress stream
    const importId = crypto.randomUUID();

    // Initialise progress state before spawning background work.
    // Schedule a TTL cleanup in case no SSE client ever connects.
    progressMap.set(importId, {
      queued: 0,
      skipped: 0,
      merged: 0,
      restored: 0,
      total: analysis.summary.totalRows,
      folders: analysis.folders.length,
      categoriesCreated: 0,
      categoriesReused: 0,
      done: false,
    });
    scheduleProgressCleanup(importId);

    // Process bookmarks in the background — don't block the HTTP response
    processImport(importId, analysis, repo, categoryRepo, deps.queue).catch((err) => {
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
      total: analysis.summary.totalRows,
      folders: analysis.folders.length,
      warnings: parsed.warnings.length,
    });

    return c.json({
      data: {
        importId,
        total: analysis.summary.totalRows,
        folders: analysis.folders.length,
        warnings: parsed.warnings.length,
        duplicatePolicy,
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
            merged: state.merged,
            restored: state.restored,
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
  analysis: ImportAnalysis,
  repo: BookmarkRepository,
  categoryRepo: CategoryRepository,
  queue: JobQueue
): Promise<void> {
  const state = progressMap.get(importId);
  if (!state) return;

  const categoryPathCache = new Map<string, string>();
  const categoryStats = { created: 0, reused: 0 };
  const createdByUrl = new Map<string, string>();

  for (const folderPath of analysis.folders) {
    ensureImportCategoryPath(folderPath, categoryRepo, categoryPathCache, categoryStats);
  }

  state.categoriesCreated = categoryStats.created;
  state.categoriesReused = categoryStats.reused;

  // Process in batches to avoid blocking the event loop for large imports
  const BATCH_SIZE = 50;

  for (let i = 0; i < analysis.rows.length; i += BATCH_SIZE) {
    const batch = analysis.rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      if (row.action === "skip") {
        state.skipped++;
        continue;
      }

      const bm = row.bookmark;
      if (!bm) {
        state.skipped++;
        continue;
      }

      const categoryId = bm.folders.length > 0
        ? ensureImportCategoryPath(bm.folders, categoryRepo, categoryPathCache, categoryStats)
        : null;

      state.categoriesCreated = categoryStats.created;
      state.categoriesReused = categoryStats.reused;

      if (row.action === "merge" || row.action === "restore_merge") {
        const targetId = row.existingBookmarkId ?? createdByUrl.get(bm.url) ?? repo.findByUrl(bm.url)?.id ?? null;
        if (!targetId) {
          state.skipped++;
          continue;
        }
        repo.mergeImportDuplicate(targetId, {
          tags: bm.tags,
          category_id: categoryId,
          notes: bm.notes,
          restore: row.action === "restore_merge",
        });
        if (row.action === "merge") state.merged++;
        else state.restored++;
        continue;
      }

      const existingAtCommit = repo.findByUrl(bm.url);
      if (existingAtCommit) {
        if (existingAtCommit.is_trashed && analysis.duplicatePolicy.trashed === "restore_merge") {
          repo.mergeImportDuplicate(existingAtCommit.id, {
            tags: bm.tags,
            category_id: categoryId,
            notes: bm.notes,
            restore: true,
          });
          state.restored++;
        } else if (existingAtCommit.is_archived && analysis.duplicatePolicy.archived === "restore_merge") {
          repo.mergeImportDuplicate(existingAtCommit.id, {
            tags: bm.tags,
            category_id: categoryId,
            notes: bm.notes,
            restore: true,
          });
          state.restored++;
        } else if (!existingAtCommit.is_archived && !existingAtCommit.is_trashed && analysis.duplicatePolicy.active === "merge") {
          repo.mergeImportDuplicate(existingAtCommit.id, {
            tags: bm.tags,
            category_id: categoryId,
            notes: bm.notes,
          });
          state.merged++;
        } else {
          state.skipped++;
        }
        continue;
      }

      // Create bookmark record
      const created = repo.create(bm.url, bm.title, categoryId);
      createdByUrl.set(bm.url, created.id);

      if (bm.notes) {
        repo.update(created.id, { notes: bm.notes });
      }

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
    merged: state.merged,
    restored: state.restored,
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
