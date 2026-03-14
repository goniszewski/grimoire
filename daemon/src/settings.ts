/**
 * Settings manager — reads/writes user preferences to a JSON config file.
 *
 * Config file location: ~/.config/littleimp/config.json (XDG-compliant)
 * API keys are write-only: GET responses always redact them.
 */

import { homedir } from "os";
import { join } from "path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { log } from "./logger.js";
import { Config } from "./config.js";

// ─── Config file path ─────────────────────────────────────────────────────────

const CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
  "littleimp"
);
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

// ─── Settings schema ──────────────────────────────────────────────────────────

export interface AiSettings {
  provider: "openai" | "ollama" | "none";
  openai: {
    api_key: string;
    model: string;
  };
  ollama: {
    base_url: string;
    model: string;
  };
  embeddings: {
    provider: "openai" | "ollama";
    model: string;
  };
}

export interface AppSettings {
  autostart: boolean;
  theme: "light" | "dark" | "system";
  lock: {
    enabled: boolean;
    pin_hash: string;
  };
}

export interface BackupScheduleSettings {
  enabled: boolean;
  /** 5-part cron expression, e.g. "0 3 * * *" */
  cron: string;
  /** Maximum number of local backup snapshots to retain. */
  retention_count: number;
}

export interface BackupLocalSettings {
  /**
   * Absolute path to a custom backup folder.
   * Empty string = use DATA_DIR/backups/ (default).
   * Point to a cloud-synced folder (iCloud Drive, Dropbox, etc.) to get offsite backups
   * without any API — the OS sync client handles the rest.
   */
  destination_path: string;
}

export interface BackupS3Settings {
  /** Custom endpoint URL for S3-compatible services (R2, MinIO). Empty = use AWS. */
  endpoint: string;
  bucket: string;
  access_key: string;
  secret_key: string;
  region: string;
  prefix: string;
}

export interface Settings {
  ai: AiSettings;
  app: AppSettings;
  backup: {
    local: BackupLocalSettings;
    schedule: BackupScheduleSettings;
    s3: BackupS3Settings;
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Settings = {
  ai: {
    provider: "none",
    openai: {
      api_key: "",
      model: "gpt-4o-mini",
    },
    ollama: {
      base_url: "http://localhost:11434",
      model: "llama3",
    },
    embeddings: {
      provider: "openai",
      model: "text-embedding-3-small",
    },
  },
  app: {
    autostart: false,
    theme: "system",
    lock: {
      enabled: false,
      pin_hash: "",
    },
  },
  backup: {
    local: {
      destination_path: "",
    },
    schedule: {
      enabled: Config.BACKUP_SCHEDULE_ENABLED,
      cron: Config.BACKUP_SCHEDULE_CRON,
      retention_count: Config.BACKUP_RETENTION_COUNT,
    },
    s3: {
      endpoint: Config.BACKUP_S3_ENDPOINT,
      bucket: Config.BACKUP_S3_BUCKET,
      access_key: Config.BACKUP_S3_ACCESS_KEY,
      secret_key: Config.BACKUP_S3_SECRET_KEY,
      region: Config.BACKUP_S3_REGION,
      prefix: Config.BACKUP_S3_PREFIX,
    },
  },
};

// ─── Deep merge helper ────────────────────────────────────────────────────────

/**
 * Deep-merge `override` into `base`, only for keys that exist in `base`.
 * Unknown keys in `override` are silently dropped (allowlist approach).
 * null values in `override` are ignored (cannot wipe out sub-objects).
 */
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(base) as (keyof T)[]) {
    const val = override[key];
    if (val === undefined) continue; // not present in patch — keep base value
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof base[key] === "object" &&
      base[key] !== null
    ) {
      result[key] = deepMerge(base[key] as object, val as object) as T[keyof T];
    } else if (val !== null) {
      // Reject null: callers cannot null-out a sub-object
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

// ─── Settings validation ──────────────────────────────────────────────────────

const VALID_AI_PROVIDERS = new Set(["openai", "ollama", "none"]);
const VALID_EMBEDDING_PROVIDERS = new Set(["openai", "ollama"]);
const VALID_THEMES = new Set(["light", "dark", "system"]);

/**
 * Validates a settings patch before it reaches deepMerge.
 * Returns an error message string if invalid, null if OK.
 */
export function validateSettingsPatch(patch: unknown): string | null {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return "Settings patch must be an object";
  }

  const p = patch as Record<string, unknown>;

  if ("ai" in p) {
    const ai = p.ai;
    if (typeof ai !== "object" || ai === null || Array.isArray(ai)) {
      return "`ai` must be an object";
    }
    const a = ai as Record<string, unknown>;

    if ("provider" in a) {
      if (typeof a.provider !== "string" || !VALID_AI_PROVIDERS.has(a.provider)) {
        return `\`ai.provider\` must be one of: ${[...VALID_AI_PROVIDERS].join(", ")}`;
      }
    }

    if ("openai" in a) {
      const o = a.openai;
      if (typeof o !== "object" || o === null || Array.isArray(o)) {
        return "`ai.openai` must be an object";
      }
      const oo = o as Record<string, unknown>;
      if ("api_key" in oo && typeof oo.api_key !== "string") return "`ai.openai.api_key` must be a string";
      if ("model" in oo && (typeof oo.model !== "string" || !(oo.model as string).trim())) return "`ai.openai.model` must be a non-empty string";
    }

    if ("ollama" in a) {
      const o = a.ollama;
      if (typeof o !== "object" || o === null || Array.isArray(o)) {
        return "`ai.ollama` must be an object";
      }
      const oo = o as Record<string, unknown>;
      if ("base_url" in oo) {
        if (typeof oo.base_url !== "string") return "`ai.ollama.base_url` must be a string";
        try { new URL(oo.base_url as string); } catch { return "`ai.ollama.base_url` must be a valid URL"; }
      }
      if ("model" in oo && (typeof oo.model !== "string" || !(oo.model as string).trim())) return "`ai.ollama.model` must be a non-empty string";
    }

    if ("embeddings" in a) {
      const e = a.embeddings;
      if (typeof e !== "object" || e === null || Array.isArray(e)) {
        return "`ai.embeddings` must be an object";
      }
      const ee = e as Record<string, unknown>;
      if ("provider" in ee && (typeof ee.provider !== "string" || !VALID_EMBEDDING_PROVIDERS.has(ee.provider as string))) {
        return `\`ai.embeddings.provider\` must be one of: ${[...VALID_EMBEDDING_PROVIDERS].join(", ")}`;
      }
      if ("model" in ee && (typeof ee.model !== "string" || !(ee.model as string).trim())) return "`ai.embeddings.model` must be a non-empty string";
    }
  }

  if ("app" in p) {
    const app = p.app;
    if (typeof app !== "object" || app === null || Array.isArray(app)) {
      return "`app` must be an object";
    }
    const a = app as Record<string, unknown>;

    if ("autostart" in a && typeof a.autostart !== "boolean") return "`app.autostart` must be a boolean";
    if ("theme" in a && (typeof a.theme !== "string" || !VALID_THEMES.has(a.theme as string))) {
      return `\`app.theme\` must be one of: ${[...VALID_THEMES].join(", ")}`;
    }

    if ("lock" in a) {
      const lock = a.lock;
      if (typeof lock !== "object" || lock === null || Array.isArray(lock)) {
        return "`app.lock` must be an object";
      }
      const l = lock as Record<string, unknown>;
      if ("enabled" in l && typeof l.enabled !== "boolean") return "`app.lock.enabled` must be a boolean";
      if ("pin_hash" in l && typeof l.pin_hash !== "string") return "`app.lock.pin_hash` must be a string";
    }
  }

  if ("backup" in p) {
    const backup = p.backup;
    if (typeof backup !== "object" || backup === null || Array.isArray(backup)) {
      return "`backup` must be an object";
    }
    const b = backup as Record<string, unknown>;

    if ("local" in b) {
      const local = b.local;
      if (typeof local !== "object" || local === null || Array.isArray(local)) {
        return "`backup.local` must be an object";
      }
      const l = local as Record<string, unknown>;
      if ("destination_path" in l) {
        if (typeof l.destination_path !== "string") {
          return "`backup.local.destination_path` must be a string";
        }
        const dp = l.destination_path as string;
        if (dp !== "" && !dp.startsWith("/")) {
          return "`backup.local.destination_path` must be an absolute path (starting with /) or an empty string to use the default";
        }
        if (dp.includes("..")) {
          return "`backup.local.destination_path` must not contain path traversal sequences (..)";
        }
      }
    }

    if ("schedule" in b) {
      const schedule = b.schedule;
      if (typeof schedule !== "object" || schedule === null || Array.isArray(schedule)) {
        return "`backup.schedule` must be an object";
      }
      const s = schedule as Record<string, unknown>;
      if ("enabled" in s && typeof s.enabled !== "boolean") return "`backup.schedule.enabled` must be a boolean";
      if ("cron" in s) {
        if (typeof s.cron !== "string" || !(s.cron as string).trim()) {
          return "`backup.schedule.cron` must be a non-empty string";
        }
        const parts = (s.cron as string).trim().split(/\s+/);
        if (parts.length !== 5) {
          return "`backup.schedule.cron` must be a 5-part cron expression (e.g. \"0 3 * * *\")";
        }
      }
      if ("retention_count" in s) {
        const rc = s.retention_count;
        if (typeof rc !== "number" || !Number.isInteger(rc) || rc < 1) {
          return "`backup.schedule.retention_count` must be a positive integer";
        }
      }
    }

    if ("s3" in b) {
      const s3 = b.s3;
      if (typeof s3 !== "object" || s3 === null || Array.isArray(s3)) {
        return "`backup.s3` must be an object";
      }
      const s = s3 as Record<string, unknown>;
      const strFields = ["endpoint", "bucket", "access_key", "secret_key", "region", "prefix"] as const;
      for (const field of strFields) {
        if (field in s && typeof s[field] !== "string") {
          return `\`backup.s3.${field}\` must be a string`;
        }
      }
      if ("endpoint" in s && s.endpoint) {
        try { new URL(s.endpoint as string); } catch { return "`backup.s3.endpoint` must be a valid URL or empty string"; }
      }
    }
  }

  return null;
}

// ─── Redaction ────────────────────────────────────────────────────────────────

/** Returns settings with API keys replaced by a sentinel so callers know one is set. */
export function redactSettings(settings: Settings): object {
  return {
    ...settings,
    ai: {
      ...settings.ai,
      openai: {
        ...settings.ai.openai,
        api_key: settings.ai.openai.api_key ? "***" : "",
      },
    },
    app: {
      ...settings.app,
      lock: {
        ...settings.app.lock,
        pin_hash: settings.app.lock.pin_hash ? "***" : "",
      },
    },
    backup: {
      ...settings.backup,
      s3: {
        ...settings.backup.s3,
        secret_key: settings.backup.s3.secret_key ? "***" : "",
        access_key: settings.backup.s3.access_key ? "***" : "",
      },
    } as Settings["backup"],
  };
}

// ─── SettingsManager ──────────────────────────────────────────────────────────

export class SettingsManager {
  private cache: Settings | null = null;

  read(): Settings {
    if (this.cache) return this.cache;

    if (!existsSync(CONFIG_FILE)) {
      this.cache = structuredClone(DEFAULT_SETTINGS);
      return this.cache;
    }

    try {
      const raw = readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Settings>;
      this.cache = deepMerge(DEFAULT_SETTINGS, parsed);
      return this.cache;
    } catch (err) {
      log.error("Failed to read settings file, using defaults", {
        file: CONFIG_FILE,
        error: String(err),
      });
      this.cache = structuredClone(DEFAULT_SETTINGS);
      return this.cache;
    }
  }

  write(patch: Partial<Settings>): Settings {
    const current = this.read();
    const updated = deepMerge(current, patch);

    try {
      // 0o700: owner rwx only — config file contains API keys and S3 credentials.
      mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
      // 0o600: owner read/write only.
      writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), { encoding: "utf-8", mode: 0o600 });
      this.cache = updated;
      log.info("Settings saved", { file: CONFIG_FILE });
    } catch (err) {
      log.error("Failed to write settings file", {
        file: CONFIG_FILE,
        error: String(err),
      });
      throw new Error(`Could not persist settings: ${String(err)}`);
    }

    return updated;
  }

  /** Invalidate cache (e.g. after provider change). */
  invalidate(): void {
    this.cache = null;
  }
}

// Singleton used across the daemon
export const settingsManager = new SettingsManager();
