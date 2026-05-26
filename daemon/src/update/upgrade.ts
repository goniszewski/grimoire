import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { basename, join, resolve } from "path";
import { spawnSync } from "child_process";

export type ReleasePlatform = "macos" | "linux";

export type InstallerRunner = (
  command: string,
  args: string[],
  options?: {
    encoding?: BufferEncoding;
    env?: NodeJS.ProcessEnv;
  }
) => {
  status: number | null;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  error?: Error;
};

export type DownloadedUpgradeArtifact = {
  archivePath: string;
  checksumPath: string;
  signaturePath?: string;
};

export type VerifiedUpgradeArtifact = {
  archivePath: string;
  checksumVerified: true;
  signatureVerified: boolean;
  extractedRoot: string;
  version: string;
};

export class UpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpgradeError";
  }
}

export function detectReleasePlatform(platform = process.platform): ReleasePlatform {
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  throw new UpgradeError(`Unsupported OS: ${platform}. Only macOS and Linux are supported.`);
}

export function releaseArchiveName(version: string, platform = detectReleasePlatform()): string {
  assertSafeReleaseVersion(version);
  return `little-imp-${version}-${platform}.tar.gz`;
}

export function defaultReleaseBaseUrl(version: string): string {
  assertSafeReleaseVersion(version);
  return `https://github.com/goniszewski/little-imp/releases/download/v${version}`;
}

export function rollbackGuidance(previousVersion: string, targetVersion: string): string[] {
  return [
    `Previous user data remains under ~/.local/share/littleimp after the ${targetVersion} upgrade attempt.`,
    `To roll back to ${previousVersion}, rerun the previous release's verified installer with --upgrade.`,
    "Check ~/.local/share/littleimp/logs/daemon.log and daemon.error.log before retrying.",
  ];
}

export function createUpgradeWorkDir(): string {
  return mkdtempSync(join(tmpdir(), "littleimp-upgrade-"));
}

export function removeUpgradeWorkDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export async function downloadUpgradeArtifact(options: {
  version: string;
  releaseBaseUrl: string;
  workDir: string;
  fetchImpl?: typeof fetch;
  platform?: ReleasePlatform;
}): Promise<DownloadedUpgradeArtifact> {
  const platform = options.platform ?? detectReleasePlatform();
  const archiveName = releaseArchiveName(options.version, platform);
  const baseUrl = options.releaseBaseUrl.replace(/\/+$/, "");
  const archivePath = join(options.workDir, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const signaturePath = `${archivePath}.asc`;
  const fetchImpl = options.fetchImpl ?? fetch;

  await downloadRequired(fetchImpl, `${baseUrl}/${archiveName}`, archivePath, archiveName);
  await downloadRequired(fetchImpl, `${baseUrl}/${archiveName}.sha256`, checksumPath, `${archiveName}.sha256`);
  const hasSignature = await downloadOptional(fetchImpl, `${baseUrl}/${archiveName}.asc`, signaturePath);

  return {
    archivePath,
    checksumPath,
    signaturePath: hasSignature ? signaturePath : undefined,
  };
}

export function verifyAndExtractUpgradeArtifact(options: {
  archivePath: string;
  checksumPath: string;
  signaturePath?: string;
  signatureRunner?: InstallerRunner;
  env?: Record<string, string | undefined>;
  workDir: string;
}): VerifiedUpgradeArtifact {
  const archivePath = resolve(options.archivePath);
  const checksumPath = resolve(options.checksumPath);
  const archiveName = basename(archivePath);

  verifyChecksum(archivePath, checksumPath, archiveName);
  const signatureVerified = verifySignatureIfPresent(
    archivePath,
    options.signaturePath,
    options.signatureRunner,
    options.env
  );
  const archiveRoot = validateArchiveMembers(archivePath, archiveName);
  validateArchiveEntryTypes(archivePath, archiveName);
  extractArchive(archivePath, options.workDir, archiveName);

  const extractedRoot = join(options.workDir, archiveRoot);
  const installerPath = join(extractedRoot, "daemon", "install.sh");
  const installerStats = existsSync(installerPath) ? lstatSync(installerPath) : null;
  if (!installerStats || installerStats.isSymbolicLink() || !installerStats.isFile() || (installerStats.mode & 0o111) === 0) {
    throw new UpgradeError("Verified archive does not contain a regular executable daemon/install.sh.");
  }

  return {
    archivePath,
    checksumVerified: true,
    signatureVerified,
    extractedRoot,
    version: readArtifactVersion(extractedRoot, archiveRoot),
  };
}

export function runNativeUpgradeInstaller(options: {
  extractedRoot: string;
  runner?: InstallerRunner;
  env?: Record<string, string | undefined>;
}): void {
  const runner = options.runner ?? defaultInstallerRunner;
  const installerPath = join(options.extractedRoot, "daemon", "install.sh");
  const result = runner("bash", [installerPath, "--upgrade"], {
    encoding: "utf8",
    env: sanitizedEnv(options.env),
  });

  if (result.error) {
    throw new UpgradeError(`Could not run native installer: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = outputToString(result.stderr).trim();
    const detail = stderr ? ` ${stderr}` : "";
    throw new UpgradeError(`Native installer failed with exit code ${result.status ?? "unknown"}.${detail}`);
  }
}

function assertSafeReleaseVersion(version: string): void {
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(version)) {
    throw new UpgradeError(`Release version contains unsupported characters: ${version}`);
  }
}

async function downloadRequired(
  fetchImpl: typeof fetch,
  url: string,
  outputPath: string,
  label: string
): Promise<void> {
  const res = await fetchArtifact(fetchImpl, url, label);
  if (!res.ok) {
    throw new UpgradeError(`Could not download ${label} from ${url} (HTTP ${res.status}).`);
  }
  writeFileSync(outputPath, new Uint8Array(await res.arrayBuffer()));
}

async function downloadOptional(fetchImpl: typeof fetch, url: string, outputPath: string): Promise<boolean> {
  const res = await fetchArtifact(fetchImpl, url, "detached signature");
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new UpgradeError(`Could not download detached signature from ${url} (HTTP ${res.status}).`);
  }
  writeFileSync(outputPath, new Uint8Array(await res.arrayBuffer()));
  return true;
}

async function fetchArtifact(fetchImpl: typeof fetch, url: string, label: string): Promise<Response> {
  try {
    return await fetchImpl(url);
  } catch (err) {
    throw new UpgradeError(`Could not download ${label} from ${url}: ${String(err)}`);
  }
}

function verifyChecksum(archivePath: string, checksumPath: string, archiveName: string): void {
  const expected = expectedChecksumFromFile(checksumPath, archiveName);
  const actual = sha256File(archivePath);
  if (actual !== expected) {
    throw new UpgradeError(`Checksum mismatch for ${archiveName}. Refusing to upgrade.`);
  }
}

function expectedChecksumFromFile(checksumPath: string, archiveName: string): string {
  const line = readFileSync(checksumPath, "utf8").split(/\r?\n/)[0] ?? "";
  const match = line.match(/^([A-Fa-f0-9]{64})\s+\*?(.+)$/);
  if (!match || match[2] !== archiveName) {
    throw new UpgradeError(`Checksum file is invalid for ${archiveName}.`);
  }
  return match[1].toLowerCase();
}

function sha256File(path: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function verifySignatureIfPresent(
  archivePath: string,
  signaturePath?: string,
  runner?: InstallerRunner,
  env?: Record<string, string | undefined>
): boolean {
  const resolvedSignaturePath = signaturePath ? resolve(signaturePath) : `${archivePath}.asc`;
  if (!existsSync(resolvedSignaturePath)) return false;
  const run = runner ?? defaultInstallerRunner;
  const result = run("gpg", ["--verify", resolvedSignaturePath, archivePath], {
    encoding: "utf8",
    env: sanitizedEnv(env),
  });

  if (result.error) {
    throw new UpgradeError("A detached signature was provided, but gpg is not installed. Install gpg and retry.");
  }
  if (result.status !== 0) {
    throw new UpgradeError(`Signature verification failed for ${basename(archivePath)}. Refusing to upgrade.`);
  }
  return true;
}

function validateArchiveMembers(archivePath: string, archiveName: string): string {
  const members = runTar(["-tzf", archivePath], `Could not inspect archive contents for ${archiveName}.`)
    .split(/\r?\n/)
    .filter(Boolean);

  if (members.length === 0) {
    throw new UpgradeError(`Archive is empty: ${archiveName}.`);
  }

  let archiveRoot = "";
  for (const member of members) {
    if (!isSafeArchiveMember(member)) {
      throw new UpgradeError(`Unsafe archive path: ${member}`);
    }
    const memberRoot = member.split("/")[0];
    if (!archiveRoot) archiveRoot = memberRoot;
    if (archiveRoot !== memberRoot) {
      throw new UpgradeError(`Archive must contain a single release root directory: ${archiveName}.`);
    }
  }

  return archiveRoot;
}

function isSafeArchiveMember(member: string): boolean {
  return !(
    member === "" ||
    member.startsWith("/") ||
    member === ".." ||
    member.startsWith("../") ||
    member.includes("/../") ||
    member.endsWith("/..") ||
    member.includes("\\")
  );
}

function validateArchiveEntryTypes(archivePath: string, archiveName: string): void {
  const listing = runTar(["-tvzf", archivePath], `Could not inspect archive entry types for ${archiveName}.`);
  for (const line of listing.split(/\r?\n/)) {
    if (!line) continue;
    const entryType = line[0];
    if (entryType !== "-" && entryType !== "d") {
      throw new UpgradeError(`Archive contains unsupported entry type '${entryType}' in ${archiveName}.`);
    }
  }
}

function extractArchive(archivePath: string, workDir: string, archiveName: string): void {
  runTar(["-xzf", archivePath, "-C", workDir], `Could not extract archive ${archiveName}.`);
}

function runTar(args: string[], failureMessage: string): string {
  const result = spawnSync("tar", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new UpgradeError(failureMessage);
  }
  return outputToString(result.stdout);
}

function readArtifactVersion(extractedRoot: string, archiveRoot: string): string {
  const versionPath = join(extractedRoot, "VERSION");
  if (existsSync(versionPath)) {
    const version = readFileSync(versionPath, "utf8").trim();
    if (version) return version;
  }

  const match = archiveRoot.match(/^little-imp-(.+)-(macos|linux)$/);
  return match?.[1] ?? archiveRoot;
}

function defaultInstallerRunner(command: string, args: string[], options?: { encoding?: BufferEncoding; env?: NodeJS.ProcessEnv }) {
  return spawnSync(command, args, options);
}

function sanitizedEnv(env?: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(env ?? {})) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}

function outputToString(value: string | Buffer | undefined): string {
  if (typeof value === "string") return value;
  return value?.toString("utf8") ?? "";
}
