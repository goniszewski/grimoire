import { version as VERSION } from "../package.json";
import { Config } from "./config.js";
import { log } from "./logger.js";
import { JobQueue } from "./queue.js";
import { JobWorker } from "./worker.js";
import { Scheduler } from "./scheduler.js";
import { createApp } from "./server.js";

const startTime = new Date();

// --- Initialise components ---
const queue = new JobQueue();
const worker = new JobWorker(queue);
const scheduler = new Scheduler();

// --- Register scheduled tasks before start() ---
scheduler.register("heartbeat", 60_000, () => {
  log.info("Heartbeat", { uptime: Date.now() - startTime.getTime() });
});

const app = createApp({ queue, startTime, version: VERSION });

// --- Start ---
worker.start();
scheduler.start();

const server = Bun.serve({
  fetch: app.fetch,
  port: Config.PORT,
  hostname: Config.HOST,
});

log.info("littleimpd started", {
  host: Config.HOST,
  port: Config.PORT,
  dataDir: Config.DATA_DIR,
  version: VERSION,
});

// --- Graceful shutdown ---
async function shutdown(signal: string): Promise<void> {
  log.info(`Received ${signal}, shutting down…`);

  log.info("Shutting down worker…");
  await worker.stop();

  log.info("Shutting down scheduler…");
  await scheduler.stop();

  log.info("Shutting down server…");
  server.stop(true);

  log.info("Shutdown complete");
  process.exit(0);
}

function handleSignal(signal: string): void {
  shutdown(signal).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Shutdown error", { signal, error: msg });
    process.exit(1);
  });
}

process.on("SIGTERM", () => handleSignal("SIGTERM"));
process.on("SIGINT",  () => handleSignal("SIGINT"));
