#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  chmodSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

export type ReleasePlatform = "macos" | "linux";
type SmokeArtifactSource = "local" | "published";

export type SignatureRunner = (
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

interface CliOptions {
  archivePath?: string;
  keepTemp: boolean;
  port?: number;
  help: boolean;
  source: SmokeArtifactSource;
  releaseBaseUrl?: string;
  version?: string;
  requireSignature: boolean;
}

interface SmokeDirs {
  rootDir: string;
  homeDir: string;
  dataDir: string;
  daemonDir: string;
  frontendDir: string;
  binDir: string;
  logDir: string;
  daemonLogPath: string;
  daemonErrorLogPath: string;
  unpackDir: string;
}

interface DaemonHandle {
  process: ChildProcess;
  logFd: number;
  errorLogFd: number;
}

interface BackupCreateResult {
  path: string;
  bookmark_count: number;
}

interface BackupVerifyResult {
  ok: true;
  name: string;
  checksum_verified: true;
}

interface RestoreResult {
  restart_required: boolean;
  rollback_path: string;
}

interface Envelope<T> {
  data: T;
}

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface PublishedReleaseArtifact {
  archivePath: string;
  checksumPath: string;
  signaturePath?: string;
  checksumVerified: true;
  signatureVerified: boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const COMMAND_TIMEOUT_MS = 15_000;

export function detectReleasePlatform(nodePlatform = process.platform): ReleasePlatform {
  if (nodePlatform === "darwin") return "macos";
  if (nodePlatform === "linux") return "linux";
  throw new Error(`Unsupported installed-app smoke platform: ${nodePlatform}`);
}

export function releaseArchiveName(version: string, platform: ReleasePlatform): string {
  assertSafeReleaseVersion(version);
  return `little-imp-${version}-${platform}.tar.gz`;
}

export function defaultPublishedReleaseBaseUrl(version: string): string {
  assertSafeReleaseVersion(version);
  return `https://github.com/goniszewski/little-imp/releases/download/v${version}`;
}

export function backupNameFromPath(path: string): string {
  if (!path || /[/\\]$/.test(path)) {
    throw new Error("Backup path did not include a name");
  }

  const name = basename(path);
  if (!name || name === "." || name === "..") {
    throw new Error("Backup path did not include a name");
  }
  return name;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    keepTemp: false,
    help: false,
    source: "local",
    requireSignature: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--archive":
        options.archivePath = requireValue(args, (i += 1), arg);
        break;
      case "--source": {
        const source = requireValue(args, (i += 1), arg);
        if (source !== "local" && source !== "published") {
          throw new Error("--source must be local or published");
        }
        options.source = source;
        break;
      }
      case "--release-base-url":
        options.releaseBaseUrl = requireValue(args, (i += 1), arg);
        break;
      case "--version":
        options.version = requireValue(args, (i += 1), arg);
        break;
      case "--require-signature":
        options.requireSignature = true;
        break;
      case "--port":
        options.port = Number(requireValue(args, (i += 1), arg));
        if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
          throw new Error("--port must be an integer between 1 and 65535");
        }
        break;
      case "--keep-temp":
        options.keepTemp = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.source === "published" && options.archivePath) {
    throw new Error("--archive cannot be combined with --source published");
  }
  if (options.source === "local" && options.releaseBaseUrl) {
    throw new Error("--release-base-url requires --source published");
  }
  if (options.source === "local" && options.requireSignature) {
    throw new Error("--require-signature requires --source published");
  }

  return options;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function usage(): string {
  return [
    "Usage: bun run scripts/installed-app-smoke.ts [options]",
    "",
    "Validates a packaged Little Imp release archive as an installed app in an isolated temp home.",
    "",
    "Options:",
    "  --source local|published",
    "                  Artifact source (default: local)",
    "  --archive FILE  Release archive to validate (default: release/little-imp-<version>-<platform>.tar.gz)",
    "  --release-base-url URL",
    "                  Published source base URL (default: GitHub release URL for --version)",
    "  --version VERSION",
    "                  Release version to validate (default: package.json version)",
    "  --require-signature",
    "                  Fail published-source validation when the .asc file is not available",
    "  --port PORT     Local daemon port (default: random available port)",
    "  --keep-temp     Keep the isolated temp home after a successful run",
    "  --help, -h      Show this help",
  ].join("\n");
}

function readPackageVersion(projectRoot: string): string {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
    version?: string;
  };
  if (!packageJson.version) throw new Error("package.json is missing a version");
  return packageJson.version;
}

function assertSafeReleaseVersion(version: string): void {
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(version)) {
    throw new Error(`Release version contains unsupported characters: ${version}`);
  }
}

function createSmokeDirs(): SmokeDirs {
  const rootDir = mkdtempSync(join(tmpdir(), "little-imp-installed-smoke-"));
  const homeDir = join(rootDir, "home");
  const dataDir = join(homeDir, ".local", "share", "littleimp");
  const daemonDir = join(dataDir, "daemon");
  const frontendDir = join(dataDir, "dist");
  const binDir = join(homeDir, ".local", "bin");
  const logDir = join(dataDir, "logs");
  const unpackDir = join(rootDir, "unpacked");

  mkdirSync(homeDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  mkdirSync(unpackDir, { recursive: true });

  return {
    rootDir,
    homeDir,
    dataDir,
    daemonDir,
    frontendDir,
    binDir,
    logDir,
    daemonLogPath: join(logDir, "daemon.log"),
    daemonErrorLogPath: join(logDir, "daemon.error.log"),
    unpackDir,
  };
}

function logStep(message: string): void {
  console.log(`==> ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function smokeEnv(dirs: SmokeDirs, port: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: dirs.homeDir,
    PATH: `${dirs.binDir}:${process.env.PATH ?? ""}`,
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: dirs.dataDir,
    NODE_ENV: "production",
    LOG_FORMAT: "json",
    AGENT_INTERVAL_MS: "86400000",
    PURGE_INTERVAL_MS: "86400000",
    BACKUP_SCHEDULE_ENABLED: "false",
  };
}

async function allocatePort(requested?: number): Promise<number> {
  if (requested) return requested;

  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  assert(address && typeof address === "object", "Could not allocate a local daemon port");
  return address.port;
}

function extractReleaseArchive(archivePath: string, dirs: SmokeDirs, platform: ReleasePlatform): string {
  assert(existsSync(archivePath), `Missing release archive: ${archivePath}`);
  const rootDirectoryName = inspectArchiveRoot(archivePath, platform);

  logStep(`Extracting release archive: ${archivePath}`);
  const tar = spawnSync("tar", ["-xzf", archivePath, "-C", dirs.unpackDir], {
    encoding: "utf8",
  });
  if (tar.status !== 0) {
    throw new Error(`Could not extract release archive:\n${tar.stderr}`);
  }

  const releaseRoot = join(dirs.unpackDir, rootDirectoryName);
  assert(
    existsSync(releaseRoot) && statSync(releaseRoot).isDirectory(),
    "Archive did not extract the expected root"
  );
  assertPortablePayloadEntries(releaseRoot);
  verifyPayloadChecksums(releaseRoot);
  return releaseRoot;
}

export function archiveRootDirectoryNameFromEntries(entries: string[], platform: ReleasePlatform): string {
  const normalizedEntries = entries.map(normalizeArchiveEntry);
  assert(normalizedEntries.length > 0, "Release archive is empty");

  const topLevelRoots = new Set(normalizedEntries.map((entry) => entry.split("/", 1)[0]));
  assert(topLevelRoots.size === 1, "Release archive must contain exactly one top-level directory");

  const [rootDirectoryName] = [...topLevelRoots];
  assert(
    rootDirectoryName.startsWith("little-imp-") && rootDirectoryName.endsWith(`-${platform}`),
    `Release archive root must match little-imp-*-${platform}`
  );
  return rootDirectoryName;
}

function inspectArchiveRoot(archivePath: string, platform: ReleasePlatform): string {
  const list = spawnSync("tar", ["-tzf", archivePath], {
    encoding: "utf8",
  });
  if (list.status !== 0) {
    throw new Error(`Could not inspect release archive:\n${list.stderr}`);
  }

  return archiveRootDirectoryNameFromEntries(list.stdout.split(/\r?\n/).filter(Boolean), platform);
}

function normalizeArchiveEntry(entry: string): string {
  const normalized = entry.replace(/^\.\//, "").replace(/\/+$/, "");
  assert(normalized, "Release archive contains an empty path");
  assert(!isAbsolute(normalized), `Unsafe absolute archive path: ${entry}`);
  assert(!normalized.includes("\\"), `Unsafe archive path separator: ${entry}`);

  const segments = normalized.split("/");
  assert(
    segments.every((segment) => segment && segment !== "." && segment !== ".."),
    `Unsafe archive path: ${entry}`
  );
  return normalized;
}

function resolvePayloadPath(root: string, relativePath: string): string {
  const normalized = normalizeArchiveEntry(relativePath);
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(root, ...normalized.split("/"));
  assert(
    resolvedPath.startsWith(`${resolvedRoot}/`),
    `Unsafe checksum path outside release root: ${relativePath}`
  );
  return resolvedPath;
}

function assertPortablePayloadEntries(root: string): void {
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = lstatSync(path);
    if (stats.isDirectory()) {
      assertPortablePayloadEntries(path);
      continue;
    }
    assert(stats.isFile(), `Archive contains unsupported entry type: ${path}`);
  }
}

function verifyPayloadChecksums(releaseRoot: string): void {
  const checksumsPath = join(releaseRoot, "CHECKSUMS.sha256");
  assert(existsSync(checksumsPath), "Release payload is missing CHECKSUMS.sha256");

  logStep("Verifying release payload CHECKSUMS.sha256");
  const lines = readFileSync(checksumsPath, "utf8").split(/\r?\n/).filter(Boolean);
  assert(lines.length > 0, "Release payload checksum file is empty");

  for (const line of lines) {
    const match = line.match(/^([a-fA-F0-9]{64})\s{2}(.+)$/);
    assert(match, `Malformed payload checksum line: ${line}`);
    const [, expectedHash, relativePath] = match;
    const filePath = resolvePayloadPath(releaseRoot, relativePath);
    assert(existsSync(filePath), `Checksum target is missing: ${relativePath}`);
    const actualHash = createHash("sha256").update(readFileSync(filePath)).digest("hex");
    assert(actualHash === expectedHash.toLowerCase(), `Checksum mismatch for payload file: ${relativePath}`);
  }
}

export async function downloadPublishedReleaseArtifact(options: {
  version: string;
  platform: ReleasePlatform;
  releaseBaseUrl: string;
  downloadDir: string;
  fetchImpl?: typeof fetch;
  signatureRunner?: SignatureRunner;
  requireSignature?: boolean;
}): Promise<PublishedReleaseArtifact> {
  const archiveName = releaseArchiveName(options.version, options.platform);
  const baseUrl = options.releaseBaseUrl.replace(/\/+$/, "");
  const archivePath = join(options.downloadDir, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const signaturePath = `${archivePath}.asc`;
  const fetchImpl = options.fetchImpl ?? fetch;

  mkdirSync(options.downloadDir, { recursive: true });

  logStep(`Downloading published release artifact from ${baseUrl}`);
  await downloadRequiredArtifact(fetchImpl, `${baseUrl}/${archiveName}`, archivePath, archiveName);
  await downloadRequiredArtifact(fetchImpl, `${baseUrl}/${archiveName}.sha256`, checksumPath, `${archiveName}.sha256`);
  const hasSignature = await downloadOptionalArtifact(fetchImpl, `${baseUrl}/${archiveName}.asc`, signaturePath);

  logStep(`Verifying published archive checksum: ${archiveName}`);
  verifyPublishedArtifactChecksum(archivePath, checksumPath, archiveName);

  if (hasSignature) {
    logStep(`Verifying published detached signature: ${archiveName}.asc`);
    verifyPublishedSignature(archivePath, signaturePath, options.signatureRunner);
  } else if (options.requireSignature) {
    throw new Error(`Missing detached signature: ${archiveName}.asc`);
  } else {
    logStep(`No published detached signature found for ${archiveName}; checksum verified only`);
  }

  return {
    archivePath,
    checksumPath,
    signaturePath: hasSignature ? signaturePath : undefined,
    checksumVerified: true,
    signatureVerified: hasSignature,
  };
}

async function downloadRequiredArtifact(
  fetchImpl: typeof fetch,
  url: string,
  outputPath: string,
  label: string
): Promise<void> {
  const response = await fetchPublishedArtifact(fetchImpl, url, label);
  if (!response.ok) {
    throw new Error(`Could not download ${label} from ${url} (HTTP ${response.status})`);
  }
  writeFileSync(outputPath, new Uint8Array(await response.arrayBuffer()));
}

async function downloadOptionalArtifact(fetchImpl: typeof fetch, url: string, outputPath: string): Promise<boolean> {
  const response = await fetchPublishedArtifact(fetchImpl, url, "detached signature");
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Could not download detached signature from ${url} (HTTP ${response.status})`);
  }
  writeFileSync(outputPath, new Uint8Array(await response.arrayBuffer()));
  return true;
}

async function fetchPublishedArtifact(fetchImpl: typeof fetch, url: string, label: string): Promise<Response> {
  try {
    return await fetchImpl(url);
  } catch (error) {
    throw new Error(`Could not download ${label} from ${url}: ${String(error)}`);
  }
}

function verifyPublishedArtifactChecksum(archivePath: string, checksumPath: string, archiveName: string): void {
  const expectedHash = expectedPublishedChecksum(checksumPath, archiveName);
  const actualHash = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Checksum mismatch for ${archiveName}`);
  }
}

function expectedPublishedChecksum(checksumPath: string, archiveName: string): string {
  const firstLine = readFileSync(checksumPath, "utf8").split(/\r?\n/)[0] ?? "";
  const match = firstLine.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
  if (!match || match[2] !== archiveName) {
    throw new Error(`Checksum file is invalid for ${archiveName}`);
  }
  return match[1].toLowerCase();
}

function verifyPublishedSignature(
  archivePath: string,
  signaturePath: string,
  runner = defaultSignatureRunner
): void {
  const result = runner("gpg", ["--verify", signaturePath, archivePath], {
    encoding: "utf8",
    env: process.env,
  });

  if (result.error) {
    throw new Error("A detached signature was published, but gpg is not installed. Install gpg and retry.");
  }
  if (result.status !== 0) {
    throw new Error(`Signature verification failed for ${basename(archivePath)}`);
  }
}

function defaultSignatureRunner(
  command: string,
  args: string[],
  options?: { encoding?: BufferEncoding; env?: NodeJS.ProcessEnv }
): ReturnType<SignatureRunner> {
  return spawnSync(command, args, options);
}

function installRuntimeFromRelease(releaseRoot: string, dirs: SmokeDirs, port: number): void {
  logStep("Installing runtime from release archive into isolated temp home");
  rmSync(dirs.daemonDir, { recursive: true, force: true });
  rmSync(dirs.frontendDir, { recursive: true, force: true });
  mkdirSync(dirname(dirs.daemonDir), { recursive: true });
  mkdirSync(dirname(dirs.frontendDir), { recursive: true });
  cpSync(join(releaseRoot, "daemon"), dirs.daemonDir, { recursive: true });
  cpSync(join(releaseRoot, "dist"), dirs.frontendDir, { recursive: true });

  const cliPath = join(dirs.binDir, "littleimp");
  writeFileSync(
    cliPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `exec bun ${JSON.stringify(join(dirs.daemonDir, "src", "cli.ts"))} "$@"`,
      "",
    ].join("\n")
  );
  chmodSync(cliPath, 0o755);

  writeFileSync(
    join(dirs.dataDir, ".env"),
    [
      "HOST=127.0.0.1",
      `PORT=${port}`,
      `DATA_DIR=${dirs.dataDir}`,
      "NODE_ENV=production",
      "LOG_FORMAT=json",
      "",
    ].join("\n")
  );

  logStep("Installing daemon production dependencies");
  const install = spawnSync("bun", ["install", "--production"], {
    cwd: dirs.daemonDir,
    env: smokeEnv(dirs, port),
    stdio: "inherit",
  });
  if (install.status !== 0) {
    throw new Error(`bun install --production failed with exit code ${install.status ?? "unknown"}`);
  }
}

function startDaemon(dirs: SmokeDirs, port: number): DaemonHandle {
  logStep(`Starting installed daemon on http://127.0.0.1:${port}`);
  const logFd = openSync(dirs.daemonLogPath, "a");
  const errorLogFd = openSync(dirs.daemonErrorLogPath, "a");
  const child = spawn("bun", ["run", "src/index.ts"], {
    cwd: dirs.daemonDir,
    env: smokeEnv(dirs, port),
    stdio: ["ignore", logFd, errorLogFd],
  });

  return { process: child, logFd, errorLogFd };
}

async function stopDaemon(handle: DaemonHandle | null): Promise<void> {
  if (!handle) return;

  if (!handle.process.killed && handle.process.exitCode === null) {
    handle.process.kill("SIGTERM");
    await Promise.race([
      once(handle.process, "exit"),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
    ]);
    if (handle.process.exitCode === null) {
      handle.process.kill("SIGKILL");
      await Promise.race([
        once(handle.process, "exit"),
        new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
      ]);
    }
  }

  closeSync(handle.logFd);
  closeSync(handle.errorLogFd);
}

async function waitForHealth(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // keep polling until timeout
    }
    await new Promise((resolvePoll) => setTimeout(resolvePoll, 500));
  }
  throw new Error(`Daemon did not become healthy within ${timeoutMs}ms`);
}

async function fetchJson<T>(baseUrl: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const payload = text.trim() ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${path} failed with ${res.status}: ${text}`);
  }
  return payload as T;
}

async function waitForBookmarkUrl(baseUrl: string, url: string, label: string): Promise<void> {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const bookmarks = await fetchJson<Envelope<Array<{ url: string }>>>(baseUrl, "GET", "/bookmarks?limit=100");
    if (bookmarks.data.some((bookmark) => bookmark.url === url)) return;
    await new Promise((resolvePoll) => setTimeout(resolvePoll, 250));
  }

  throw new Error(`${label} bookmark was not visible before timeout: ${url}`);
}

async function runInstalledJourneys(baseUrl: string): Promise<{ bookmarkUrls: string[] }> {
  const bookmarkUrl = "https://example.com/little-imp-installed-smoke";
  const importedBookmarkUrl = "https://example.org/little-imp-import-smoke";

  logStep("POST /bookmarks");
  const created = await fetchJson<Envelope<{ id: string; url: string }>>(baseUrl, "POST", "/bookmarks", {
    url: bookmarkUrl,
    title: "Installed Smoke Bookmark",
  });
  assert(created.data.url === bookmarkUrl, "Created bookmark URL did not round-trip");
  await waitForBookmarkUrl(baseUrl, bookmarkUrl, "Saved");

  logStep("GET /search");
  const search = await fetchJson<Envelope<Array<{ url: string }>> & { pagination: { total: number } }>(
    baseUrl,
    "GET",
    `/search?q=${encodeURIComponent("Installed Smoke Bookmark")}&mode=keyword`
  );
  assert(search.pagination.total >= 1, "Keyword search did not return the installed smoke bookmark");

  logStep("POST /import");
  const form = new FormData();
  form.set(
    "file",
    new Blob(
      [
        [
          "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
          "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">",
          "<TITLE>Bookmarks</TITLE>",
          "<H1>Bookmarks</H1>",
          "<DL><p>",
          `<DT><A HREF="${importedBookmarkUrl}">Imported Smoke Bookmark</A>`,
          "</DL><p>",
        ].join("\n"),
      ],
      { type: "text/html" }
    ),
    "bookmarks.html"
  );
  const importRes = await fetch(`${baseUrl}/import`, { method: "POST", body: form });
  const importPayload = await importRes.json() as Envelope<{ total: number }>;
  assert(importRes.ok, `POST /import failed with ${importRes.status}`);
  assert(importPayload.data.total === 1, "Import did not parse the expected bookmark count");
  await waitForBookmarkUrl(baseUrl, importedBookmarkUrl, "Imported");

  logStep("GET /export");
  const exported = await fetchJson<Array<{ url: string }>>(baseUrl, "GET", "/export?format=json");
  assert(exported.some((bookmark) => bookmark.url === bookmarkUrl), "Export did not include the saved bookmark");
  assert(
    exported.some((bookmark) => bookmark.url === importedBookmarkUrl),
    "Export did not include the imported bookmark"
  );

  logStep("GET /settings");
  const settings = await fetchJson<Envelope<{ app: { theme: string } }>>(baseUrl, "GET", "/settings");
  assert(settings.data.app.theme, "Settings response did not include app theme");
  await fetchJson<Envelope<{ app: { theme: string } }>>(baseUrl, "PUT", "/settings", {
    app: { theme: "dark" },
  });

  logStep("POST /backup");
  const backup = await fetchJson<BackupCreateResult>(baseUrl, "POST", "/backup", { skip_remote: true });
  assert(backup.bookmark_count >= 2, "Backup did not include saved and imported bookmarks");

  const backupName = backupNameFromPath(backup.path);
  const verified = await fetchJson<BackupVerifyResult>(baseUrl, "POST", "/backup/verify", {
    name: backupName,
  });
  assert(verified.ok && verified.checksum_verified, "Backup verification failed");

  logStep("POST /restore");
  const restored = await fetchJson<RestoreResult>(baseUrl, "POST", "/restore", {
    name: backupName,
  });
  assert(restored.restart_required === true, "Restore did not report restart_required: true");
  assert(restored.rollback_path, "Restore did not report a rollback path");

  return { bookmarkUrls: [bookmarkUrl, importedBookmarkUrl] };
}

async function assertBookmarksSurvived(baseUrl: string, bookmarkUrls: string[]): Promise<void> {
  const bookmarks = await fetchJson<Envelope<Array<{ url: string }>>>(baseUrl, "GET", "/bookmarks?limit=100");
  for (const bookmarkUrl of bookmarkUrls) {
    assert(
      bookmarks.data.some((bookmark) => bookmark.url === bookmarkUrl),
      `Bookmark was not present after restart or upgrade: ${bookmarkUrl}`
    );
  }
}

async function startUpdateSource(version: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    if (req.url !== "/releases") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify([
        {
          tag_name: `v${version}`,
          name: `Little Imp ${version}`,
          draft: false,
          prerelease: version.includes("-"),
          published_at: "2026-05-27T00:00:00.000Z",
          html_url: "https://example.com/little-imp/releases/smoke",
        },
      ])
    );
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object", "Could not start local update source");
  return {
    url: `http://127.0.0.1:${address.port}/releases`,
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  };
}

export async function runCommandCapture(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number }
): Promise<CommandResult> {
  return await new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 1_000);
    }, options.timeoutMs ?? COMMAND_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      rejectCommand(error);
    });
    child.once("close", (status) => {
      clearTimeout(timeout);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolveCommand({ status, stdout, stderr, timedOut });
    });
  });
}

async function runCliUpdateCheck(dirs: SmokeDirs, port: number, updateSourceUrl: string): Promise<void> {
  logStep("littleimp update check");
  const result = await runCommandCapture(
    "littleimp",
    ["update", "check", "--json", "--source", updateSourceUrl],
    {
      cwd: dirs.daemonDir,
      env: {
        ...smokeEnv(dirs, port),
        LITTLEIMP_DAEMON_URL: `http://127.0.0.1:${port}`,
      },
    }
  );

  if (result.timedOut) {
    throw new Error(`littleimp update check timed out after ${COMMAND_TIMEOUT_MS}ms`);
  }
  if (result.status !== 0) {
    throw new Error(`littleimp update check failed:\n${result.stderr}`);
  }

  const payload = JSON.parse(result.stdout) as { current_version?: string; latest?: { version?: string } | null };
  assert(payload.current_version, "CLI update check did not return current_version");
}

async function runInstalledAppSmoke(options: {
  projectRoot: string;
  archivePath?: string;
  keepTemp: boolean;
  port?: number;
  source: SmokeArtifactSource;
  releaseBaseUrl?: string;
  version?: string;
  requireSignature: boolean;
}): Promise<void> {
  const version = options.version ?? readPackageVersion(options.projectRoot);
  const platform = detectReleasePlatform();
  const dirs = createSmokeDirs();
  const port = await allocatePort(options.port);
  const baseUrl = `http://127.0.0.1:${port}`;
  let daemon: DaemonHandle | null = null;
  let updateSource: { url: string; close: () => Promise<void> } | null = null;
  let success = false;

  try {
    const archivePath =
      options.source === "published"
        ? (
            await downloadPublishedReleaseArtifact({
              version,
              platform,
              releaseBaseUrl: options.releaseBaseUrl ?? defaultPublishedReleaseBaseUrl(version),
              downloadDir: join(dirs.rootDir, "published-artifacts"),
              requireSignature: options.requireSignature,
            })
          ).archivePath
        : resolve(options.archivePath ?? join(options.projectRoot, "release", releaseArchiveName(version, platform)));

    const releaseRoot = extractReleaseArchive(archivePath, dirs, platform);
    installRuntimeFromRelease(releaseRoot, dirs, port);

    daemon = startDaemon(dirs, port);
    await waitForHealth(baseUrl);
    const { bookmarkUrls } = await runInstalledJourneys(baseUrl);

    await stopDaemon(daemon);
    daemon = null;

    logStep("Restarting after restore and confirming data survives restart");
    daemon = startDaemon(dirs, port);
    await waitForHealth(baseUrl);
    await assertBookmarksSurvived(baseUrl, bookmarkUrls);

    updateSource = await startUpdateSource(version);
    await runCliUpdateCheck(dirs, port, updateSource.url);

    logStep("Reinstalling from archive to verify data survives upgrade");
    await stopDaemon(daemon);
    daemon = null;
    installRuntimeFromRelease(releaseRoot, dirs, port);
    daemon = startDaemon(dirs, port);
    await waitForHealth(baseUrl);
    await assertBookmarksSurvived(baseUrl, bookmarkUrls);
    logStep("data survives upgrade");

    logStep("uninstall without purge");
    await stopDaemon(daemon);
    daemon = null;
    rmSync(dirs.daemonDir, { recursive: true, force: true });
    rmSync(dirs.frontendDir, { recursive: true, force: true });
    rmSync(join(dirs.binDir, "littleimp"), { force: true });
    assert(existsSync(join(dirs.dataDir, "littleimp.db")), "Uninstall without purge removed user data");

    success = true;
    console.log("Installed-app smoke passed.");
  } finally {
    await stopDaemon(daemon);
    if (updateSource) await updateSource.close();

    if (success && !options.keepTemp) {
      rmSync(dirs.rootDir, { recursive: true, force: true });
    } else {
      console.error(`Diagnostics temp root: ${dirs.rootDir}`);
      console.error(`Daemon stdout log: ${dirs.daemonLogPath}`);
      console.error(`Daemon stderr log: ${dirs.daemonErrorLogPath}`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  await runInstalledAppSmoke({
    projectRoot: process.cwd(),
    archivePath: options.archivePath,
    keepTemp: options.keepTemp,
    port: options.port,
    source: options.source,
    releaseBaseUrl: options.releaseBaseUrl,
    version: options.version,
    requireSignature: options.requireSignature,
  });
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
