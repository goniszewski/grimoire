import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { CategoryRepository, type CategoryMetadataPatch } from "../db/category-repository.js";
import { TimelineRepository } from "../db/timeline-repository.js";

interface CategoriesDeps {
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

const MAX_DEPTH = 2;      // 0-indexed → max 3 levels (0, 1, 2)
const MAX_NAME_LEN = 100;
const MAX_DESCRIPTION_LEN = 500;
const MAX_ICON_LEN = 40;
const MAX_SLUG_LEN = 80;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ICON_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class ValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNullableString(
  body: Record<string, unknown>,
  field: "color" | "icon" | "description" | "slug",
  label: string,
  maxLength: number,
  pattern?: RegExp
): string | null | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError(`\`${field}\` must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new ValidationError(`\`${field}\` must be at most ${maxLength} characters`);
  }
  const normalized = field === "slug" ? trimmed.toLowerCase() : trimmed;
  if (pattern && !pattern.test(normalized)) {
    throw new ValidationError(label);
  }
  return normalized;
}

function parseFlag(body: Record<string, unknown>, field: "is_archived" | "is_public"): 0 | 1 | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value !== 0 && value !== 1) {
    throw new ValidationError(`\`${field}\` must be 0 or 1`);
  }
  return value;
}

function parseCategoryMetadata(body: Record<string, unknown>): CategoryMetadataPatch {
  const patch: CategoryMetadataPatch = {};

  if ("color" in body) {
    patch.color = parseNullableString(
      body,
      "color",
      "`color` must be a hex color like #2563eb",
      7,
      COLOR_PATTERN
    ) ?? null;
  }
  if ("icon" in body) {
    patch.icon = parseNullableString(
      body,
      "icon",
      "`icon` must use lowercase letters, numbers, and hyphens",
      MAX_ICON_LEN,
      ICON_PATTERN
    ) ?? null;
  }
  if ("description" in body) {
    patch.description = parseNullableString(
      body,
      "description",
      "`description` must be a string or null",
      MAX_DESCRIPTION_LEN
    ) ?? null;
  }
  if ("slug" in body) {
    patch.slug = parseNullableString(
      body,
      "slug",
      "`slug` must use lowercase letters, numbers, and single hyphens",
      MAX_SLUG_LEN,
      SLUG_PATTERN
    ) ?? null;
  }

  const isArchived = parseFlag(body, "is_archived");
  if (isArchived !== undefined) patch.is_archived = isArchived;
  const isPublic = parseFlag(body, "is_public");
  if (isPublic !== undefined) patch.is_public = isPublic;

  return patch;
}

function categoryConflictDetail(err: Error, fallback: string): string {
  if (err.message.includes("categories.slug")) return "A category with that slug already exists";
  return fallback;
}

function parentDestination(repo: CategoryRepository, parentId: string | null): string {
  if (!parentId) return "root";
  const parent = repo.findById(parentId);
  return parent ? `"${parent.name}"` : "unknown parent";
}

function moveExceedsMaxDepth(repo: CategoryRepository, categoryId: string, parentId: string | null): boolean {
  const targetDepth = parentId ? repo.depth(parentId) + 1 : 0;
  return targetDepth + repo.subtreeHeight(categoryId) > MAX_DEPTH;
}

// ─── Route factory ────────────────────────────────────────────────────────────

export function createCategoriesRoute(deps: CategoriesDeps): Hono {
  const router = new Hono();
  const repo = new CategoryRepository(deps.db);
  const timelineRepo = new TimelineRepository(deps.db);

  // GET /categories — tree structure with bookmark counts
  router.get("/categories", (c) => {
    const tree = repo.listTree();
    return ok(c, tree);
  });

  // POST /categories — create a category
  router.post("/categories", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    if (!isRecord(body)) {
      return problem(c, 422, "Unprocessable Entity", "Request body must be a JSON object");
    }

    const b = body;

    if (typeof b.name !== "string" || !b.name.trim()) {
      return problem(c, 422, "Unprocessable Entity", "`name` (non-empty string) is required");
    }

    const name = b.name.trim();

    if (name.length > MAX_NAME_LEN) {
      return problem(c, 422, "Unprocessable Entity", `\`name\` must be at most ${MAX_NAME_LEN} characters`);
    }

    let metadataPatch: CategoryMetadataPatch;
    try {
      metadataPatch = parseCategoryMetadata(b);
    } catch (err) {
      if (err instanceof ValidationError) {
        return problem(c, 422, "Unprocessable Entity", err.message);
      }
      throw err;
    }

    // Validate parent_id
    let parentId: string | null = null;
    if ("parent_id" in b && b.parent_id !== null) {
      if (typeof b.parent_id !== "string") {
        return problem(c, 422, "Unprocessable Entity", "`parent_id` must be a string or null");
      }
      const parent = repo.findById(b.parent_id);
      if (!parent) {
        return problem(c, 422, "Unprocessable Entity", "Parent category not found");
      }
      // Enforce max depth: parent must be at most depth MAX_DEPTH-1
      if (repo.depth(parent.id) >= MAX_DEPTH) {
        return problem(c, 422, "Unprocessable Entity", "Maximum nesting depth (3 levels) exceeded");
      }
      parentId = parent.id;
    }

    try {
      let category: ReturnType<typeof repo.create> | null = null;
      deps.db.transaction(() => {
        category = repo.create(name, parentId, metadataPatch);
        timelineRepo.insert(
          "category_created",
          parentId
            ? `Created category "${category.name}" under ${parentDestination(repo, parentId)}`
            : `Created category "${category.name}"`,
          {
            categoryId: category.id,
            name: category.name,
            parentId,
          },
          "user"
        );
      })();
      if (!category) throw new Error("Failed to insert category");
      return ok(c, category, 201);
    } catch (err) {
      // UNIQUE constraint violation → duplicate name under the same parent
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return problem(
          c,
          409,
          "Conflict",
          categoryConflictDetail(err, `A category named "${name}" already exists under this parent`)
        );
      }
      throw err;
    }
  });

  // PUT /categories/:id — rename or reparent
  router.put("/categories/:id", async (c) => {
    const id = c.req.param("id");
    const existing = repo.findById(id);
    if (!existing) {
      return problem(c, 404, "Not Found", "Category not found");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    if (!isRecord(body)) {
      return problem(c, 422, "Unprocessable Entity", "Request body must be a JSON object");
    }

    const b = body;
    let patch: { name?: string; parent_id?: string | null } & CategoryMetadataPatch = {};

    try {
      patch = parseCategoryMetadata(b);
    } catch (err) {
      if (err instanceof ValidationError) {
        return problem(c, 422, "Unprocessable Entity", err.message);
      }
      throw err;
    }

    if ("name" in b) {
      if (typeof b.name !== "string" || !b.name.trim()) {
        return problem(c, 422, "Unprocessable Entity", "`name` must be a non-empty string");
      }
      const name = b.name.trim();
      if (name.length > MAX_NAME_LEN) {
        return problem(c, 422, "Unprocessable Entity", `\`name\` must be at most ${MAX_NAME_LEN} characters`);
      }
      patch.name = name;
    }

    if ("parent_id" in b) {
      if (b.parent_id !== null && typeof b.parent_id !== "string") {
        return problem(c, 422, "Unprocessable Entity", "`parent_id` must be a string or null");
      }
      if (b.parent_id !== null) {
        if (b.parent_id === id) {
          return problem(c, 422, "Unprocessable Entity", "A category cannot be its own parent");
        }
        const parent = repo.findById(b.parent_id as string);
        if (!parent) {
          return problem(c, 422, "Unprocessable Entity", "Parent category not found");
        }
        // Prevent cycles: the proposed new parent must not be a descendant of this category
        if (repo.isAncestorOrSelf(id, parent.id)) {
          return problem(c, 422, "Unprocessable Entity", "Cannot reparent a category under one of its own descendants");
        }
        if (repo.depth(parent.id) >= MAX_DEPTH) {
          return problem(c, 422, "Unprocessable Entity", "Maximum nesting depth (3 levels) exceeded");
        }
        if (moveExceedsMaxDepth(repo, id, parent.id)) {
          return problem(c, 422, "Unprocessable Entity", "Maximum nesting depth (3 levels) exceeded");
        }
        patch.parent_id = parent.id;
      } else {
        if (moveExceedsMaxDepth(repo, id, null)) {
          return problem(c, 422, "Unprocessable Entity", "Maximum nesting depth (3 levels) exceeded");
        }
        patch.parent_id = null;
      }
    }

    try {
      let updated: ReturnType<typeof repo.update> = null;
      deps.db.transaction(() => {
        updated = repo.update(id, patch);
        if (!updated) return;

        if ("name" in patch && patch.name !== undefined && patch.name !== existing.name) {
          timelineRepo.insert(
            "category_renamed",
            `Renamed category "${existing.name}" to "${updated.name}"`,
            {
              categoryId: updated.id,
              previousName: existing.name,
              name: updated.name,
            },
            "user"
          );
        }

        if ("parent_id" in patch && updated.parent_id !== existing.parent_id) {
          timelineRepo.insert(
            "category_reparented",
            `Moved category "${updated.name}" to ${parentDestination(repo, updated.parent_id)}`,
            {
              categoryId: updated.id,
              name: updated.name,
              previousParentId: existing.parent_id,
              parentId: updated.parent_id,
            },
            "user"
          );
        }
      })();
      if (!updated) return problem(c, 404, "Not Found", "Category not found");
      return ok(c, updated);
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
        return problem(
          c,
          409,
          "Conflict",
          categoryConflictDetail(err, `A category with that name already exists under this parent`)
        );
      }
      throw err;
    }
  });

  // DELETE /categories/:id — delete, reparent children, bookmarks keep their rows
  router.delete("/categories/:id", (c) => {
    const id = c.req.param("id");
    const existing = repo.findById(id);
    if (!existing) return problem(c, 404, "Not Found", "Category not found");

    let deleted = false;
    deps.db.transaction(() => {
      deleted = repo.delete(id);
      if (deleted) {
        timelineRepo.insert(
          "category_deleted",
          `Deleted category "${existing.name}"`,
          {
            categoryId: existing.id,
            name: existing.name,
            parentId: existing.parent_id,
          },
          "user"
        );
      }
    })();
    if (!deleted) return problem(c, 404, "Not Found", "Category not found");
    return c.body(null, 204);
  });

  return router;
}
