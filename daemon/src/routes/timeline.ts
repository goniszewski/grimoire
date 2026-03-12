import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { TimelineRepository } from "../db/timeline-repository.js";

interface TimelineDeps {
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

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export function createTimelineRoute(deps: TimelineDeps): Hono {
  const router = new Hono();
  const repo = new TimelineRepository(deps.db);

  // GET /timeline — paginated timeline events, newest first
  router.get("/timeline", (c) => {
    const rawLimit = c.req.query("limit");
    const rawOffset = c.req.query("offset");

    let limit = DEFAULT_LIMIT;
    let offset = 0;

    if (rawLimit !== undefined) {
      const n = parseInt(rawLimit, 10);
      if (isNaN(n) || n < 1) {
        return problem(c, 400, "Bad Request", "`limit` must be a positive integer");
      }
      limit = Math.min(n, MAX_LIMIT);
    }

    if (rawOffset !== undefined) {
      const n = parseInt(rawOffset, 10);
      if (isNaN(n) || n < 0) {
        return problem(c, 400, "Bad Request", "`offset` must be a non-negative integer");
      }
      offset = n;
    }

    const page = repo.list(limit, offset);
    return c.json(page);
  });

  return router;
}
