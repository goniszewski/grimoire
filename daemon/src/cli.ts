#!/usr/bin/env bun
import { accessSync, constants as fsConstants, mkdirSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import { tmpdir } from "os";
import { version as APP_VERSION } from "../package.json";
import { verifyBackupDirectory, BackupVerificationError } from "./backup/verification.js";
import {
  BackupPackageError,
  createEncryptedBackupPackage,
  extractEncryptedBackupPackage,
} from "./backup/package.js";
import {
  DEFAULT_UPDATE_SOURCE,
  UpdateCheckError,
  checkForUpdates,
  parseUpdateChannel,
  type UpdateChannel,
  type UpdateRelease,
} from "./update/service.js";
import {
  UpgradeError,
  createUpgradeWorkDir,
  defaultReleaseBaseUrl,
  downloadUpgradeArtifact,
  removeUpgradeWorkDir,
  rollbackGuidance,
  runNativeUpgradeInstaller,
  verifyAndExtractUpgradeArtifact,
  type InstallerRunner,
} from "./update/upgrade.js";

const DEFAULT_DAEMON_URL = "http://127.0.0.1:3210";

type CliEnv = Record<string, string | undefined>;

type CliIO = {
  env?: CliEnv;
  fetch?: typeof fetch;
  spawnSync?: InstallerRunner;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
};

type CliRuntime = Required<Pick<CliIO, "env" | "fetch" | "stdout" | "stderr">> &
  Pick<CliIO, "spawnSync">;

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

function getUpdateSource(parsed: ParsedArgs, env: CliEnv): string {
  const configured = parsed.values.get("--source") ?? env.LITTLEIMP_UPDATE_SOURCE;
  return configured?.trim() ? configured.trim() : DEFAULT_UPDATE_SOURCE;
}

function getUpdateChannel(parsed: ParsedArgs): UpdateChannel {
  const value = parsed.values.get("--channel");
  try {
    return parseUpdateChannel(value);
  } catch (err) {
    if (err instanceof UpdateCheckError && err.status === 422) {
      throw new CliError("--channel must be stable or beta.", 2);
    }
    throw err;
  }
}

function assertNoPositionals(parsed: ParsedArgs, command: string, namespace = "backup"): void {
  if (parsed.positionals.length > 0) {
    throw new CliError(`Unexpected argument for ${namespace} ${command}: ${parsed.positionals[0]}`, 2);
  }
}

function readBackupPassword(parsed: ParsedArgs, env: CliEnv): string {
  const passwordFile = parsed.values.get("--password-file");
  const password = passwordFile
    ? readFileSync(resolve(passwordFile), "utf8").replace(/\r?\n$/, "")
    : env.LITTLEIMP_BACKUP_PASSWORD;

  if (!password) {
    throw new CliError(
      "Encrypted backups require LITTLEIMP_BACKUP_PASSWORD or --password-file.",
      2
    );
  }

  return password;
}

function safeTimestamp(): string {
  return new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-");
}

function encryptedRestoreName(): string {
  return `encrypted-restore-${safeTimestamp()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureWritableDirectory(path: string): void {
  try {
    mkdirSync(path, { recursive: true });
    accessSync(path, fsConstants.W_OK);
  } catch {
    throw new CliError(`Daemon backup destination is not writable: ${path}`);
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
  encrypted_path?: string;
}): void {
  io.stdout(`Backup created: ${result.path}`);
  io.stdout(`Bookmarks: ${result.bookmark_count}`);
  io.stdout(`Size: ${result.size_bytes} bytes`);
  if (result.remote_url) io.stdout(`Remote: ${result.remote_url}`);
  if (result.encrypted_path) {
    io.stdout(`Encrypted package: ${result.encrypted_path}`);
    io.stdout("Password required: this package cannot be restored without the same password.");
  }
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

function printUpdateResult(
  io: Required<Pick<CliIO, "stdout">>,
  result: {
    current_version: string;
    update_available: boolean;
    latest: UpdateRelease | null;
  }
): void {
  if (!result.latest || !result.update_available) {
    io.stdout(`Little Imp is up to date (${result.current_version}).`);
    return;
  }

  io.stdout(`Update available: ${result.current_version} -> ${result.latest.version}`);
  if (result.latest.url) io.stdout(`Release: ${result.latest.url}`);
}

type PackagedUpgradeResult = {
  current_version: string;
  upgraded_version: string;
  archive: string;
  checksum_verified: boolean;
  signature_verified: boolean;
  restart_status: "healthy";
  health_version: string;
  rollback_guidance: string[];
};

function printUpgradeResult(io: Required<Pick<CliIO, "stdout">>, result: PackagedUpgradeResult): void {
  io.stdout(`Upgrade complete: ${result.current_version} -> ${result.upgraded_version}`);
  io.stdout(`Archive: ${result.archive}`);
  io.stdout("Checksum: verified");
  io.stdout(result.signature_verified ? "Signature: verified" : "Signature: not provided; checksum verified only.");
  io.stdout(`Restart: daemon healthy (${result.health_version})`);
  io.stdout("Rollback guidance:");
  for (const line of result.rollback_guidance) {
    io.stdout(`- ${line}`);
  }
}

function formatRollbackGuidance(lines: string[]): string {
  return `Rollback guidance:\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function usage(): string {
  return [
    `littleimp ${APP_VERSION}`,
    "",
    "Usage:",
    "  littleimp update check [--channel stable|beta] [--source URL] [--json]",
    "  littleimp update install [--version VERSION] [--release-base-url URL] [--channel stable|beta] [--source URL] [--json]",
    "  littleimp update install --archive FILE --checksum FILE [--signature FILE] [--json]",
    "  littleimp backup create [--json] [--daemon-url URL]",
    "  littleimp backup create --encrypt --output FILE [--json] [--daemon-url URL] [--password-file FILE]",
    "  littleimp backup list [--include-remote] [--json] [--daemon-url URL]",
    "  littleimp backup restore <name> --yes [--json] [--daemon-url URL]",
    "  littleimp backup restore --remote-key <key> --yes [--json] [--daemon-url URL]",
    "  littleimp backup restore --encrypted-file FILE --yes [--json] [--daemon-url URL] [--password-file FILE]",
    "  littleimp backup verify --file <snapshot-directory> [--json]",
    "  littleimp backup verify --encrypted --file FILE [--json] [--password-file FILE]",
    "",
    "Environment:",
    "  LITTLEIMP_DAEMON_URL  Defaults to http://127.0.0.1:3210",
    "  LITTLEIMP_BACKUP_PASSWORD  Password for encrypted backup packages",
    "  LITTLEIMP_UPDATE_SOURCE  Defaults to the GitHub Releases API",
    "  LITTLEIMP_RELEASE_BASE_URL  Base URL for release archive downloads",
  ].join("\n");
}

async function handleUpdateCommand(args: string[], io: CliRuntime): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    io.stdout(usage());
    return command ? 0 : 2;
  }

  if (command === "check") {
    const parsed = parseArgs(rest, {
      booleanFlags: ["--json"],
      valueFlags: ["--channel", "--source"],
    });
    assertNoPositionals(parsed, command, "update");
    const json = parsed.flags.has("--json");
    const source = getUpdateSource(parsed, io.env);
    const channel = getUpdateChannel(parsed);
    const result = await checkForUpdates({ source, channel, fetchImpl: io.fetch, allowPrivateHosts: true });

    if (json) printJson(io, result);
    else printUpdateResult(io, result);
    return 0;
  }

  if (command === "install" || command === "upgrade") {
    return await handleUpdateInstallCommand(command, rest, io);
  }

  throw new CliError(`Unknown update command: ${command}`, 2);
}

async function handleUpdateInstallCommand(
  command: "install" | "upgrade",
  rest: string[],
  io: CliRuntime
): Promise<number> {
  const parsed = parseArgs(rest, {
    booleanFlags: ["--json"],
    valueFlags: [
      "--archive",
      "--checksum",
      "--signature",
      "--version",
      "--release-base-url",
      "--daemon-url",
      "--channel",
      "--source",
    ],
  });
  assertNoPositionals(parsed, command, "update");

  const archive = parsed.values.get("--archive");
  const checksum = parsed.values.get("--checksum");
  const signature = parsed.values.get("--signature");
  const versionFlag = parsed.values.get("--version");
  const json = parsed.flags.has("--json");
  const daemonUrl = getDaemonUrl(parsed, io.env);
  const currentVersion = APP_VERSION;
  const workDir = createUpgradeWorkDir();

  if (archive && versionFlag) {
    removeUpgradeWorkDir(workDir);
    throw new CliError("Use either --archive for a local artifact or --version for a downloaded artifact, not both.", 2);
  }
  if (archive && !checksum) {
    removeUpgradeWorkDir(workDir);
    throw new CliError("update install --archive requires --checksum <file>.", 2);
  }
  if (!archive && (checksum || signature)) {
    removeUpgradeWorkDir(workDir);
    throw new CliError("--checksum and --signature are only valid with --archive.", 2);
  }

  try {
    const artifact = archive
      ? {
          archivePath: archive,
          checksumPath: checksum!,
          signaturePath: signature,
        }
      : await resolveDownloadedUpgradeArtifact(parsed, io, workDir);

    const verified = verifyAndExtractUpgradeArtifact({
      archivePath: artifact.archivePath,
      checksumPath: artifact.checksumPath,
      signaturePath: artifact.signaturePath,
      signatureRunner: io.spawnSync,
      env: io.env,
      workDir,
    });
    const guidance = rollbackGuidance(currentVersion, verified.version);

    try {
      runNativeUpgradeInstaller({
        extractedRoot: verified.extractedRoot,
        runner: io.spawnSync,
        env: io.env,
      });
    } catch (err) {
      if (err instanceof UpgradeError) {
        throw new CliError(`${err.message}\n${formatRollbackGuidance(guidance)}`);
      }
      throw err;
    }

    const health = await readDaemonHealthAfterUpgrade(io, daemonUrl, verified.version, guidance);
    const result: PackagedUpgradeResult = {
      current_version: currentVersion,
      upgraded_version: verified.version,
      archive: verified.archivePath,
      checksum_verified: verified.checksumVerified,
      signature_verified: verified.signatureVerified,
      restart_status: "healthy",
      health_version: health.version,
      rollback_guidance: guidance,
    };

    if (json) printJson(io, result);
    else printUpgradeResult(io, result);
    return 0;
  } finally {
    removeUpgradeWorkDir(workDir);
  }
}

async function resolveDownloadedUpgradeArtifact(
  parsed: ParsedArgs,
  io: CliRuntime,
  workDir: string
): Promise<{
  archivePath: string;
  checksumPath: string;
  signaturePath?: string;
}> {
  const requestedVersion = parsed.values.get("--version");
  let version = requestedVersion;
  let discoveredReleaseBaseUrl: string | null = null;
  if (!version) {
    const source = getUpdateSource(parsed, io.env);
    const channel = getUpdateChannel(parsed);
    const result = await checkForUpdates({ source, channel, fetchImpl: io.fetch, allowPrivateHosts: true });
    if (!result.latest || !result.update_available) {
      throw new CliError("No newer compatible update found. Use --version to install a specific release.", 1);
    }
    version = result.latest.version;
    discoveredReleaseBaseUrl = releaseDownloadBaseUrlFromReleaseUrl(result.latest.url);
  }

  const releaseBaseUrl =
    parsed.values.get("--release-base-url") ??
    io.env.LITTLEIMP_RELEASE_BASE_URL ??
    discoveredReleaseBaseUrl ??
    defaultReleaseBaseUrl(version);

  return await downloadUpgradeArtifact({
    version,
    releaseBaseUrl,
    workDir,
    fetchImpl: io.fetch,
  });
}

function releaseDownloadBaseUrlFromReleaseUrl(releaseUrl: string): string | null {
  if (!releaseUrl.trim()) return null;
  let url: URL;
  try {
    url = new URL(releaseUrl);
  } catch {
    return null;
  }

  const match = url.pathname.match(/^(.*\/releases)\/tag\/([^/]+)$/);
  if (!match) return null;

  url.pathname = `${match[1]}/download/${match[2]}`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function readDaemonHealthAfterUpgrade(
  io: CliRuntime,
  daemonUrl: string,
  expectedVersion: string,
  guidance: string[]
): Promise<{ status: string; version: string }> {
  try {
    const health = await requestJson<{ status?: unknown; version?: unknown }>(io, `${daemonUrl}/health`);
    const status = typeof health.status === "string" ? health.status : "";
    const version = typeof health.version === "string" ? health.version : "";
    if (status !== "ok") {
      throw new CliError(`littleimpd health check did not report ok after upgrade.\n${formatRollbackGuidance(guidance)}`);
    }
    if (version !== expectedVersion) {
      throw new CliError(
        `littleimpd restarted with version ${version || "unknown"}, expected ${expectedVersion}.\n${formatRollbackGuidance(guidance)}`
      );
    }
    return { status, version };
  } catch (err) {
    if (err instanceof CliError) {
      if (err.message.includes("Rollback guidance:")) throw err;
      throw new CliError(`${err.message}\n${formatRollbackGuidance(guidance)}`, err.code);
    }
    throw new CliError(`Could not verify littleimpd health after upgrade: ${String(err)}\n${formatRollbackGuidance(guidance)}`);
  }
}

async function handleBackupCommand(args: string[], io: CliRuntime): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    io.stdout(usage());
    return command ? 0 : 2;
  }

  if (command === "create") {
    const parsed = parseArgs(rest, {
      booleanFlags: ["--json", "--encrypt"],
      valueFlags: ["--daemon-url", "--output", "--password-file"],
    });
    assertNoPositionals(parsed, command);
    const json = parsed.flags.has("--json");
    const encrypt = parsed.flags.has("--encrypt");
    if (!encrypt && parsed.values.has("--output")) {
      throw new CliError("--output is only valid with --encrypt.", 2);
    }
    if (!encrypt && parsed.values.has("--password-file")) {
      throw new CliError("--password-file is only valid with --encrypt.", 2);
    }
    if (encrypt && !parsed.values.has("--output")) {
      throw new CliError("backup create --encrypt requires --output <file>.", 2);
    }
    const password = encrypt ? readBackupPassword(parsed, io.env) : "";
    const daemonUrl = getDaemonUrl(parsed, io.env);
    const result = await requestJson<{
      path: string;
      size_bytes: number;
      bookmark_count: number;
      created_at: string;
      remote_url?: string;
    }>(io, `${daemonUrl}/backup`, encrypt
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ skip_remote: true }),
        }
      : { method: "POST" });

    if (encrypt) {
      const packageResult = await createEncryptedBackupPackage({
        sourceDir: result.path,
        outputPath: parsed.values.get("--output")!,
        password,
      });
      const encryptedResult = {
        ...result,
        encrypted_path: packageResult.path,
        encrypted_size_bytes: packageResult.size_bytes,
      };
      if (json) printJson(io, encryptedResult);
      else printCreateResult(io, encryptedResult);
      return 0;
    }

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
      valueFlags: ["--daemon-url", "--remote-key", "--encrypted-file", "--password-file"],
    });
    const json = parsed.flags.has("--json");
    const daemonUrl = getDaemonUrl(parsed, io.env);
    if (!parsed.flags.has("--yes")) {
      throw new CliError("Restore replaces local data and requires --yes.", 2);
    }

    const remoteKey = parsed.values.get("--remote-key");
    const encryptedFile = parsed.values.get("--encrypted-file");
    if (parsed.positionals.length > 1) {
      throw new CliError(`Unexpected argument for backup restore: ${parsed.positionals[1]}`, 2);
    }
    const backupName = parsed.positionals[0];
    if (!remoteKey && !backupName && !encryptedFile) {
      throw new CliError("backup restore requires a backup name, --remote-key, or --encrypted-file.", 2);
    }
    if ([remoteKey, backupName, encryptedFile].filter(Boolean).length > 1) {
      throw new CliError("Use only one restore source: local backup name, --remote-key, or --encrypted-file.", 2);
    }
    if (!encryptedFile && parsed.values.has("--password-file")) {
      throw new CliError("--password-file is only valid with --encrypted-file.", 2);
    }

    if (encryptedFile) {
      const password = readBackupPassword(parsed, io.env);
      const destination = await requestJson<{
        data: { path: string; is_custom: boolean; writable: boolean };
      }>(io, `${daemonUrl}/backup/destination`);
      if (!isAbsolute(destination.data.path)) {
        throw new CliError("Daemon backup destination is not an absolute path.");
      }
      ensureWritableDirectory(destination.data.path);

      const name = encryptedRestoreName();
      const restoreDir = join(destination.data.path, name);
      try {
        await extractEncryptedBackupPackage({
          packagePath: encryptedFile,
          outputDir: restoreDir,
          password,
        });
        const result = await requestJson<{
          restored_at: string;
          bookmark_count: number;
          checksum_verified: boolean;
          rollback_path: string;
          restart_required: boolean;
        }>(io, `${daemonUrl}/restore`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (json) printJson(io, result);
        else printRestoreResult(io, result);
        return 0;
      } finally {
        rmSync(restoreDir, { recursive: true, force: true });
      }
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
      booleanFlags: ["--json", "--encrypted"],
      valueFlags: ["--file", "--password-file"],
    });
    const json = parsed.flags.has("--json");
    const encrypted = parsed.flags.has("--encrypted");
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
    if (!encrypted && parsed.values.has("--password-file")) {
      throw new CliError("--password-file is only valid with --encrypted.", 2);
    }
    if (encrypted) {
      const password = readBackupPassword(parsed, io.env);
      const tmpDir = mkdtempSync(join(tmpdir(), "littleimp-verify-encrypted-"));
      try {
        const result = await extractEncryptedBackupPackage({
          packagePath: path,
          outputDir: tmpDir,
          password,
        });
        const encryptedResult = {
          ...result,
          path: resolve(path),
          package_encrypted: true,
        };
        if (json) printJson(io, encryptedResult);
        else io.stdout(`Encrypted backup verified: ${resolve(path)}`);
        return 0;
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
    const result = await verifyBackupDirectory(path);
    if (json) printJson(io, result);
    else io.stdout(`Backup verified: ${result.path}`);
    return 0;
  }

  throw new CliError(`Unknown backup command: ${command}`, 2);
}

export async function runLittleImpCli(args: string[], options: CliIO = {}): Promise<number> {
  const io: CliRuntime = {
    env: options.env ?? process.env,
    fetch: options.fetch ?? fetch,
    spawnSync: options.spawnSync,
    stdout: options.stdout ?? ((line: string) => console.log(line)),
    stderr: options.stderr ?? ((line: string) => console.error(line)),
  };

  try {
    const [command, ...rest] = args;
    if (!command || command === "--help" || command === "-h") {
      io.stdout(usage());
      return command ? 0 : 2;
    }
    if (command === "update") {
      return await handleUpdateCommand(rest, io);
    }
    if (command !== "backup") {
      throw new CliError(`Unknown command: ${command}`, 2);
    }
    return await handleBackupCommand(rest, io);
  } catch (err) {
    if (
      err instanceof CliError ||
      err instanceof UpdateCheckError ||
      err instanceof UpgradeError ||
      err instanceof BackupVerificationError ||
      err instanceof BackupPackageError
    ) {
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
