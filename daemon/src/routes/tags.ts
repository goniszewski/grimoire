import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { TagRepository } from "../db/tag-repository.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";

interface TagsDeps {
  db: Database;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data }, status);
}

/** Validate a tag name: alphanumeric segments joined by single hyphens. */
function isValidTagName(name: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
}

const MAX_TAG_NAME_LEN = 50;

// ─── Route factory ────────────────────────────────────────────────────────────

export function createTagsRoute(deps: TagsDeps): Hono {
  const router = new Hono();
  const tagRepo = new TagRepository(deps.db);
  const bookmarkRepo = new BookmarkRepository(deps.db);

  // GET /tags — list all tags with bookmark counts
  router.get("/tags", (c) => {
    return ok(c, tagRepo.list());
  });

  // POST /tags — create a tag (idempotent: returns existing tag with 200, new tag with 201)
  router.post("/tags", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    const b = body as Record<string, unknown>;

    if (typeof b.name !== "string" || !b.name.trim()) {
      return problem(c, 422, "Unprocessable Entity", "`name` (non-empty string) is required");
    }

    const name = b.name.toLowerCase().trim();

    if (name.length > MAX_TAG_NAME_LEN) {
      return problem(c, 422, "Unprocessable Entity", `\`name\` must be at most ${MAX_TAG_NAME_LEN} characters`);
    }

    if (!isValidTagName(name)) {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        "`name` must contain only lowercase letters, digits, and hyphens (no leading/trailing hyphens)"
      );
    }

    const existing = tagRepo.findByName(name);
    if (existing) return ok(c, existing, 200);

    const tag = tagRepo.upsert(name);
    return ok(c, tag, 201);
  });

  // DELETE /tags/:id — remove tag (detaches from all bookmarks via CASCADE)
  router.delete("/tags/:id", (c) => {
    const deleted = tagRepo.delete(c.req.param("id"));
    if (!deleted) return problem(c, 404, "Not Found", "Tag not found");
    return c.body(null, 204);
  });

  // POST /bookmarks/:id/tags — attach a tag to a bookmark
  router.post("/bookmarks/:id/tags", async (c) => {
    const bookmarkId = c.req.param("id");
    if (!bookmarkRepo.findById(bookmarkId)) {
      return problem(c, 404, "Not Found", "Bookmark not found");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    const b = body as Record<string, unknown>;

    if (typeof b.name !== "string" || !b.name.trim()) {
      return problem(c, 422, "Unprocessable Entity", "`name` (non-empty string) is required");
    }

    const name = b.name.toLowerCase().trim();

    if (name.length > MAX_TAG_NAME_LEN) {
      return problem(c, 422, "Unprocessable Entity", `\`name\` must be at most ${MAX_TAG_NAME_LEN} characters`);
    }

    if (!isValidTagName(name)) {
      return problem(
        c,
        422,
        "Unprocessable Entity",
        "`name` must contain only lowercase letters, digits, and hyphens (no leading/trailing hyphens)"
      );
    }

    const tag = tagRepo.upsert(name);
    tagRepo.attachToBookmark(bookmarkId, tag.id);

    const bm = bookmarkRepo.findById(bookmarkId);
    if (!bm) return problem(c, 404, "Not Found", "Bookmark not found");
    return ok(c, bm, 201);
  });

  // DELETE /bookmarks/:id/tags/:tagId — detach a tag from a bookmark
  router.delete("/bookmarks/:id/tags/:tagId", (c) => {
    const bookmarkId = c.req.param("id");
    const tagId = c.req.param("tagId");

    if (!bookmarkRepo.findById(bookmarkId)) {
      return problem(c, 404, "Not Found", "Bookmark not found");
    }
    if (!tagRepo.findById(tagId)) {
      return problem(c, 404, "Not Found", "Tag not found");
    }

    const detached = tagRepo.detachFromBookmark(bookmarkId, tagId);
    if (!detached) {
      return problem(c, 404, "Not Found", "Tag not attached to this bookmark");
    }

    return c.body(null, 204);
  });

  return router;
}
