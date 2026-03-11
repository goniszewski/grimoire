import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { SearchRepository } from "../db/search-repository.js";

interface SearchDeps {
  db: Database;
}

function parseIntParam(val: string | null | undefined, fallback: number, min = 0): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : Math.max(n, min);
}

export function createSearchRoute(deps: SearchDeps): Hono {
  const router = new Hono();
  const repo = new SearchRepository(deps.db);

  // GET /search?q=&tag=&domain=&category=&date_from=&date_to=&limit=&offset=
  router.get("/search", (c: Context) => {
    const q = c.req.query("q") ?? undefined;
    const limit = Math.min(parseIntParam(c.req.query("limit"), 20), 100);
    const offset = parseIntParam(c.req.query("offset"), 0);

    let result;
    try {
      result = repo.search({
        q,
        tag: c.req.query("tag") ?? undefined,
        domain: c.req.query("domain") ?? undefined,
        category: c.req.query("category") ?? undefined,
        date_from: c.req.query("date_from") ?? undefined,
        date_to: c.req.query("date_to") ?? undefined,
        limit,
        offset,
      });
    } catch (err) {
      // FTS5 MATCH syntax errors surface as SQLite exceptions
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("fts5") || msg.includes("MATCH") || msg.includes("syntax error")) {
        return c.json(
          {
            type: "https://littleimp.app/problems/invalid-query",
            title: "Invalid Query",
            status: 400,
            detail: "Search query contains invalid syntax",
          },
          400,
          { "Content-Type": "application/problem+json" }
        );
      }
      throw err;
    }

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

  return router;
}
