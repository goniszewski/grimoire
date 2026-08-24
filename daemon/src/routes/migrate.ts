/**
 * Experimental Grimoire v0.5 → 1.x migration routes.
 *
 * POST /migrate/legacy/inspect — summarize users/counts from a v0.5 data dir / db.sqlite
 * POST /migrate/legacy/apply   — import one owner's library into this local instance
 *
 * Password verification proves ownership of a selected v0.5 user. It does not
 * create Grimoire 1.x accounts (the app remains local-first single-user).
 */

import { Hono, type Context } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { log } from "../logger.js";
import {
  LegacyAuthError,
  LegacySourceError,
  inspectLegacyV05Source,
  migrateLegacyV05Source,
} from "../migrate/legacy-migrate.js";

interface MigrateDeps {
  db: Database;
  queue: JobQueue;
  dataDir: string;
}

function problem(
  c: Context,
  status: 400 | 401 | 409 | 422 | 500,
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

type SourceBody = {
  dataDir?: string;
  dbPath?: string;
  uploadsDir?: string;
  archivePath?: string;
  owner?: string;
  password?: string;
  mergeDuplicates?: boolean;
  requirePassword?: boolean;
  dryRun?: boolean;
};

async function readJsonBody(c: Context): Promise<SourceBody | Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return problem(c, 400, "Bad Request", "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return problem(c, 422, "Unprocessable Entity", "Body must be a JSON object");
  }
  const record = body as Record<string, unknown>;
  const str = (key: string): string | undefined => {
    const value = record[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const bool = (key: string): boolean => {
    const value = record[key];
    return value === true || value === "true" || value === "1";
  };

  return {
    dataDir: str("dataDir") ?? str("data_dir"),
    dbPath: str("dbPath") ?? str("db_path"),
    uploadsDir: str("uploadsDir") ?? str("uploads_dir"),
    archivePath: str("archivePath") ?? str("archive_path") ?? str("archive"),
    owner: str("owner"),
    password:
      typeof record.password === "string" && record.password.length > 0
        ? record.password
        : undefined,
    mergeDuplicates: bool("mergeDuplicates") || bool("merge_duplicates"),
    requirePassword: bool("requirePassword") || bool("require_password"),
    dryRun: bool("dryRun") || bool("dry_run"),
  };
}

export function createMigrateRoute(deps: MigrateDeps): Hono {
  const router = new Hono();
  /** Prevent overlapping apply runs from corrupting the local library mid-import. */
  let applyInProgress = false;

  router.post("/migrate/legacy/inspect", async (c) => {
    const body = await readJsonBody(c);
    if (body instanceof Response) return body;

    try {
      const result = inspectLegacyV05Source({
        dataDir: body.dataDir,
        dbPath: body.dbPath,
        uploadsDir: body.uploadsDir,
        archivePath: body.archivePath,
      });
      return c.json({ data: result });
    } catch (err) {
      if (err instanceof LegacySourceError) {
        return problem(c, 422, "Unprocessable Entity", err.message);
      }
      log.error("Legacy migrate inspect failed", { error: String(err) });
      return problem(c, 500, "Internal Server Error", "Failed to inspect v0.5 database");
    }
  });

  router.post("/migrate/legacy/apply", async (c) => {
    if (applyInProgress) {
      return problem(
        c,
        409,
        "Conflict",
        "A legacy migration apply is already in progress"
      );
    }

    applyInProgress = true;
    try {
      const body = await readJsonBody(c);
      if (body instanceof Response) return body;

      const summary = await migrateLegacyV05Source(
        {
          dataDir: body.dataDir,
          dbPath: body.dbPath,
          uploadsDir: body.uploadsDir,
          archivePath: body.archivePath,
          owner: body.owner,
          password: body.password,
          requirePassword: body.requirePassword || Boolean(body.password),
        },
        {
          db: deps.db,
          queue: deps.queue,
          dataDir: deps.dataDir,
          mergeDuplicates: body.mergeDuplicates,
          dryRun: body.dryRun,
          enqueueIngest: !body.dryRun,
        }
      );
      // Partial apply (some bookmarks failed) is still a successful HTTP write of
      // the summary, but clients must not treat it as a clean import.
      if (summary.bookmarksFailed > 0) {
        return c.json({ data: summary }, 207);
      }
      return c.json({ data: summary });
    } catch (err) {
      if (err instanceof LegacyAuthError) {
        return problem(c, 401, "Unauthorized", err.message);
      }
      if (err instanceof LegacySourceError) {
        return problem(c, 422, "Unprocessable Entity", err.message);
      }
      log.error("Legacy migrate apply failed", { error: String(err) });
      return problem(c, 500, "Internal Server Error", "Failed to apply v0.5 migration");
    } finally {
      applyInProgress = false;
    }
  });

  return router;
}
