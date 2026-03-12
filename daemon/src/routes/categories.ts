import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { CategoryRepository } from "../db/category-repository.js";

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

// ─── Route factory ────────────────────────────────────────────────────────────

export function createCategoriesRoute(deps: CategoriesDeps): Hono {
  const router = new Hono();
  const repo = new CategoryRepository(deps.db);

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

    const b = body as Record<string, unknown>;

    if (typeof b.name !== "string" || !b.name.trim()) {
      return problem(c, 422, "Unprocessable Entity", "`name` (non-empty string) is required");
    }

    const name = b.name.trim();

    if (name.length > MAX_NAME_LEN) {
      return problem(c, 422, "Unprocessable Entity", `\`name\` must be at most ${MAX_NAME_LEN} characters`);
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

    const category = repo.create(name, parentId);
    return ok(c, category, 201);
  });

  // PUT /categories/:id — rename or reparent
  router.put("/categories/:id", async (c) => {
    const id = c.req.param("id");
    if (!repo.findById(id)) {
      return problem(c, 404, "Not Found", "Category not found");
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return problem(c, 400, "Bad Request", "Request body must be valid JSON");
    }

    const b = body as Record<string, unknown>;
    const patch: { name?: string; parent_id?: string | null } = {};

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
        patch.parent_id = parent.id;
      } else {
        patch.parent_id = null;
      }
    }

    const updated = repo.update(id, patch);
    if (!updated) return problem(c, 404, "Not Found", "Category not found");
    return ok(c, updated);
  });

  // DELETE /categories/:id — delete, reparent children, bookmarks keep their rows
  router.delete("/categories/:id", (c) => {
    const deleted = repo.delete(c.req.param("id"));
    if (!deleted) return problem(c, 404, "Not Found", "Category not found");
    return c.body(null, 204);
  });

  return router;
}
