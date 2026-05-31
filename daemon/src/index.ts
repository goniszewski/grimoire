import { version as VERSION } from "../package.json";
import { Config } from "./config.js";
import { log } from "./logger.js";
import { JobQueue } from "./queue.js";
import { JobWorker } from "./worker.js";
import { Scheduler } from "./scheduler.js";
import { createApp } from "./server.js";
import { getDatabase, closeDatabase } from "./db/database.js";
import { runEmbeddingRefresh, runPipeline } from "./pipeline/pipeline.js";
import { OrganizationAgent } from "./ai/organization-agent.js";
import { BookmarkRepository } from "./db/bookmark-repository.js";
import type { IngestJobPayload, ReprocessJobPayload } from "./types/job.js";
import { join } from "path";
import { createBackupSnapshot, applyRetentionPolicy } from "./routes/backup.js";
import { settingsManager } from "./settings.js";
import { cronToIntervalMs } from "./lib/cron.js";

const startTime = new Date();

// --- Initialise components ---
const db = getDatabase(); // opens DB, runs migrations
const queue = new JobQueue(db);
const worker = new JobWorker(queue);
const scheduler = new Scheduler();

// --- Register job handlers ---
worker.registerHandler("ingest", async (job) => {
  const payload = job.payload as IngestJobPayload;
  await runPipeline(db, { bookmarkId: payload.bookmarkId, url: payload.url });
});

worker.registerHandler("reprocess", async (job) => {
  const payload = job.payload as ReprocessJobPayload;
  if (payload.mode === "embeddings_only") {
    await runEmbeddingRefresh(db, { bookmarkId: payload.bookmarkId });
    return;
  }

  await runPipeline(
    db,
    { bookmarkId: payload.bookmarkId, url: payload.url },
    { replaceAiFields: payload.replaceAiFields }
  );
});

// --- Register scheduled tasks before start() ---
scheduler.register("heartbeat", 60_000, () => {
  log.info("Heartbeat", { uptime: Date.now() - startTime.getTime() });
});

const AGENT_INTERVAL_MS = parseInt(process.env.AGENT_INTERVAL_MS ?? "", 10) || 24 * 60 * 60_000; // default: daily
const agent = new OrganizationAgent(db);
scheduler.register("organization-agent", AGENT_INTERVAL_MS, () => agent.run());

const bookmarkRepo = new BookmarkRepository(db, { dataDir: Config.DATA_DIR });
const PURGE_INTERVAL_MS = parseInt(process.env.PURGE_INTERVAL_MS ?? "", 10) || 24 * 60 * 60_000; // default: daily
scheduler.register("trash-purge", PURGE_INTERVAL_MS, () => {
  const count = bookmarkRepo.purgeExpired(30);
  if (count > 0) log.info("Trash purge: deleted expired bookmarks", { count });
});

// ─── Backup snapshot scheduler ────────────────────────────────────────────────
// Always register the task — it reads live settings on each fire so that
// enabling/disabling or changing the cron expression via PUT /backup/schedule
// takes effect without restarting the daemon. The interval is fixed at startup
// to the configured (or default) cron heuristic; changing the cron expression
// affects next_run_at display but not the firing interval until next restart.
const backupsDir = join(Config.DATA_DIR, "backups");
const backupInitialSettings = settingsManager.read().backup.schedule;
const backupIntervalMs = cronToIntervalMs(backupInitialSettings.cron);
scheduler.register("backup-snapshot", backupIntervalMs, async () => {
  const settings = settingsManager.read().backup.schedule;
  if (!settings.enabled) return; // honour live enable/disable without restart
  try {
    await createBackupSnapshot(db, backupsDir);
    const deleted = applyRetentionPolicy(backupsDir, settings.retention_count);
    if (deleted > 0) log.info("Backup snapshot: retention applied", { deleted });
  } catch (err) {
    log.error("Backup snapshot: failed", { error: String(err) });
  }
});

const app = createApp({ db, queue, startTime, version: VERSION });

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

  log.info("Closing database…");
  closeDatabase();

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
