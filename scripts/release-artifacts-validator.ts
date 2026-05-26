import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File, type ReleaseManifest } from "./release-packager";

export interface ValidateReleaseArtifactsOptions {
  releaseDir: string;
  requireSignatures?: boolean;
}

export interface ValidateReleaseArtifactsResult {
  ok: boolean;
  errors: string[];
  checkedArtifacts: string[];
}

interface CliOptions {
  releaseDir: string;
  requireSignatures: boolean;
  help: boolean;
}

export function validateReleaseArtifacts(options: ValidateReleaseArtifactsOptions): ValidateReleaseArtifactsResult {
  const releaseDir = resolve(options.releaseDir);
  const errors: string[] = [];
  const checkedArtifacts: string[] = [];
  const manifestPath = join(releaseDir, "release-manifest.json");

  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      errors: [`Missing manifest: ${manifestPath}`],
      checkedArtifacts,
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ReleaseManifest;
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    errors.push("Release manifest does not list any artifacts");
    return {
      ok: false,
      errors,
      checkedArtifacts,
    };
  }

  for (const artifact of manifest.artifacts) {
    if (!isSafeArtifactFileName(artifact.archive)) {
      errors.push(`Invalid artifact archive path: ${artifact.archive}`);
      continue;
    }
    if (!isSafeArtifactFileName(artifact.checksum)) {
      errors.push(`Invalid artifact checksum path: ${artifact.checksum}`);
      continue;
    }
    if (!isSafeArtifactFileName(artifact.signature)) {
      errors.push(`Invalid artifact signature path: ${artifact.signature}`);
      continue;
    }

    checkedArtifacts.push(artifact.archive);
    const archivePath = join(releaseDir, artifact.archive);
    const checksumPath = join(releaseDir, artifact.checksum);
    const signaturePath = join(releaseDir, artifact.signature);

    if (!existsSync(archivePath)) {
      errors.push(`Missing archive: ${artifact.archive}`);
      continue;
    }
    if (!existsSync(checksumPath)) {
      errors.push(`Missing checksum: ${artifact.checksum}`);
      continue;
    }

    const actualSha256 = sha256File(archivePath);
    const checksumFileSha256 = parseChecksumFile(checksumPath, artifact.archive);
    if (actualSha256 !== artifact.sha256 || checksumFileSha256 !== actualSha256) {
      errors.push(`Checksum mismatch for ${artifact.archive}`);
    }

    const signatureStats = existsSync(signaturePath) ? statSync(signaturePath) : null;
    if (options.requireSignatures && (!signatureStats?.isFile() || signatureStats.size === 0)) {
      errors.push(`Missing signature: ${artifact.signature}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    checkedArtifacts,
  };
}

function isSafeArtifactFileName(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === basename(value) &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

function parseChecksumFile(path: string, expectedArchiveName: string): string | null {
  const firstLine = readFileSync(path, "utf8").split(/\r?\n/)[0] ?? "";
  const match = firstLine.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
  if (!match) return null;
  if (match[2] !== expectedArchiveName) return null;
  return match[1].toLowerCase();
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    releaseDir: "release",
    requireSignatures: false,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--dir":
      case "-d":
        options.releaseDir = requireValue(args, (i += 1), arg);
        break;
      case "--require-signatures":
        options.requireSignatures = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage: npm run release:validate -- [options]

Options:
  --dir, -d DIR           Release directory (default: release)
  --require-signatures    Require non-empty .asc files for every archive
  --help, -h              Show this help
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exit(0);
    }

    const result = validateReleaseArtifacts({
      releaseDir: options.releaseDir,
      requireSignatures: options.requireSignatures,
    });

    if (!result.ok) {
      for (const error of result.errors) {
        console.error(error);
      }
      process.exit(1);
    }

    console.log(`Validated ${result.checkedArtifacts.length} release artifact(s).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
