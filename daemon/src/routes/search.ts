import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { SearchRepository, SearchMode } from "../db/search-repository.js";
import { resolveRuntimeSettings } from "../runtime-settings.js";

interface SearchDeps {
  db: Database;
}

function parseIntParam(val: string | null | undefined, fallback: number, min = 0): number {
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : Math.max(n, min);
}

function parseBooleanFlagParam(val: string | null | undefined): 0 | 1 | undefined | "invalid" {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === "true" || val === "1") return 1;
  if (val === "false" || val === "0") return 0;
  return "invalid";
}

function problem(c: Context, status: 400 | 422, title: string, detail?: string) {
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

export function createSearchRoute(deps: SearchDeps): Hono {
  const router = new Hono();
  const repo = new SearchRepository(deps.db);

  // GET /search?q=&mode=keyword|semantic|hybrid&tag=&domain=&category=&date_from=&date_to=&limit=&offset=
  router.get("/search", async (c: Context) => {
    const q = c.req.query("q") ?? undefined;
    const rawMode = c.req.query("mode") ?? "keyword";
    const limit = Math.min(parseIntParam(c.req.query("limit"), 20), 100);
    const offset = parseIntParam(c.req.query("offset"), 0);
    const readLater = parseBooleanFlagParam(c.req.query("read_later"));

    const validModes: SearchMode[] = ["keyword", "semantic", "hybrid"];
    if (!validModes.includes(rawMode as SearchMode)) {
      return problem(c, 422, "Unprocessable Entity", `mode must be one of: ${validModes.join(", ")}`);
    }
    if (readLater === "invalid") {
      return problem(c, 422, "Unprocessable Entity", "`read_later` must be true, false, 1, or 0");
    }
    const mode = rawMode as SearchMode;

    const { embeddingConfig } = resolveRuntimeSettings();

    // Semantic/hybrid require embedding config
    if ((mode === "semantic" || mode === "hybrid") && !embeddingConfig) {
      return problem(c, 422, "Unprocessable Entity",
        `mode=${mode} requires an embedding provider to be configured`);
    }

    let result;
    try {
      result = await repo.search({
        q,
        mode,
        tag: c.req.query("tag") ?? undefined,
        domain: c.req.query("domain") ?? undefined,
        category: c.req.query("category") ?? undefined,
        date_from: c.req.query("date_from") ?? undefined,
        date_to: c.req.query("date_to") ?? undefined,
        read_later: readLater,
        limit,
        offset,
        embeddingConfig: embeddingConfig ?? undefined,
      });
    } catch (err) {
      // FTS5 MATCH syntax errors surface as SQLite exceptions
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("fts5") || msg.includes("MATCH") || msg.includes("syntax error")) {
        return problem(c, 400, "Invalid Query", "Search query contains invalid syntax");
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
      meta: { mode },
    });
  });

  return router;
}
