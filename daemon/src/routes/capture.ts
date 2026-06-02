import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { CaptureRepository, type CaptureMetadataInput } from "../db/capture-repository.js";
import { requireIntegrationToken } from "../lib/integration-auth.js";
import { isPrivateHost } from "../lib/network.js";
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

  const raw = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError(`\`${field}\` must be a valid http or https URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(`\`${field}\` must be a valid http or https URL`);
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError(`\`${field}\` must not include embedded credentials`);
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new ValidationError(`\`${field}\` must not target a private or loopback host`);
  }

  return raw;
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

// ─── Route factory ────────────────────────────────────────────────────────────

export function createCaptureRoute(deps: CaptureDeps): Hono {
  const router = new Hono();
  const bookmarkRepo = new BookmarkRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);
  const captureRepo = new CaptureRepository(deps.db);

  router.use("/capture", requireIntegrationToken(deps.db));

  // POST /capture — protected local integration one-click bookmark capture
  router.post("/capture", async (c) => {
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

    const existing = bookmarkRepo.findByUrl(url);
    if (existing) {
      if (existing.is_trashed) {
        return problem(
          c,
          409,
          "Conflict",
          "This URL is already in your trash. Restore or permanently delete it before re-adding."
        );
      }
      if (existing.is_archived) {
        return problem(
          c,
          409,
          "Conflict",
          "This URL is already in your archive. Restore it from the archive before re-adding."
        );
      }

      const bookmark = bookmarkRepo.findById(existing.id);
      if (!bookmark) return problem(c, 500, "Internal Server Error", "Existing bookmark could not be fetched");
      return ok(c, {
        bookmark,
        capture: captureRepo.findByBookmarkId(bookmark.id),
        created: false,
        job_id: null,
      });
    }

    let bookmark = null as ReturnType<BookmarkRepository["findById"]>;
    let capture = null as ReturnType<CaptureRepository["upsert"]>;
    let jobId: string | null = null;
    deps.db.transaction(() => {
      const created = bookmarkRepo.create(
        url,
        title ?? undefined,
        resolveCategoryId(categorySelection, categoryRepo)
      );
      bookmark = bookmarkRepo.findById(created.id);
      if (!bookmark) throw new Error("Captured bookmark could not be fetched");

      if (tags !== undefined || notes !== undefined) {
        const updated = bookmarkRepo.update(bookmark.id, {
          ...(tags !== undefined ? { tags } : {}),
          ...(notes !== undefined ? { notes } : {}),
        });
        if (!updated) throw new Error("Captured bookmark could not be updated");
        bookmark = updated;
      }
      capture = captureRepo.upsert(bookmark.id, source);
      const job = deps.queue.enqueue("ingest", {
        bookmarkId: bookmark.id,
        url: bookmark.url,
      });
      jobId = job.id;
    })();

    if (!bookmark) {
      return problem(c, 500, "Internal Server Error", "Captured bookmark could not be fetched");
    }

    log.info("Bookmark captured by local integration", {
      bookmarkId: bookmark.id,
      url,
      jobId,
    });

    return ok(c, {
      bookmark,
      capture,
      created: true,
      job_id: jobId,
    }, 201);
  });

  return router;
}
