import { packageRelease, RELEASE_PLATFORMS, type ReleasePlatform } from "./release-packager";
import { fileURLToPath } from "node:url";

interface CliOptions {
  outputDir?: string;
  version?: string;
  platforms?: ReleasePlatform[];
  skipBuild?: boolean;
  keepStaging?: boolean;
  help?: boolean;
}

export function parsePackageReleaseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--output":
      case "-o":
        options.outputDir = requireValue(args, (i += 1), arg);
        break;
      case "--version":
        options.version = requireValue(args, (i += 1), arg);
        break;
      case "--platform": {
        const value = requireValue(args, (i += 1), arg);
        options.platforms = value === "all" ? RELEASE_PLATFORMS : [parsePlatform(value)];
        break;
      }
      case "--skip-build":
        options.skipBuild = true;
        break;
      case "--keep-staging":
        options.keepStaging = true;
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

function parsePlatform(value: string): ReleasePlatform {
  if (value === "macos" || value === "linux") return value;
  throw new Error(`Unsupported platform: ${value}. Expected macos, linux, or all.`);
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage: npm run package:release -- [options]

Options:
  --output, -o DIR      Output directory (default: release)
  --version VERSION    Version override (default: package.json version)
  --platform PLATFORM  macos, linux, or all (default: all)
  --skip-build         Use the existing dist/ frontend bundle
  --keep-staging       Keep release/.staging for inspection
  --help, -h           Show this help
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parsePackageReleaseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exit(0);
    }

    const result = packageRelease({
      projectRoot: process.cwd(),
      outputDir: options.outputDir,
      version: options.version,
      platforms: options.platforms,
      skipBuild: options.skipBuild,
      keepStaging: options.keepStaging,
    });

    console.log(`Release artifacts written to ${result.outputDir}`);
    console.log(`Manifest: ${result.manifestPath}`);
    for (const artifact of result.manifest.artifacts) {
      console.log(`- ${artifact.archive}`);
      console.log(`  checksum: ${artifact.checksum}`);
      console.log(`  signature: ${artifact.signature}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
