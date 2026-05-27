import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  version: string;
};

type ReleaseManifest = {
  version: string;
  artifacts: Array<{
    platform: "macos" | "linux";
    archive: string;
    sha256: string;
  }>;
};

const projectRoot = process.cwd();
const formulaPath = join(projectRoot, "Formula", "little-imp.rb");
const readProjectFile = (path: string) => readFileSync(join(projectRoot, path), "utf8");

function packageVersion(): string {
  return (JSON.parse(readProjectFile("package.json")) as PackageJson).version;
}

function releaseManifest(): ReleaseManifest {
  return JSON.parse(readProjectFile("release/release-manifest.json")) as ReleaseManifest;
}

describe("Homebrew formula packaging", () => {
  it("installs the published release archives by checksum instead of rebuilding from source", () => {
    const version = packageVersion();
    const manifest = releaseManifest();
    const formula = readFileSync(formulaPath, "utf8");

    expect(manifest.version).toBe(version);

    for (const artifact of manifest.artifacts) {
      expect(formula).toContain(
        `https://github.com/goniszewski/little-imp/releases/download/v${version}/${artifact.archive}`
      );
      expect(formula).toContain(`sha256 "${artifact.sha256}"`);
    }

    expect(formula).toContain('depends_on "oven-sh/bun/bun"');
    expect(formula).toContain('libexec.install "daemon", "dist"');
    expect(formula).toContain('"install", "--production", "--cwd", libexec/"daemon"');
    expect(formula).toContain('(bin/"littleimp").write');
    expect(formula).toContain('(bin/"littleimpd").write');
    expect(formula).toContain("service do");
    expect(formula).toContain("keep_alive true");
    expect(formula).toMatch(/HOST:\s+"127\.0\.0\.1"/);
    expect(formula).toMatch(/PORT:\s+"3210"/);
    expect(formula).not.toMatch(/git clone|npm run build|bun run build|system ".*daemon\/install\.sh/);
  });

  it("documents Homebrew as an alternate MVP install path with data-preserving commands", () => {
    const readme = readProjectFile("README.md");
    const releaseChecklist = readProjectFile("docs/release-checklist.md");

    expect(readme).toContain("### Homebrew alternate install");
    expect(readme).toContain("brew tap goniszewski/little-imp");
    expect(readme).toContain("brew install little-imp");
    expect(readme).toContain("brew services start little-imp");
    expect(readme).toContain("Homebrew is an alternate MVP install path");
    expect(readme).toContain("brew uninstall little-imp");
    expect(readme).toContain("Data is preserved");

    expect(releaseChecklist).toContain("brew tap oven-sh/bun");
    expect(releaseChecklist).toContain('brew tap goniszewski/little-imp "$PWD"');
    expect(releaseChecklist).toContain("brew audit --strict goniszewski/little-imp/little-imp");
    expect(releaseChecklist).toContain("brew install goniszewski/little-imp/little-imp");
    expect(releaseChecklist).toContain("brew uninstall little-imp");
  });
});
