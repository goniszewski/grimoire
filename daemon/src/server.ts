import { Hono } from "hono";
import type { Context } from "hono";
import type { Next } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { Database } from "bun:sqlite";
import { Config } from "./config.js";
import { log } from "./logger.js";
import { JobQueue } from "./queue.js";
import { createHealthRoute } from "./routes/health.js";
import { createDiagnosticsRoute } from "./routes/diagnostics.js";
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
import { createUpdatesRoute } from "./routes/updates.js";
import { createReprocessRoute } from "./routes/reprocess.js";
import { createMediaRoute } from "./routes/media.js";
import { createIntegrationTokensRoute } from "./routes/integration-tokens.js";
import { createCaptureRoute } from "./routes/capture.js";
import { createDemoRoute } from "./routes/demo.js";
import { validatePresentedIntegrationToken } from "./lib/integration-auth.js";
import { join } from "path";
import { existsSync } from "fs";

export interface AppDeps {
  db: Database;
  queue: JobQueue;
  startTime: Date;
  version: string;
  staticDir?: string | false;
  dataDir?: string;
}

const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const LOCAL_JSON_BODY_MAX_BYTES = 64 * 1024;
const CAPTURE_JSON_BODY_MAX_BYTES = 256 * 1024;

const LOCAL_JSON_BODY_LIMIT_PATHS = new Set([
  "/backup",
  "/backup/verify",
  "/backup/package",
  "/backup/package/verify",
  "/backup/destination",
  "/backup/schedule",
  "/bookmarks/reprocess",
  "/integration-tokens",
  "/restore",
  "/settings/test-s3",
  "/demo/load",
]);

function isFrontendNavigation(c: Context): boolean {
  if (c.req.method !== "GET") return false;
  if (!c.req.header("Accept")?.includes("text/html")) return false;
  return !/\/[^/]+\.[^/]+$/.test(c.req.path);
}

function normalizeOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function allowedLocalOrigins(): Set<string> {
  const origins = new Set<string>([
    `http://localhost:${Config.PORT}`,
    `http://127.0.0.1:${Config.PORT}`,
    `http://[::1]:${Config.PORT}`,
  ]);

  for (const origin of Config.CORS_ORIGINS) {
    const normalized = normalizeOrigin(origin);
    if (normalized && isLoopbackOrigin(normalized)) {
      origins.add(normalized);
    }
  }

  return origins;
}

function isAllowedLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return !!normalized && allowedLocalOrigins().has(normalized);
}

function isValidCspSourceOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return !parsed.hostname.includes(":") && !parsed.hostname.includes("[") && !parsed.hostname.includes("]");
  } catch {
    return false;
  }
}

function securityHeaders(): Record<string, string> {
  const connectSrc = ["'self'", ...[...allowedLocalOrigins()].filter(isValidCspSourceOrigin)].join(" ");
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src ${connectSrc}`,
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function bodyLimitFor(path: string, method: string): number | null {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;
  if (path === "/import") return IMPORT_MAX_BYTES;
  if (path === "/capture") return CAPTURE_JSON_BODY_MAX_BYTES;
  if (LOCAL_JSON_BODY_LIMIT_PATHS.has(path)) return LOCAL_JSON_BODY_MAX_BYTES;
  return null;
}

function declaredContentLength(c: Context): number | "invalid" | null {
  const raw = c.req.header("content-length");
  if (raw === undefined) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return "invalid";
  return parsed;
}

async function applySecurityHeaders(c: Context, next: Next): Promise<void> {
  await next();
  for (const [name, value] of Object.entries(securityHeaders())) {
    c.header(name, value);
  }
}

async function enforceLocalOrigin(c: Context, next: Next): Promise<Response | void> {
  const origin = c.req.header("origin");
  const method = c.req.method;
  const isPreflight = method === "OPTIONS" && !!c.req.header("access-control-request-method");
  if (isPreflight && origin && !isAllowedLocalOrigin(origin)) {
    return c.json({ error: "Origin is not allowed for this local daemon" }, 403);
  }

  const unsafeBrowserRequest = !!origin && method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (unsafeBrowserRequest && !isAllowedLocalOrigin(origin)) {
    return c.json({ error: "Origin is not allowed for this local daemon" }, 403);
  }
  await next();
}

async function enforceRequestBodyLimits(c: Context, next: Next): Promise<Response | void> {
  const limit = bodyLimitFor(c.req.path, c.req.method);
  const contentLength = declaredContentLength(c);
  if (limit !== null && contentLength === "invalid") {
    return c.json({ error: "Invalid Content-Length header" }, 400);
  }
  if (limit !== null && typeof contentLength === "number" && contentLength > limit) {
    return c.json({ error: `Request body exceeds ${limit} byte limit` }, 413);
  }
  await next();
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
  app.use("*", applySecurityHeaders);
  app.use("*", enforceLocalOrigin);
  app.use("*", enforceRequestBodyLimits);
  app.use(
    "*",
    cors({
      origin: (origin) => (isAllowedLocalOrigin(origin) ? origin : undefined),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use("*", validatePresentedIntegrationToken(deps.db, new Set(["/mcp", "/capture"])));

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
  app.route("/", createDiagnosticsRoute(deps));
  app.route("/", createBookmarksRoute({ db: deps.db, queue: deps.queue, dataDir: deps.dataDir ?? Config.DATA_DIR }));
  app.route("/", createCaptureRoute({ db: deps.db, queue: deps.queue }));
  app.route("/", createMediaRoute({ db: deps.db, dataDir: deps.dataDir ?? Config.DATA_DIR }));
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
  app.route("/", createUpdatesRoute());
  app.route("/", createReprocessRoute({ db: deps.db, queue: deps.queue }));
  app.route("/", createIntegrationTokensRoute({ db: deps.db }));
  app.route("/", createMcpRoute({ db: deps.db, queue: deps.queue, version: deps.version }));
  app.route("/", createDemoRoute({ db: deps.db }));

  if (deps.staticDir !== false) {
    registerStaticFrontend(app, deps.staticDir ?? join(import.meta.dir, "../../dist"));
  }

  return app;
}
