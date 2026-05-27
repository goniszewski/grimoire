import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

export type ReleasePlatform = "macos" | "linux";

export interface StageReleasePayloadOptions {
  projectRoot: string;
  stageRoot: string;
  platform: ReleasePlatform;
  version: string;
  generatedAt?: string;
}

export interface StagedReleasePayload {
  rootDirectoryName: string;
  payloadRoot: string;
  checksumsPath: string;
}

export interface PayloadChecksum {
  path: string;
  sha256: string;
}

export interface ManifestArtifactInput {
  platform: ReleasePlatform;
  archiveName: string;
  sha256: string;
}

export interface ReleaseManifestArtifact {
  platform: ReleasePlatform;
  archive: string;
  checksum: string;
  sha256: string;
  signature: string;
}

export interface ReleaseManifest {
  schemaVersion: 1;
  name: "little-imp";
  version: string;
  generatedAt: string;
  signing: {
    detachedSignatureExtension: ".asc";
    requiredBeforePublication: true;
    instructions: string;
  };
  artifacts: ReleaseManifestArtifact[];
}

export interface CreateReleaseManifestOptions {
  version: string;
  generatedAt: string;
  artifacts: ManifestArtifactInput[];
}

export interface PackageReleaseOptions {
  projectRoot: string;
  outputDir?: string;
  version?: string;
  platforms?: ReleasePlatform[];
  skipBuild?: boolean;
  keepStaging?: boolean;
  generatedAt?: string;
  logger?: Pick<Console, "log">;
}

export interface PackageReleaseResult {
  outputDir: string;
  manifestPath: string;
  manifest: ReleaseManifest;
}

export const RELEASE_PLATFORMS: ReleasePlatform[] = ["macos", "linux"];

const CHECKSUMS_FILE = "CHECKSUMS.sha256";
const SIGNATURE_EXTENSION = ".asc";

export function releaseRootDirectoryName(version: string, platform: ReleasePlatform): string {
  assertSafeReleaseVersion(version);
  return `little-imp-${version}-${platform}`;
}

export function releaseArchiveName(version: string, platform: ReleasePlatform): string {
  return `${releaseRootDirectoryName(version, platform)}.tar.gz`;
}

export function readPackageVersion(projectRoot: string): string {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as {
    version?: string;
  };
  if (!packageJson.version) {
    throw new Error("package.json is missing a version");
  }
  return packageJson.version;
}

export function sha256File(path: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

export function buildPayloadChecksums(payloadRoot: string): PayloadChecksum[] {
  const files = listFiles(payloadRoot)
    .map((path) => normalizeRelativePath(relative(payloadRoot, path)))
    .filter((path) => path !== CHECKSUMS_FILE)
    .sort();

  return files.map((path) => ({
    path,
    sha256: sha256File(join(payloadRoot, ...path.split("/"))),
  }));
}

export function createReleaseManifest(options: CreateReleaseManifestOptions): ReleaseManifest {
  return {
    schemaVersion: 1,
    name: "little-imp",
    version: options.version,
    generatedAt: options.generatedAt,
    signing: {
      detachedSignatureExtension: SIGNATURE_EXTENSION,
      requiredBeforePublication: true,
      instructions:
        "Create detached ASCII signatures before publication, for example: gpg --armor --detach-sign --output <archive>.asc <archive>. Enforce this in CI with: npm run release:validate -- --require-signatures",
    },
    artifacts: options.artifacts.map((artifact) => ({
      platform: artifact.platform,
      archive: artifact.archiveName,
      checksum: `${artifact.archiveName}.sha256`,
      sha256: artifact.sha256,
      signature: `${artifact.archiveName}${SIGNATURE_EXTENSION}`,
    })),
  };
}

export function stageReleasePayload(options: StageReleasePayloadOptions): StagedReleasePayload {
  const { projectRoot, stageRoot, platform, version } = options;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const rootDirectoryName = releaseRootDirectoryName(version, platform);
  const payloadRoot = join(stageRoot, rootDirectoryName);

  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(payloadRoot, { recursive: true });

  copyOptionalFile(projectRoot, payloadRoot, "README.md");
  copyOptionalFile(projectRoot, payloadRoot, "LICENSE");
  copyRequiredDirectory(join(projectRoot, "dist"), join(payloadRoot, "dist"));
  copyDaemonRuntime(projectRoot, payloadRoot);
  writeCliEntrypoint(payloadRoot);
  writeVersionMetadata({
    payloadRoot,
    rootDirectoryName,
    platform,
    version,
    generatedAt,
  });
  writeSigningInstructions(payloadRoot, version, platform);

  const checksums = buildPayloadChecksums(payloadRoot);
  const checksumsPath = join(payloadRoot, CHECKSUMS_FILE);
  writeFileSync(checksumsPath, formatChecksums(checksums));

  return {
    rootDirectoryName,
    payloadRoot,
    checksumsPath,
  };
}

export function packageRelease(options: PackageReleaseOptions): PackageReleaseResult {
  const projectRoot = resolve(options.projectRoot);
  const outputDir = resolve(projectRoot, options.outputDir ?? "release");
  const version = options.version ?? readPackageVersion(projectRoot);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const platforms = options.platforms ?? RELEASE_PLATFORMS;
  const logger = options.logger ?? console;

  mkdirSync(outputDir, { recursive: true });

  if (!options.skipBuild) {
    logger.log("Building frontend bundle...");
    runCommand("npm", ["run", "build"], projectRoot);
  }
  assertFrontendBundle(projectRoot);

  const artifacts: ManifestArtifactInput[] = [];
  const stagingRoot = join(outputDir, ".staging");

  for (const platform of platforms) {
    logger.log(`Staging ${platform} release payload...`);
    const platformStageRoot = join(stagingRoot, platform);
    const staged = stageReleasePayload({
      projectRoot,
      stageRoot: platformStageRoot,
      platform,
      version,
      generatedAt,
    });

    const archiveName = releaseArchiveName(version, platform);
    const archivePath = join(outputDir, archiveName);
    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256`, { force: true });
    rmSync(`${archivePath}${SIGNATURE_EXTENSION}`, { force: true });

    logger.log(`Creating ${archiveName}...`);
    createTarGzArchive({
      stageRoot: platformStageRoot,
      rootDirectoryName: staged.rootDirectoryName,
      archivePath,
    });

    const sha256 = sha256File(archivePath);
    writeFileSync(join(outputDir, `${archiveName}.sha256`), `${sha256}  ${archiveName}\n`);
    artifacts.push({ platform, archiveName, sha256 });
  }

  if (!options.keepStaging) {
    rmSync(stagingRoot, { recursive: true, force: true });
  }

  const manifest = createReleaseManifest({ version, generatedAt, artifacts });
  const manifestPath = join(outputDir, "release-manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    outputDir,
    manifestPath,
    manifest,
  };
}

function copyDaemonRuntime(projectRoot: string, payloadRoot: string): void {
  const daemonRoot = join(projectRoot, "daemon");
  const targetRoot = join(payloadRoot, "daemon");
  const requiredFiles = ["package.json", "bun.lock", ".env.example", "install.sh"];

  for (const file of requiredFiles) {
    copyRequiredFile(daemonRoot, targetRoot, file);
  }
  copyOptionalFile(daemonRoot, targetRoot, "tsconfig.json");

  copyRequiredDirectory(join(daemonRoot, "platform"), join(targetRoot, "platform"));
  copyRequiredDirectory(join(daemonRoot, "src"), join(targetRoot, "src"), (path) => {
    return path === "test" || path.startsWith("test/") || path.endsWith(".test.ts") || path.includes("/test/");
  });

  chmodIfExists(join(targetRoot, "install.sh"), 0o755);
}

function writeCliEntrypoint(payloadRoot: string): void {
  const binDir = join(payloadRoot, "bin");
  const cliPath = join(binDir, "littleimp");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    cliPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
      'exec bun "${SCRIPT_DIR}/../daemon/src/cli.ts" "$@"',
      "",
    ].join("\n")
  );
  chmodSync(cliPath, 0o755);
}

function writeVersionMetadata(options: {
  payloadRoot: string;
  rootDirectoryName: string;
  platform: ReleasePlatform;
  version: string;
  generatedAt: string;
}): void {
  writeFileSync(join(options.payloadRoot, "VERSION"), `${options.version}\n`);
  writeFileSync(
    join(options.payloadRoot, "RELEASE.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        name: "little-imp",
        version: options.version,
        platform: options.platform,
        generatedAt: options.generatedAt,
        archiveRoot: options.rootDirectoryName,
        contents: {
          installer: "daemon/install.sh",
          daemon: "daemon",
          frontend: "dist",
          cli: "bin/littleimp",
          checksums: CHECKSUMS_FILE,
        },
      },
      null,
      2
    )}\n`
  );
}

function writeSigningInstructions(payloadRoot: string, version: string, platform: ReleasePlatform): void {
  const archiveName = releaseArchiveName(version, platform);
  writeFileSync(
    join(payloadRoot, "SIGNING.md"),
    [
      "# Release Signing",
      "",
      "This archive is signature-ready. Sign the published archive, not the unpacked directory:",
      "",
      "```sh",
      `gpg --armor --detach-sign --output ${archiveName}.asc ${archiveName}`,
      "npm run release:validate -- --require-signatures",
      "```",
      "",
      "The release manifest lists the expected detached signature filename.",
      "",
    ].join("\n")
  );
}

function copyOptionalFile(sourceRoot: string, targetRoot: string, path: string): void {
  const source = join(sourceRoot, path);
  if (!existsSync(source)) return;
  copyFilePreservingMode(source, join(targetRoot, path));
}

function copyRequiredFile(sourceRoot: string, targetRoot: string, path: string): void {
  const source = join(sourceRoot, path);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Required file is missing: ${source}`);
  }
  copyFilePreservingMode(source, join(targetRoot, path));
}

function copyRequiredDirectory(
  source: string,
  target: string,
  exclude?: (relativePath: string) => boolean
): void {
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`Required directory is missing: ${source}`);
  }
  copyDirectory(source, target, exclude);
}

function copyDirectory(source: string, target: string, exclude?: (relativePath: string) => boolean): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (isPortableMetadataEntry(entry.name)) continue;

    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    const relativePath = normalizeRelativePath(relative(source, sourcePath));
    if (exclude?.(relativePath)) continue;

    if (entry.isDirectory()) {
      copyDirectoryWithRoot(sourcePath, targetPath, source, exclude);
    } else if (entry.isFile()) {
      copyFilePreservingMode(sourcePath, targetPath);
    }
  }
}

function copyDirectoryWithRoot(
  source: string,
  target: string,
  sourceRoot: string,
  exclude?: (relativePath: string) => boolean
): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (isPortableMetadataEntry(entry.name)) continue;

    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    const relativePath = normalizeRelativePath(relative(sourceRoot, sourcePath));
    if (exclude?.(relativePath)) continue;

    if (entry.isDirectory()) {
      copyDirectoryWithRoot(sourcePath, targetPath, sourceRoot, exclude);
    } else if (entry.isFile()) {
      copyFilePreservingMode(sourcePath, targetPath);
    }
  }
}

function copyFilePreservingMode(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  chmodSync(target, statSync(source).mode & 0o777);
}

function chmodIfExists(path: string, mode: number): void {
  if (existsSync(path)) {
    chmodSync(path, mode);
  }
}

function listFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];
  for (const entry of entries) {
    if (isPortableMetadataEntry(entry.name)) continue;

    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join("/");
}

function formatChecksums(checksums: PayloadChecksum[]): string {
  return checksums.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n") + "\n";
}

function assertFrontendBundle(projectRoot: string): void {
  const indexPath = join(projectRoot, "dist", "index.html");
  if (!existsSync(indexPath)) {
    throw new Error(`Frontend bundle missing: ${indexPath}. Run npm run build before packaging.`);
  }
}

function assertSafeReleaseVersion(version: string): void {
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]*$/.test(version)) {
    throw new Error(`Release version contains unsupported characters: ${version}`);
  }
}

function createTarGzArchive(options: {
  stageRoot: string;
  rootDirectoryName: string;
  archivePath: string;
}): void {
  mkdirSync(dirname(options.archivePath), { recursive: true });
  runCommand(
    "tar",
    ["--no-xattrs", "-czf", options.archivePath, "-C", options.stageRoot, options.rootDirectoryName],
    options.stageRoot,
    {
      COPYFILE_DISABLE: "1",
    }
  );
}

function isPortableMetadataEntry(name: string): boolean {
  return name === ".DS_Store" || name === "__MACOSX" || name.startsWith("._");
}

function runCommand(command: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}
