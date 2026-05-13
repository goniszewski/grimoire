import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { Database } from "bun:sqlite";
import { Config } from "./config.js";
import { log } from "./logger.js";
import { JobQueue } from "./queue.js";
import { createHealthRoute } from "./routes/health.js";
import { createBookmarksRoute } from "./routes/bookmarks.js";
import { createSearchRoute } from "./routes/search.js";
import { createImportRoute } from "./routes/import.js";
import { createCategoriesRoute } from "./routes/categories.js";
import { createTagsRoute } from "./routes/tags.js";
import { createExportRoute } from "./routes/export.js";
import { createSettingsRoute } from "./routes/settings.js";
import { createDomainsRoute } from "./routes/domains.js";
import { createTimelineRoute } from "./routes/timeline.js";
import { createSuggestionsRoute } from "./routes/suggestions.js";
import { createBackupRoute } from "./routes/backup.js";
import { createMcpRoute } from "./routes/mcp.js";
import { join } from "path";
import { existsSync } from "fs";

export interface AppDeps {
  db: Database;
  queue: JobQueue;
  startTime: Date;
  version: string;
  staticDir?: string | false;
}

function isFrontendNavigation(c: Context): boolean {
  if (c.req.method !== "GET") return false;
  if (!c.req.header("Accept")?.includes("text/html")) return false;
  return !/\/[^/]+\.[^/]+$/.test(c.req.path);
}

function registerStaticFrontend(app: Hono, staticDir: string): void {
  if (!existsSync(staticDir)) return;

  app.get("*", serveStatic({ root: staticDir }));

  app.get("*", async (c) => {
    if (!isFrontendNavigation(c)) return c.notFound();

    const indexFile = Bun.file(join(staticDir, "index.html"));
    if (!(await indexFile.exists())) return c.notFound();

    return new Response(indexFile, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  });
}

/**
 * Creates and configures the Hono application.
 * Does NOT start the server — call Bun.serve() in index.ts.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  // Middleware
  app.use(
    "*",
    cors({
      origin: Config.CORS_ORIGINS,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  // JSON error handler — never leak internal details in production
  app.onError((err, c) => {
    const isProd = Config.NODE_ENV === "production";
    const message = isProd
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Internal server error";
    log.error("Unhandled request error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: message }, 500);
  });

  // Routes
  app.route("/", createHealthRoute(deps));
  app.route("/", createBookmarksRoute({ db: deps.db, queue: deps.queue }));
  app.route("/", createSearchRoute({ db: deps.db }));
  app.route("/", createImportRoute({ db: deps.db, queue: deps.queue }));
  app.route("/", createCategoriesRoute({ db: deps.db }));
  app.route("/", createTagsRoute({ db: deps.db }));
  app.route("/", createExportRoute({ db: deps.db }));
  app.route("/", createSettingsRoute());
  app.route("/", createDomainsRoute({ db: deps.db }));
  app.route("/", createTimelineRoute({ db: deps.db }));
  app.route("/", createSuggestionsRoute({ db: deps.db }));
  app.route("/", createBackupRoute({ db: deps.db, dbPath: join(Config.DATA_DIR, "littleimp.db") }));
  app.route("/", createMcpRoute({ db: deps.db, queue: deps.queue, version: deps.version }));

  if (deps.staticDir !== false) {
    registerStaticFrontend(app, deps.staticDir ?? join(import.meta.dir, "../../dist"));
  }

  return app;
}
