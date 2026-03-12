import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { BookmarkRepository } from "../db/bookmark-repository.js";

interface DomainsDeps {
  db: Database;
}

function ok<T>(c: Context, data: T) {
  return c.json({ data });
}

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

export function createDomainsRoute(deps: DomainsDeps): Hono {
  const router = new Hono();
  const repo = new BookmarkRepository(deps.db);

  // GET /domains — list all domains with bookmark counts, ordered by count desc
  router.get("/domains", (c) => {
    try {
      return ok(c, repo.listDomains());
    } catch (err) {
      return problem(c, 500, "Internal Server Error",
        err instanceof Error ? err.message : "Failed to query domains");
    }
  });

  return router;
}
