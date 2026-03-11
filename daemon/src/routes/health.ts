import { Hono } from "hono";
import { JobQueue } from "../queue.js";

interface HealthDeps {
  queue: JobQueue;
  startTime: Date;
  version: string;
}

export function createHealthRoute(deps: HealthDeps): Hono {
  const router = new Hono();

  router.get("/health", (c) => {
    const uptimeMs = Date.now() - deps.startTime.getTime();
    return c.json({
      status: "ok",
      version: deps.version,
      uptime: uptimeMs,
      queueSize: deps.queue.size(),
    });
  });

  return router;
}
