import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Settings } from "../../settings.js";
import { makeTestDb } from "../helpers/db.js";

let createApp: typeof import("../../server.js").createApp;
let JobQueue: typeof import("../../queue.js").JobQueue;
let settingsManager: typeof import("../../settings.js").settingsManager;
let Config: typeof import("../../config.js").Config;
let originalConfig: MutableConfig;

type MutableConfig = {
  DATA_DIR: string;
  HOST: string;
  PORT: number;
  NODE_ENV: string;
  LOG_FORMAT: "pretty" | "json";
};

describe("diagnostics endpoint", () => {
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  const configHome = mkdtempSync(join(tmpdir(), "littleimp-diagnostics-config-"));
  const dataDir = mkdtempSync(join(tmpdir(), "littleimp-diagnostics-data-"));
  const customBackupDir = mkdtempSync(join(tmpdir(), "littleimp-diagnostics-backups-"));
  let db: Database;

  beforeAll(async () => {
    process.env.XDG_CONFIG_HOME = configHome;
    ({ Config } = await import("../../config.js"));
    originalConfig = {
      DATA_DIR: Config.DATA_DIR,
      HOST: Config.HOST,
      PORT: Config.PORT,
      NODE_ENV: Config.NODE_ENV,
      LOG_FORMAT: Config.LOG_FORMAT,
    };
    (Config as MutableConfig).DATA_DIR = dataDir;
    (Config as MutableConfig).HOST = "127.0.0.1";
    (Config as MutableConfig).PORT = 3210;
    (Config as MutableConfig).NODE_ENV = "production";
    (Config as MutableConfig).LOG_FORMAT = "json";
    ({ createApp } = await import("../../server.js"));
    ({ JobQueue } = await import("../../queue.js"));
    ({ settingsManager } = await import("../../settings.js"));
  });

  beforeEach(() => {
    settingsManager.invalidate();
    db = makeTestDb();
  });

  afterEach(() => {
    settingsManager.invalidate();
    db.close();
    rmSync(join(configHome, "littleimp"), { recursive: true, force: true });
  });

  afterAll(() => {
    Object.assign(Config as MutableConfig, originalConfig);
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    rmSync(configHome, { recursive: true, force: true });
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(customBackupDir, { recursive: true, force: true });
  });

  it("returns local support context without exposing stored secrets", async () => {
    settingsManager.write({
      ai: {
        provider: "openai",
        openai: { api_key: "openai-secret", model: "gpt-diagnostics" },
        embeddings: {
          provider: "openai_compatible",
          openai_compatible: {
            api_key: "embedding-secret",
            base_url: "http://localhost:8000/v1",
            model: "custom-embed",
          },
        },
      } as Settings["ai"],
      app: {
        lock: { enabled: true, pin_hash: "pin-secret" },
      } as Settings["app"],
      backup: {
        local: { destination_path: customBackupDir },
        s3: {
          endpoint: "https://s3.example.test",
          bucket: "little-imp-test",
          access_key: "s3-access-secret",
          secret_key: "s3-secret-key",
          region: "us-west-2",
          prefix: "support/",
        },
      } as Settings["backup"],
    });

    const queue = new JobQueue(db);
    queue.enqueue("ingest", { bookmarkId: "bm_1", url: "https://example.com" });
    const app = createApp({
      db,
      queue,
      startTime: new Date("2026-05-27T08:00:00.000Z"),
      version: "9.9.9-test",
      staticDir: false,
    });

    const res = await app.request("/diagnostics");
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        version: string;
        platform: { os: string; arch: string; node_env: string; host: string; port: number };
        install: { mode: string };
        paths: {
          data_dir: string;
          database_path: string;
          config_file: string;
          backup_dir: string;
          log_files: Array<{ label: string; path: string }>;
        };
        daemon: { status: "ok"; queue_size: number; queue: { pending: number } };
        providers: {
          llm: { provider: string; configured: boolean; model: string | null; base_url: string | null };
          embeddings: { provider: string; configured: boolean; model: string | null; base_url: string | null };
        };
        backup: {
          local: { path: string; is_custom: boolean; writable: boolean };
          s3: { configured: boolean; endpoint: string; bucket: string; region: string; prefix: string };
        };
        search: { keyword: true; semantic: boolean; hybrid: boolean };
        omitted_secrets: string[];
      };
    };

    expect(json.data.version).toBe("9.9.9-test");
    expect(json.data.platform).toMatchObject({
      os: process.platform,
      arch: process.arch,
      node_env: "production",
      host: "127.0.0.1",
      port: 3210,
    });
    expect(json.data.install.mode).toBe("native");
    expect(json.data.paths.data_dir).toBe(dataDir);
    expect(json.data.paths.database_path).toBe(join(dataDir, "littleimp.db"));
    expect(json.data.paths.config_file).toBe(join(configHome, "littleimp", "config.json"));
    expect(json.data.paths.backup_dir).toBe(customBackupDir);
    expect(json.data.paths.log_files.map((entry) => entry.path)).toContain(join(dataDir, "logs", "daemon.log"));
    expect(json.data.daemon.queue_size).toBe(1);
    expect(json.data.daemon.queue.pending).toBe(1);
    expect(json.data.providers.llm).toMatchObject({
      provider: "openai",
      configured: true,
      model: "gpt-diagnostics",
      base_url: "https://api.openai.com/v1",
    });
    expect(json.data.providers.embeddings).toMatchObject({
      provider: "openai_compatible",
      configured: true,
      model: "custom-embed",
      base_url: "http://localhost:8000/v1",
    });
    expect(json.data.backup.local).toMatchObject({
      path: customBackupDir,
      is_custom: true,
      writable: true,
    });
    expect(json.data.backup.s3).toEqual({
      configured: true,
      endpoint: "https://s3.example.test",
      bucket: "little-imp-test",
      region: "us-west-2",
      prefix: "support/",
    });
    expect(json.data.search).toEqual({ keyword: true, semantic: true, hybrid: true });
    expect(json.data.omitted_secrets).toContain("AI provider API keys");
    expect(JSON.stringify(json)).not.toContain("openai-secret");
    expect(JSON.stringify(json)).not.toContain("embedding-secret");
    expect(JSON.stringify(json)).not.toContain("pin-secret");
    expect(JSON.stringify(json)).not.toContain("s3-access-secret");
    expect(JSON.stringify(json)).not.toContain("s3-secret-key");
  });

  it("redacts URL credentials, query strings, and fragments", async () => {
    settingsManager.write({
      ai: {
        provider: "openai_compatible",
        openai_compatible: {
          api_key: "openai-compatible-secret",
          base_url: "https://llm-user:llm-pass@llm.example.test/v1?token=llm-secret#llm-frag",
          model: "diagnostic-compatible",
        },
        embeddings: {
          provider: "openai_compatible",
          openai_compatible: {
            api_key: "embedding-compatible-secret",
            base_url: "https://embed-user:embed-pass@embed.example.test/vectors?api_key=embed-secret#embed-frag",
            model: "diagnostic-embed",
          },
        },
      } as Settings["ai"],
      backup: {
        s3: {
          endpoint: "https://s3-user:s3-pass@s3.example.test?token=s3-secret#s3-frag",
          bucket: "little-imp-test",
          access_key: "s3-access-secret",
          secret_key: "s3-secret-key",
          region: "",
          prefix: "",
        },
      } as Settings["backup"],
    });

    const app = createApp({
      db,
      queue: new JobQueue(db),
      startTime: new Date("2026-05-27T08:00:00.000Z"),
      version: "9.9.9-test",
      staticDir: false,
    });

    const res = await app.request("/diagnostics");
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        providers: {
          llm: { base_url: string | null };
          embeddings: { base_url: string | null };
        };
        backup: { s3: { endpoint: string } };
        omitted_secrets: string[];
      };
    };

    expect(json.data.providers.llm.base_url).toBe("https://llm.example.test/v1");
    expect(json.data.providers.embeddings.base_url).toBe("https://embed.example.test/vectors");
    expect(json.data.backup.s3.endpoint).toBe("https://s3.example.test");
    expect(json.data.omitted_secrets).toContain("URL credentials, query strings, and fragments");

    const payload = JSON.stringify(json);
    for (const sensitive of [
      "llm-user",
      "llm-pass",
      "llm-secret",
      "llm-frag",
      "embed-user",
      "embed-pass",
      "embed-secret",
      "embed-frag",
      "s3-user",
      "s3-pass",
      "s3-secret",
      "s3-frag",
      "openai-compatible-secret",
      "embedding-compatible-secret",
      "s3-access-secret",
      "s3-secret-key",
    ]) {
      expect(payload).not.toContain(sensitive);
    }
  });
});
