import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkReleaseMetadata, prepareHomebrewFormula } from "./release-metadata";

const projectRoot = process.cwd();

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "grimoire-release-metadata-"));
  for (const path of [
    "package.json", "package-lock.json", "daemon/package.json",
    "Formula/release.json", "Formula/grimoire.rb", "README.md", "CHANGELOG.md",
    "install.sh", "AGENTS.md",
  ]) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    copyFileSync(join(projectRoot, path), join(root, path));
  }
  return root;
}

describe("release metadata", () => {
  it("keeps candidate and published versions independently consistent", () => {
    const root = fixtureRoot();
    try {
      expect(checkReleaseMetadata(root)).toEqual([]);
      const installerPath = join(root, "install.sh");
      writeFileSync(installerPath, readFileSync(installerPath, "utf8").replace("LITTLEIMP_VERSION:-1.2.0", "LITTLEIMP_VERSION:-1.1.0"));
      expect(checkReleaseMetadata(root)).toContain("One-command installer default differs from published release");
      const daemonPath = join(root, "daemon/package.json");
      writeFileSync(daemonPath, readFileSync(daemonPath, "utf8").replace('"version": "1.3.0"', '"version": "1.2.0"'));
      expect(checkReleaseMetadata(root)).toContain("daemon/package.json version 1.2.0 differs from package.json 1.3.0");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("sets both Homebrew pins from a complete candidate manifest", () => {
    const formula = readFileSync(join(projectRoot, "Formula/grimoire.rb"), "utf8");
    const manifest = {
      version: "1.3.0",
      artifacts: [
        { platform: "macos" as const, archive: "little-imp-1.3.0-macos.tar.gz", sha256: "a".repeat(64) },
        { platform: "linux" as const, archive: "little-imp-1.3.0-linux.tar.gz", sha256: "b".repeat(64) },
      ],
    };
    const prepared = prepareHomebrewFormula(formula, manifest);
    expect(prepared).toContain('v1.3.0/little-imp-1.3.0-macos.tar.gz"\n    sha256 "' + "a".repeat(64));
    expect(prepared).toContain('v1.3.0/little-imp-1.3.0-linux.tar.gz"\n    sha256 "' + "b".repeat(64));
    expect(() => prepareHomebrewFormula(formula, { ...manifest, artifacts: manifest.artifacts.slice(0, 1) }))
      .toThrow("Expected one linux release artifact");
  });
});
