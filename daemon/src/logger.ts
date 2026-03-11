import { Config } from "./config.js";

type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function formatPretty(level: LogLevel, msg: string, ctx?: LogContext): string {
  const ts = new Date().toISOString();
  const prefix = {
    info:  "\x1b[32mINFO\x1b[0m",
    warn:  "\x1b[33mWARN\x1b[0m",
    error: "\x1b[31mERROR\x1b[0m",
  }[level];
  const ctxStr = ctx ? " " + JSON.stringify(ctx) : "";
  return `${ts} ${prefix} ${msg}${ctxStr}`;
}

function formatJson(level: LogLevel, msg: string, ctx?: LogContext): string {
  // Context is nested under "ctx" to prevent caller keys from overwriting
  // structured fields (ts, level, msg).
  return JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(ctx ? { ctx } : {}) });
}

function write(level: LogLevel, msg: string, ctx?: LogContext): void {
  const line = Config.LOG_FORMAT === "json"
    ? formatJson(level, msg, ctx)
    : formatPretty(level, msg, ctx);

  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  info:  (msg: string, ctx?: LogContext) => write("info",  msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => write("warn",  msg, ctx),
  error: (msg: string, ctx?: LogContext) => write("error", msg, ctx),
};
