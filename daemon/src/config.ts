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
} as const;

export type AppConfig = typeof Config;
