import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { BookmarkRepository, type BookmarkWithTags } from "../db/bookmark-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { CaptureRepository, type CaptureMetadataInput, type BookmarkCaptureMetadataRow } from "../db/capture-repository.js";
import { requireIntegrationToken } from "../lib/integration-auth.js";
import {
  parsePublicHttpUrl,
  publicUrlRejectionMessage,
} from "../lib/public-url.js";
import { log } from "../logger.js";

interface CaptureDeps {
  db: Database;
  queue: JobQueue;
}

type ProblemStatus = 400 | 404 | 409 | 422 | 500;

const captureFields = new Set(["url", "title", "tags", "category_id", "category", "notes", "source"]);
const sourceFields = new Set(["client", "source_url", "referrer_url", "selected_text"]);
const tagPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_TITLE_LENGTH = 2000;
const MAX_TAG_LENGTH = 50;
const MAX_CATEGORY_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 100_000;
const MAX_SOURCE_CLIENT_LENGTH = 80;
const MAX_SOURCE_URL_LENGTH = 2000;
const MAX_SELECTED_TEXT_LENGTH = 10_000;

class ValidationError extends Error {}

type CategorySelection =
  | { kind: "none" }
  | { kind: "id"; id: string | null }
  | { kind: "name"; name: string };

function problem(
  c: Context,
  status: ProblemStatus,
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

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublicUrl(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`\`${field}\` field (string) is required`);
  }

  const parsed = parsePublicHttpUrl(value);
  if (!parsed.ok) {
    throw new ValidationError(publicUrlRejectionMessage(parsed.reason, field));
  }

  return parsed.href;
}

function parseOptionalText(
  body: Record<string, unknown>,
  field: string,
  maxLength: number,
  options: { nullable?: boolean; emptyAsNull?: boolean } = {}
): string | null | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value === null && options.nullable) return null;
  if (typeof value !== "string") {
    throw new ValidationError(`\`${field}\` must be a string${options.nullable ? " or null" : ""}`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (options.emptyAsNull || options.nullable) return null;
    throw new ValidationError(`\`${field}\` must not be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new ValidationError(`\`${field}\` must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function parseTags(body: Record<string, unknown>): string[] | undefined {
  if (!("tags" in body)) return undefined;
  const rawTags = body.tags;
  if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== "string")) {
    throw new ValidationError("`tags` must be an array of strings");
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const rawTag of rawTags) {
    const tag = rawTag.trim().toLowerCase();
    if (!tag) {
      throw new ValidationError("Tag names must not be empty");
    }
    if (tag.length > MAX_TAG_LENGTH) {
      throw new ValidationError(`Tag names must be at most ${MAX_TAG_LENGTH} characters`);
    }
    if (!tagPattern.test(tag)) {
      throw new ValidationError("Tag names must contain only lowercase letters, digits, and single hyphens");
    }
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function parseSource(body: Record<string, unknown>): CaptureMetadataInput {
  if (!("source" in body) || body.source === null || body.source === undefined) return {};
  if (!isRecord(body.source)) {
    throw new ValidationError("`source` must be an object");
  }

  const source = body.source;
  const unsupportedFields = Object.keys(source).filter((field) => !sourceFields.has(field));
  if (unsupportedFields.length > 0) {
    throw new ValidationError(`Unsupported source field${unsupportedFields.length === 1 ? "" : "s"}: ${unsupportedFields.join(", ")}`);
  }

  const sourceClient = parseOptionalText(source, "client", MAX_SOURCE_CLIENT_LENGTH, {
    emptyAsNull: true,
    nullable: true,
  });
  const sourceUrl =
    "source_url" in source && source.source_url !== null && source.source_url !== undefined
      ? parsePublicUrl(source.source_url, "source.source_url")
      : null;
  const referrerUrl =
    "referrer_url" in source && source.referrer_url !== null && source.referrer_url !== undefined
      ? parsePublicUrl(source.referrer_url, "source.referrer_url")
      : null;
  if (sourceUrl && sourceUrl.length > MAX_SOURCE_URL_LENGTH) {
    throw new ValidationError(`\`source.source_url\` must be at most ${MAX_SOURCE_URL_LENGTH} characters`);
  }
  if (referrerUrl && referrerUrl.length > MAX_SOURCE_URL_LENGTH) {
    throw new ValidationError(`\`source.referrer_url\` must be at most ${MAX_SOURCE_URL_LENGTH} characters`);
  }
  const selectedText = parseOptionalText(source, "selected_text", MAX_SELECTED_TEXT_LENGTH, {
    emptyAsNull: true,
    nullable: true,
  });

  return {
    source_client: sourceClient ?? null,
    source_url: sourceUrl,
    referrer_url: referrerUrl,
    selected_text: selectedText ?? null,
  };
}

function parseCategorySelection(body: Record<string, unknown>): CategorySelection {
  if ("category_id" in body && "category" in body) {
    throw new ValidationError("Use either `category_id` or `category`, not both");
  }

  if ("category_id" in body) {
    if (body.category_id === null) return { kind: "id", id: null };
    if (typeof body.category_id !== "string" || !body.category_id.trim()) {
      throw new ValidationError("`category_id` must be a string or null");
    }
    return { kind: "id", id: body.category_id.trim() };
  }

  if ("category" in body) {
    const categoryName = parseOptionalText(body, "category", MAX_CATEGORY_NAME_LENGTH);
    if (!categoryName) return { kind: "none" };
    return { kind: "name", name: categoryName };
  }

  return { kind: "none" };
}

function validateCategorySelection(selection: CategorySelection, categoryRepo: CategoryRepository): void {
  if (selection.kind === "id" && selection.id !== null && !categoryRepo.findById(selection.id)) {
    throw new ValidationError("Category not found");
  }
}

function resolveCategoryId(selection: CategorySelection, categoryRepo: CategoryRepository): string | null {
  if (selection.kind === "id") return selection.id;
  if (selection.kind === "name") {
    const existing = categoryRepo.findByNameAndParent(selection.name, null);
    return existing?.id ?? categoryRepo.create(selection.name, null).id;
  }
  return null;
}

// ─── Core capture logic ──────────────────────────────────────────────────────

type CaptureOutcome =
  | { kind: "success"; bookmark: ReturnType<BookmarkRepository["findById"]>; capture: ReturnType<CaptureRepository["findByBookmarkId"]>; created: boolean; job_id: string | null }
  | { kind: "validation_error"; message: string }
  | { kind: "conflict_trash" }
  | { kind: "conflict_archive" }
  | { kind: "internal_error"; message: string };

type DoCaptureInput = {
  url: string;
  title?: string | null;
  categoryId?: string | null;
  resolveCategory?: () => string | null;
  tags?: string[];
  notes?: string | null;
  source?: CaptureMetadataInput;
};

function doCapture(
  input: DoCaptureInput,
  repos: {
    bookmarkRepo: BookmarkRepository;
    categoryRepo: CategoryRepository;
    captureRepo: CaptureRepository;
  },
  deps: { db: Database; queue: JobQueue }
): CaptureOutcome {
  const { bookmarkRepo, captureRepo } = repos;

  const existing = bookmarkRepo.findByUrl(input.url);
  if (existing) {
    if (existing.is_trashed) {
      return { kind: "conflict_trash" };
    }
    if (existing.is_archived) {
      return { kind: "conflict_archive" };
    }

    const bookmark = bookmarkRepo.findById(existing.id);
    if (!bookmark) return { kind: "internal_error", message: "Existing bookmark could not be fetched" };
    return {
      kind: "success",
      bookmark,
      capture: captureRepo.findByBookmarkId(bookmark.id),
      created: false,
      job_id: null,
    };
  }

  let bookmarkOut = null as BookmarkWithTags | null;
  let captureOut = null as BookmarkCaptureMetadataRow | null;
  let jobIdOut = "";

  deps.db.transaction(() => {
    const categoryId = input.resolveCategory ? input.resolveCategory() : (input.categoryId ?? null);
    const created = bookmarkRepo.create(
      input.url,
      input.title ?? undefined,
      categoryId
    );
    let fetched = bookmarkRepo.findById(created.id);
    if (!fetched) throw new Error("Captured bookmark could not be fetched");

    // Apply tags and notes after creation if provided
    if (input.tags !== undefined || input.notes !== undefined) {
      const updated = bookmarkRepo.update(fetched.id, {
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      });
      if (!updated) throw new Error("Captured bookmark could not be updated");
      fetched = updated;
    }

    const cap = captureRepo.upsert(fetched.id, input.source ?? {});
    const job = deps.queue.enqueue("ingest", {
      bookmarkId: fetched.id,
      url: fetched.url,
    });
    bookmarkOut = fetched;
    captureOut = cap;
    jobIdOut = job.id;
  })();

  if (!bookmarkOut) return { kind: "internal_error", message: "Captured bookmark could not be fetched" };

  log.info("Bookmark captured", {
    bookmarkId: bookmarkOut.id,
    url: input.url,
    jobId: jobIdOut,
  });

  return { kind: "success", bookmark: bookmarkOut, capture: captureOut, created: true, job_id: jobIdOut };
}

// ─── Bookmarklet bridge responses ────────────────────────────────────────────

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><body style="font:14px/1.5 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center;padding:2em">${body}</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BOOKMARKLET_BRIDGE_SCRIPT = `(() => {
  const nonce = new URLSearchParams(window.location.hash.slice(1)).get("nonce");
  const openerWindow = window.opener;
  const status = document.getElementById("grimoire-capture-status");

  if (!nonce || !openerWindow) {
    if (status) status.textContent = "This capture window is no longer connected.";
    return;
  }

  let handled = false;
  let replyOrigin = "*";

  function postToOpener(message, targetOrigin = "*") {
    try {
      openerWindow.postMessage({ ...message, nonce }, targetOrigin);
    } catch {
      // The opener may have navigated away or closed while the capture ran.
    }
  }

  window.addEventListener("message", (event) => {
    if (handled || event.source !== openerWindow) return;

    const request = event.data;
    if (
      !request ||
      request.type !== "grimoire-bookmarklet-request" ||
      request.nonce !== nonce ||
      typeof request.token !== "string" ||
      !request.payload ||
      typeof request.payload.url !== "string"
    ) {
      return;
    }

    handled = true;
    replyOrigin = event.origin && event.origin !== "null" ? event.origin : "*";
    if (status) status.textContent = "Saving to Grimoire...";

    void (async () => {
      try {
        const response = await fetch("/capture", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + request.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.payload),
          credentials: "same-origin",
        });

        let body = null;
        try {
          body = await response.json();
        } catch {
          // The result message still includes the HTTP status when the body is unavailable.
        }

        const bodyRecord = body && typeof body === "object" ? body : null;
        const data =
          bodyRecord && "data" in bodyRecord && bodyRecord.data && typeof bodyRecord.data === "object"
            ? bodyRecord.data
            : null;
        const detail = bodyRecord && typeof bodyRecord.detail === "string" ? bodyRecord.detail : null;
        const created = data && typeof data.created === "boolean" ? data.created : null;

        postToOpener(
          {
            type: "grimoire-bookmarklet-result",
            ok: response.ok,
            status: response.status,
            created,
            detail,
          },
          replyOrigin
        );
        if (status) status.textContent = response.ok ? "Capture complete." : "Capture failed.";
      } catch {
        postToOpener(
          {
            type: "grimoire-bookmarklet-result",
            ok: false,
            status: 0,
            created: null,
            detail: "The Grimoire daemon could not be reached.",
          },
          replyOrigin
        );
        if (status) status.textContent = "The Grimoire daemon could not be reached.";
      } finally {
        window.setTimeout(() => window.close(), 60);
      }
    })();
  });

  postToOpener({ type: "grimoire-bookmarklet-ready" });
})();\n`;

function bookmarkletBridgePage(): string {
  return htmlPage(
    "Grimoire Capture",
    '<p id="grimoire-capture-status">Waiting for the bookmarklet...</p><script src="/capture/bookmarklet.js" defer></script>'
  );
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createCaptureRoute(deps: CaptureDeps): Hono {
  const router = new Hono();
  const bookmarkRepo = new BookmarkRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);
  const captureRepo = new CaptureRepository(deps.db);

  // POST /capture — protected local integration one-click bookmark capture
  router.post("/capture", requireIntegrationToken(deps.db), async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    if (!isRecord(body)) {
      return problem(c, 422, "Unprocessable Entity", "Capture body must be a JSON object");
    }

    const unsupportedFields = Object.keys(body).filter((field) => !captureFields.has(field));
    if (unsupportedFields.length > 0) {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        `Unsupported capture field${unsupportedFields.length === 1 ? "" : "s"}: ${unsupportedFields.join(", ")}`
      );
    }

    let url: string;
    let title: string | null | undefined;
    let tags: string[] | undefined;
    let categorySelection: CategorySelection;
    let notes: string | null | undefined;
    let source: CaptureMetadataInput;
    try {
      url = parsePublicUrl(body.url, "url");
      title = parseOptionalText(body, "title", MAX_TITLE_LENGTH, { emptyAsNull: true });
      tags = parseTags(body);
      categorySelection = parseCategorySelection(body);
      validateCategorySelection(categorySelection, categoryRepo);
      notes = parseOptionalText(body, "notes", MAX_NOTES_LENGTH, { emptyAsNull: true, nullable: true });
      source = parseSource(body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return problem(c, 422, "Unprocessable Entity", err.message);
      }
      throw err;
    }

    const outcome = doCapture(
      {
        url,
        title,
        tags,
        notes,
        resolveCategory: () => resolveCategoryId(categorySelection, categoryRepo),
        source,
      },
      { bookmarkRepo, categoryRepo, captureRepo },
      deps
    );

    switch (outcome.kind) {
      case "success":
        log.info("Bookmark captured by local integration", {
          bookmarkId: outcome.bookmark?.id,
          url,
          jobId: outcome.job_id,
        });
        return ok(c, {
          bookmark: outcome.bookmark,
          capture: outcome.capture,
          created: outcome.created,
          job_id: outcome.job_id,
        }, outcome.created ? 201 : 200);
      case "validation_error":
        return problem(c, 422, "Unprocessable Entity", outcome.message);
      case "conflict_trash":
        return problem(
          c,
          409,
          "Conflict",
          "This URL is already in your trash. Restore or permanently delete it before re-adding."
        );
      case "conflict_archive":
        return problem(
          c,
          409,
          "Conflict",
          "This URL is already in your archive. Restore it from the archive before re-adding."
        );
      case "internal_error":
        return problem(c, 500, "Internal Server Error", outcome.message);
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  });

  // GET /capture/bookmarklet.js — same-origin script used by the top-level bridge
  router.get("/capture/bookmarklet.js", (c) => {
    return c.body(BOOKMARKLET_BRIDGE_SCRIPT, 200, {
      "Cache-Control": "no-store",
      "Content-Type": "application/javascript; charset=utf-8",
    });
  });

  // GET /capture/bookmarklet — top-level bridge opened by the bookmarklet.
  // It never mutates state and receives the token only through postMessage.
  router.get("/capture/bookmarklet", (c) => {
    return c.html(bookmarkletBridgePage(), 200, { "Cache-Control": "no-store" });
  });

  return router;
}
