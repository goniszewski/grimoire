import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseArchiveFileName } from "../daemon/src/update/release-names";

type Platform = "macos" | "linux";
const platforms: Platform[] = ["macos", "linux"];

interface Artifact {
  platform: Platform;
  archive: string;
  sha256: string;
}

interface Manifest {
  version: string;
  artifacts: Artifact[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function formulaPin(formula: string, platform: Platform): { version: string; archive: string; sha256: string } {
  const pattern = new RegExp(
    `url "https://github\\.com/goniszewski/grimoire/releases/download/v([^/]+)/([^"]+-${platform}\\.tar\\.gz)"\\s+sha256 "([a-f0-9]{64})"`,
    "g"
  );
  const matches = [...formula.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Expected one ${platform} Homebrew URL and checksum pair`);
  return { version: matches[0][1], archive: matches[0][2], sha256: matches[0][3] };
}

function checkedArtifacts(manifest: Manifest): Artifact[] {
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error("Release manifest has an invalid version");
  return platforms.map((platform) => {
    const entries = manifest.artifacts.filter((artifact) => artifact.platform === platform);
    if (entries.length !== 1) throw new Error(`Expected one ${platform} release artifact`);
    const artifact = entries[0];
    if (artifact.archive !== releaseArchiveFileName(manifest.version, platform)) {
      throw new Error(`Wrong ${platform} archive name`);
    }
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`Invalid ${platform} SHA-256`);
    return artifact;
  });
}

export function prepareHomebrewFormula(formula: string, manifest: Manifest): string {
  const artifacts = checkedArtifacts(manifest);
  let prepared = formula;
  for (const artifact of artifacts) {
    const old = formulaPin(prepared, artifact.platform);
    const oldPair = `url "https://github.com/goniszewski/grimoire/releases/download/v${old.version}/${old.archive}"\n    sha256 "${old.sha256}"`;
    const newPair = `url "https://github.com/goniszewski/grimoire/releases/download/v${manifest.version}/${artifact.archive}"\n    sha256 "${artifact.sha256}"`;
    if (!prepared.includes(oldPair)) throw new Error(`Unexpected ${artifact.platform} formula layout`);
    prepared = prepared.replace(oldPair, newPair);
  }
  return prepared;
}

export function checkReleaseMetadata(root: string): string[] {
  const errors: string[] = [];
  const packageVersion = readJson<{ version: string }>(join(root, "package.json")).version;
  const daemonVersion = readJson<{ version: string }>(join(root, "daemon/package.json")).version;
  const lock = readJson<{ version: string; packages: { "": { version: string } } }>(join(root, "package-lock.json"));
  const published = readJson<Manifest>(join(root, "Formula/release.json"));
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const installer = readFileSync(join(root, "install.sh"), "utf8");
  const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
  const formula = readFileSync(join(root, "Formula/grimoire.rb"), "utf8");

  for (const [name, version] of [
    ["daemon/package.json", daemonVersion],
    ["package-lock.json", lock.version],
    ["package-lock.json root", lock.packages[""].version],
  ]) {
    if (version !== packageVersion) errors.push(`${name} version ${version} differs from package.json ${packageVersion}`);
  }
  if (!readme.includes(`badge/release-${packageVersion}-`)) errors.push("README candidate badge differs from package.json");
  if (!changelog.includes(`## [${packageVersion}] - `)) {
    errors.push("CHANGELOG has no candidate or dated release heading");
  }
  try {
    const artifacts = checkedArtifacts(published);
    for (const artifact of artifacts) {
      const pin = formulaPin(formula, artifact.platform);
      if (pin.version !== published.version || pin.archive !== artifact.archive || pin.sha256 !== artifact.sha256) {
        errors.push(`${artifact.platform} formula pin differs from Formula/release.json`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (!installer.includes(`VERSION="\${LITTLEIMP_VERSION:-${published.version}}"`)) {
    errors.push("One-command installer default differs from published release");
  }
  if (!agents.includes(`Current published release: \`${published.version}\``)) {
    errors.push("AGENTS.md published release differs from Formula/release.json");
  }
  if (!readme.includes(`Grimoire v${published.version} is available through Homebrew`)) {
    errors.push("README Homebrew version differs from published release");
  }
  return errors;
}

function main(): void {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--check") {
    const errors = checkReleaseMetadata(root);
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Candidate and published release metadata are consistent.");
    return;
  }
  if (args[0] === "--prepare-formula" && args.length === 2) {
    const manifest = readJson<Manifest>(resolve(root, args[1]));
    const packageVersion = readJson<{ version: string }>(join(root, "package.json")).version;
    if (manifest.version !== packageVersion) throw new Error("Manifest version differs from package.json");
    const formulaPath = join(root, "Formula/grimoire.rb");
    const formula = prepareHomebrewFormula(readFileSync(formulaPath, "utf8"), manifest);
    writeFileSync(formulaPath, formula);
    writeFileSync(join(root, "Formula/release.json"), `${JSON.stringify({
      version: manifest.version,
      artifacts: checkedArtifacts(manifest),
    }, null, 2)}\n`);
    console.log(`Prepared both Homebrew pins for ${manifest.version}.`);
    return;
  }
  throw new Error("Usage: bun run scripts/release-metadata.ts [--check | --prepare-formula MANIFEST]");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
