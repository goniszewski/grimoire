import { homedir } from "os";
import { join } from "path";

function resolveDataDir(raw: string): string {
  if (raw === "~" || raw.startsWith("~/")) {
    return join(homedir(), raw.slice(1));
  }
  return raw;
}

function parsePort(raw: string | undefined): number {
  const port = parseInt(raw ?? "3210", 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT value "${raw}". Must be an integer between 1 and 65535.`
    );
  }
  return port;
}

export const Config = {
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: parsePort(process.env.PORT),
  DATA_DIR: resolveDataDir(
    process.env.DATA_DIR ?? "~/.local/share/littleimp"
  ),
  // Comma-separated list of allowed CORS origins
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  LOG_FORMAT: (process.env.LOG_FORMAT ??
    (process.env.NODE_ENV === "production" ? "json" : "pretty")) as "pretty" | "json",
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // ─── LLM enrichment (TASK-007) ──────────────────────────────────────────────
  // Set LLM_API_KEY to enable enrichment. Leave blank to disable (bookmarks
  // remain fully usable without enrichment).
  LLM_API_KEY: process.env.LLM_API_KEY ?? "",
  LLM_BASE_URL: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  LLM_MODEL: process.env.LLM_MODEL ?? "gpt-4o-mini",

  // ─── Embeddings (TASK-008) ────────────────────────────────────────────────────
  // Shares API key with LLM by default; set EMBEDDING_API_KEY to override.
  // Leave EMBEDDING_API_KEY empty to disable embedding generation.
  EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY ?? process.env.LLM_API_KEY ?? "",
  EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL ?? process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
} as const;

export type AppConfig = typeof Config;
