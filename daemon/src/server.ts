import { Hono } from "hono";
import { cors } from "hono/cors";
import { Config } from "./config.js";
import { log } from "./logger.js";
import { JobQueue } from "./queue.js";
import { createHealthRoute } from "./routes/health.js";

export interface AppDeps {
  queue: JobQueue;
  startTime: Date;
  version: string;
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

  return app;
}
