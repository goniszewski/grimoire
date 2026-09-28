import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateReleaseArtifacts } from "./release-artifacts-validator";
import type { ReleaseManifest } from "./release-packager";

function command(name: string, args: string[]): string {
  const result = spawnSync(name, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

export function checkFinalRelease(root: string): void {
  const releaseDir = join(root, "release");
  const version = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  const head = command("/usr/bin/git", ["-C", root, "rev-parse", "HEAD"]);
  const branch = command("/usr/bin/git", ["-C", root, "branch", "--show-current"]);
  if (branch !== "main") throw new Error("Final release must be built from main");
  if (command("/usr/bin/git", ["-C", root, "status", "--porcelain", "--untracked-files=normal"])) {
    throw new Error("Final release requires a clean source checkout");
  }
  const remoteMain = command("/usr/bin/git", ["-C", root, "ls-remote", "origin", "refs/heads/main"]).split(/\s+/)[0];
  if (remoteMain !== head) throw new Error("Final release HEAD differs from remote main");
  const tagCommit = command("/usr/bin/git", ["-C", root, "rev-parse", `refs/tags/v${version}^{commit}`]);
  if (tagCommit !== head) throw new Error("Release tag differs from final main commit");

  const manifest = JSON.parse(readFileSync(join(releaseDir, "release-manifest.json"), "utf8")) as ReleaseManifest;
  if (manifest.version !== version || manifest.sourceCommit !== head || manifest.sourceDirty !== false) {
    throw new Error("Release manifest does not identify this clean tagged commit");
  }
  const result = validateReleaseArtifacts({ releaseDir, requireSignatures: true });
  if (!result.ok) throw new Error(result.errors.join("\n"));
  for (const platform of ["macos", "linux"]) {
    const archive = `little-imp-${version}-${platform}.tar.gz`;
    if (!result.checkedArtifacts.includes(archive)) throw new Error(`Missing ${platform} release archive`);
    command("gpg", ["--verify", join(releaseDir, `${archive}.asc`), join(releaseDir, archive)]);
  }
  console.log(`Final release ${version} verified at ${head} with ${manifest.artifacts.length} signed archives.`);
}

if (import.meta.main) {
  const root = process.cwd();
  try {
    checkFinalRelease(root);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
