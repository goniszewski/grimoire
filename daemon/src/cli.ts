#!/usr/bin/env bun
import { version as APP_VERSION } from "../package.json";
import { verifyBackupDirectory, BackupVerificationError } from "./backup/verification.js";

const DEFAULT_DAEMON_URL = "http://127.0.0.1:3210";

type CliEnv = Record<string, string | undefined>;

type CliIO = {
  env?: CliEnv;
  fetch?: typeof fetch;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
};

type ParsedArgs = {
  flags: Set<string>;
  values: Map<string, string>;
  positionals: string[];
};

type ArgSpec = {
  booleanFlags?: string[];
  valueFlags?: string[];
};

type BackupEntry = {
  name: string;
  path: string;
  size_bytes: number;
  bookmark_count: number;
  created_at: string;
  source: "local" | "remote";
};

class CliError extends Error {
  constructor(message: string, readonly code = 1) {
    super(message);
    this.name = "CliError";
  }
}

function parseArgs(args: string[], spec: ArgSpec): ParsedArgs {
  const booleanFlags = new Set(spec.booleanFlags ?? []);
  const valueFlags = new Set(spec.valueFlags ?? []);
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf("=");
    const rawName = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : arg.slice(equalsIndex + 1);
    if (valueFlags.has(rawName)) {
      const value = inlineValue ?? args[++i];
      if (!value || value.startsWith("--")) {
        throw new CliError(`${rawName} requires a value`, 2);
      }
      values.set(rawName, value);
      continue;
    }

    if (!booleanFlags.has(rawName)) {
      throw new CliError(`Unknown option for this command: ${rawName}`, 2);
    }

    if (inlineValue !== undefined) {
      throw new CliError(`${rawName} does not take a value`, 2);
    }
    flags.add(rawName);
  }

  return { flags, values, positionals };
}

function getDaemonUrl(parsed: ParsedArgs, env: CliEnv): string {
  const configured = parsed.values.get("--daemon-url") ?? env.LITTLEIMP_DAEMON_URL;
  const raw = configured?.trim() ? configured.trim() : DEFAULT_DAEMON_URL;
  return raw.replace(/\/+$/, "");
}

function assertNoPositionals(parsed: ParsedArgs, command: string): void {
  if (parsed.positionals.length > 0) {
    throw new CliError(`Unexpected argument for backup ${command}: ${parsed.positionals[0]}`, 2);
  }
}

async function requestJson<T>(
  io: Required<Pick<CliIO, "fetch">>,
  url: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await io.fetch(url, init);
  } catch (err) {
    throw new CliError(`Could not connect to littleimpd at ${url}: ${String(err)}`);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new CliError(`littleimpd returned non-JSON response with status ${res.status}`);
    }
  }

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `littleimpd request failed with status ${res.status}`;
    throw new CliError(message);
  }

  return payload as T;
}

function printJson(io: Required<Pick<CliIO, "stdout">>, value: unknown): void {
  io.stdout(JSON.stringify(value, null, 2));
}

function printCreateResult(io: Required<Pick<CliIO, "stdout">>, result: {
  path: string;
  size_bytes: number;
  bookmark_count: number;
  created_at: string;
  remote_url?: string;
}): void {
  io.stdout(`Backup created: ${result.path}`);
  io.stdout(`Bookmarks: ${result.bookmark_count}`);
  io.stdout(`Size: ${result.size_bytes} bytes`);
  if (result.remote_url) io.stdout(`Remote: ${result.remote_url}`);
}

function printBackupList(io: Required<Pick<CliIO, "stdout">>, entries: BackupEntry[]): void {
  if (entries.length === 0) {
    io.stdout("No backups found.");
    return;
  }
  for (const entry of entries) {
    io.stdout(`${entry.created_at}  ${entry.source.padEnd(6)}  ${entry.name}  ${entry.path}`);
  }
}

function printRestoreResult(io: Required<Pick<CliIO, "stdout">>, result: {
  restored_at: string;
  bookmark_count: number;
  checksum_verified: boolean;
  rollback_path: string;
  restart_required: boolean;
}): void {
  io.stdout(`Backup restored at ${result.restored_at}`);
  io.stdout(`Bookmarks: ${result.bookmark_count}`);
  io.stdout(`Rollback: ${result.rollback_path}`);
  if (result.restart_required) {
    io.stdout("Restart required: restart littleimpd before using the restored database.");
  }
}

function usage(): string {
  return [
    `littleimp ${APP_VERSION}`,
    "",
    "Usage:",
    "  littleimp backup create [--json] [--daemon-url URL]",
    "  littleimp backup list [--include-remote] [--json] [--daemon-url URL]",
    "  littleimp backup restore <name> --yes [--json] [--daemon-url URL]",
    "  littleimp backup restore --remote-key <key> --yes [--json] [--daemon-url URL]",
    "  littleimp backup verify --file <snapshot-directory> [--json]",
    "",
    "Environment:",
    "  LITTLEIMP_DAEMON_URL  Defaults to http://127.0.0.1:3210",
  ].join("\n");
}

async function handleBackupCommand(args: string[], io: Required<CliIO>): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    io.stdout(usage());
    return command ? 0 : 2;
  }

  if (command === "create") {
    const parsed = parseArgs(rest, {
      booleanFlags: ["--json"],
      valueFlags: ["--daemon-url"],
    });
    assertNoPositionals(parsed, command);
    const json = parsed.flags.has("--json");
    const daemonUrl = getDaemonUrl(parsed, io.env);
    const result = await requestJson<{
      path: string;
      size_bytes: number;
      bookmark_count: number;
      created_at: string;
      remote_url?: string;
    }>(io, `${daemonUrl}/backup`, { method: "POST" });
    if (json) printJson(io, result);
    else printCreateResult(io, result);
    return 0;
  }

  if (command === "list") {
    const parsed = parseArgs(rest, {
      booleanFlags: ["--include-remote", "--json"],
      valueFlags: ["--daemon-url"],
    });
    assertNoPositionals(parsed, command);
    const json = parsed.flags.has("--json");
    const daemonUrl = getDaemonUrl(parsed, io.env);
    const includeRemote = parsed.flags.has("--include-remote");
    const path = includeRemote ? "/backup/list?include_remote=true" : "/backup/list";
    const result = await requestJson<{ data: BackupEntry[] }>(io, `${daemonUrl}${path}`);
    if (json) printJson(io, result);
    else printBackupList(io, result.data);
    return 0;
  }

  if (command === "restore") {
    const parsed = parseArgs(rest, {
      booleanFlags: ["--json", "--yes"],
      valueFlags: ["--daemon-url", "--remote-key"],
    });
    const json = parsed.flags.has("--json");
    const daemonUrl = getDaemonUrl(parsed, io.env);
    if (!parsed.flags.has("--yes")) {
      throw new CliError("Restore replaces local data and requires --yes.", 2);
    }

    const remoteKey = parsed.values.get("--remote-key");
    if (parsed.positionals.length > 1) {
      throw new CliError(`Unexpected argument for backup restore: ${parsed.positionals[1]}`, 2);
    }
    const backupName = parsed.positionals[0];
    if (!remoteKey && !backupName) {
      throw new CliError("backup restore requires a backup name or --remote-key.", 2);
    }
    if (remoteKey && backupName) {
      throw new CliError("Use either a local backup name or --remote-key, not both.", 2);
    }

    const body = remoteKey ? { source: "remote", key: remoteKey } : { name: backupName };
    const result = await requestJson<{
      restored_at: string;
      bookmark_count: number;
      checksum_verified: boolean;
      rollback_path: string;
      restart_required: boolean;
    }>(io, `${daemonUrl}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (json) printJson(io, result);
    else printRestoreResult(io, result);
    return 0;
  }

  if (command === "verify") {
    const parsed = parseArgs(rest, {
      booleanFlags: ["--json"],
      valueFlags: ["--file"],
    });
    const json = parsed.flags.has("--json");
    if (parsed.values.has("--file") && parsed.positionals.length > 0) {
      throw new CliError(`Unexpected argument for backup verify: ${parsed.positionals[0]}`, 2);
    }
    if (!parsed.values.has("--file") && parsed.positionals.length > 1) {
      throw new CliError(`Unexpected argument for backup verify: ${parsed.positionals[1]}`, 2);
    }
    const path = parsed.values.get("--file") ?? parsed.positionals[0];
    if (!path) {
      throw new CliError("backup verify requires --file <snapshot-directory>.", 2);
    }
    const result = await verifyBackupDirectory(path);
    if (json) printJson(io, result);
    else io.stdout(`Backup verified: ${result.path}`);
    return 0;
  }

  throw new CliError(`Unknown backup command: ${command}`, 2);
}

export async function runLittleImpCli(args: string[], options: CliIO = {}): Promise<number> {
  const io: Required<CliIO> = {
    env: options.env ?? process.env,
    fetch: options.fetch ?? fetch,
    stdout: options.stdout ?? ((line: string) => console.log(line)),
    stderr: options.stderr ?? ((line: string) => console.error(line)),
  };

  try {
    const [command, ...rest] = args;
    if (!command || command === "--help" || command === "-h") {
      io.stdout(usage());
      return command ? 0 : 2;
    }
    if (command !== "backup") {
      throw new CliError(`Unknown command: ${command}`, 2);
    }
    return await handleBackupCommand(rest, io);
  } catch (err) {
    if (err instanceof CliError || err instanceof BackupVerificationError) {
      io.stderr(err.message);
      return err instanceof CliError ? err.code : 1;
    }
    io.stderr(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

if (import.meta.main) {
  const code = await runLittleImpCli(Bun.argv.slice(2));
  process.exit(code);
}
