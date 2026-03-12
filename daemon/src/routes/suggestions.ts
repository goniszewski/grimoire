import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { SuggestionRepository } from "../db/suggestion-repository.js";

interface SuggestionsDeps {
  db: Database;
}

function problem(
  c: Context,
  status: 400 | 404 | 422 | 500,
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

export function createSuggestionsRoute(deps: SuggestionsDeps): Hono {
  const router = new Hono();
  const repo = new SuggestionRepository(deps.db);

  // GET /suggestions — list pending suggestions
  router.get("/suggestions", (c) => {
    const suggestions = repo.listPending();
    return c.json({ data: suggestions, meta: { pending: suggestions.length } });
  });

  // POST /suggestions/:id/accept — accept a suggestion
  router.post("/suggestions/:id/accept", (c) => {
    const id = c.req.param("id");
    const existing = repo.findById(id);

    if (!existing) {
      return problem(c, 404, "Not Found", "Suggestion not found");
    }
    if (existing.status !== "pending") {
      return problem(c, 422, "Unprocessable Entity", `Suggestion is already ${existing.status}`);
    }

    const updated = repo.accept(id);
    return ok(c, updated);
  });

  // POST /suggestions/:id/reject — reject a suggestion
  router.post("/suggestions/:id/reject", (c) => {
    const id = c.req.param("id");
    const existing = repo.findById(id);

    if (!existing) {
      return problem(c, 404, "Not Found", "Suggestion not found");
    }
    if (existing.status !== "pending") {
      return problem(c, 422, "Unprocessable Entity", `Suggestion is already ${existing.status}`);
    }

    const updated = repo.reject(id);
    return ok(c, updated);
  });

  return router;
}
