import { accessSync, constants as fsConstants } from "fs";
import { arch, platform } from "os";
import { join, resolve, isAbsolute } from "path";
import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { Config } from "../config.js";
import { JobQueue } from "../queue.js";
import { getConfigFile } from "../settings.js";
import { settingsManager } from "../settings.js";
import { resolveRuntimeSettings } from "../runtime-settings.js";
import { nextCronRunAt } from "../lib/cron.js";
import { s3ConfigPresent } from "../lib/s3.js";

interface DiagnosticsDeps {
  db: Database;
  queue: JobQueue;
  startTime: Date;
  version: string;
  staticDir?: string | false;
}

interface QueueCounts {
  pending: number;
  running: number;
  done: number;
  failed: number;
}

type InstallMode = "development" | "native" | "docker";

function checkWritable(path: string): boolean {
  try {
    accessSync(path, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function redactDiagnosticUrl(raw: string | null): string | null {
  if (!raw) {
    return raw;
  }

  try {
    const hasExplicitRootPath = /^[a-z][a-z\d+\-.]*:\/\/[^/?#]*\//i.test(raw);
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    const redacted = url.toString();
    return !hasExplicitRootPath && url.pathname === "/" ? redacted.slice(0, -1) : redacted;
  } catch {
    return null;
  }
}

function isQueueCountKey(status: string): status is keyof QueueCounts {
  return status === "pending" || status === "running" || status === "done" || status === "failed";
}

function detectInstallMode(): InstallMode {
  const configured = process.env.LITTLEIMP_INSTALL_MODE;
  if (configured === "development" || configured === "native" || configured === "docker") {
    return configured;
  }
  if (Config.DATA_DIR === "/data" || process.env.container === "docker") {
    return "docker";
  }
  return Config.NODE_ENV === "production" ? "native" : "development";
}

function resolveBackupDir(): { path: string; isCustom: boolean } {
  const customPath = settingsManager.read().backup.local.destination_path;
  if (customPath && isAbsolute(customPath)) {
    return { path: resolve(customPath), isCustom: true };
  }
  return { path: resolve(join(Config.DATA_DIR, "backups")), isCustom: false };
}

function queueCounts(db: Database, queue: JobQueue): QueueCounts {
  const counts: QueueCounts = {
    pending: queue.size(),
    running: 0,
    done: 0,
    failed: 0,
  };

  try {
    const rows = db
      .query<{ status: string; count: number }, []>(
        "SELECT status, COUNT(*) AS count FROM jobs GROUP BY status"
      )
      .all();
    for (const row of rows) {
      if (isQueueCountKey(row.status)) {
        counts[row.status] = row.count;
      }
    }
  } catch {
    // Keep the in-memory queue fallback for lightweight test queues or older DBs.
  }

  return counts;
}

export function createDiagnosticsRoute(deps: DiagnosticsDeps): Hono {
  const router = new Hono();

  router.get("/diagnostics", (c) => {
    const settings = settingsManager.read();
    const runtime = resolveRuntimeSettings(settings).runtime;
    const backupDir = resolveBackupDir();
    const backupSchedule = settings.backup.schedule;
    const counts = queueCounts(deps.db, deps.queue);
    const logDir = join(Config.DATA_DIR, "logs");

    return c.json({
      data: {
        generated_at: new Date().toISOString(),
        version: deps.version,
        platform: {
          os: platform(),
          arch: arch(),
          bun_version: Bun.version,
          node_env: Config.NODE_ENV,
          host: Config.HOST,
          port: Config.PORT,
        },
        install: {
          mode: detectInstallMode(),
        },
        paths: {
          data_dir: Config.DATA_DIR,
          database_path: join(Config.DATA_DIR, "littleimp.db"),
          config_file: getConfigFile(),
          backup_dir: backupDir.path,
          frontend_dist: deps.staticDir === false ? null : (deps.staticDir ?? join(import.meta.dir, "../../dist")),
          log_files: [
            { label: "daemon stdout", path: join(logDir, "daemon.log") },
            { label: "daemon stderr", path: join(logDir, "daemon.error.log") },
          ],
        },
        daemon: {
          status: "ok",
          uptime_ms: Date.now() - deps.startTime.getTime(),
          queue_size: deps.queue.size(),
          queue: counts,
        },
        providers: {
          llm: {
            provider: runtime.llm.provider,
            configured: runtime.llm.enabled,
            model: runtime.llm.model,
            base_url: redactDiagnosticUrl(runtime.llm.base_url),
          },
          embeddings: {
            provider: runtime.embeddings.provider,
            configured: runtime.embeddings.enabled,
            model: runtime.embeddings.model,
            base_url: redactDiagnosticUrl(runtime.embeddings.base_url),
          },
        },
        backup: {
          local: {
            path: backupDir.path,
            is_custom: backupDir.isCustom,
            writable: checkWritable(backupDir.path),
          },
          schedule: {
            enabled: backupSchedule.enabled,
            cron: backupSchedule.cron,
            retention_count: backupSchedule.retention_count,
            next_run_at: backupSchedule.enabled ? nextCronRunAt(backupSchedule.cron)?.toISOString() ?? null : null,
          },
          s3: {
            configured: s3ConfigPresent(settings.backup.s3),
            endpoint: redactDiagnosticUrl(settings.backup.s3.endpoint) ?? "",
            bucket: settings.backup.s3.bucket,
            region: settings.backup.s3.region,
            prefix: settings.backup.s3.prefix,
          },
        },
        search: {
          keyword: true,
          semantic: runtime.capabilities.semantic_search,
          hybrid: runtime.capabilities.semantic_search,
        },
        omitted_secrets: [
          "AI provider API keys",
          "embedding provider API keys",
          "app lock PIN hash",
          "S3 access key",
          "S3 secret key",
          "backup package passwords",
          "URL credentials, query strings, and fragments",
        ],
      },
    });
  });

  return router;
}
