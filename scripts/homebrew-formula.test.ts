import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  version: string;
};

const platforms = ["macos", "linux"] as const;
type ReleasePlatform = (typeof platforms)[number];
type ReleaseChecksumBaseline = Record<ReleasePlatform, string>;

type ReleaseManifest = {
  version: string;
  artifacts: Array<{
    platform: ReleasePlatform;
    archive: string;
    sha256: string;
  }>;
};

const projectRoot = process.cwd();
const formulaPath = join(projectRoot, "Formula", "little-imp.rb");
const readProjectFile = (path: string) => readFileSync(join(projectRoot, path), "utf8");
const sha256Pattern = /sha256 "([a-f0-9]{64})"/;
const releaseChecksumBaselines: Record<string, ReleaseChecksumBaseline> = {
  "0.1.0-beta": {
    macos: "d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59",
    linux: "a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098",
  },
};

function packageVersion(): string {
  return (JSON.parse(readProjectFile("package.json")) as PackageJson).version;
}

function releaseManifest(): ReleaseManifest | null {
  const manifestPath = join(projectRoot, "release", "release-manifest.json");
  if (!existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(readFileSync(manifestPath, "utf8")) as ReleaseManifest;
}

function releaseManifestChecksums(version: string): ReleaseChecksumBaseline | null {
  const manifest = releaseManifest();
  if (!manifest) {
    return null;
  }

  expect(manifest.version).toBe(version);
  return Object.fromEntries(
    platforms.map((platform) => {
      const archive = `little-imp-${version}-${platform}.tar.gz`;
      const artifact = manifest.artifacts.find(
        (entry) => entry.platform === platform && entry.archive === archive
      );
      expect(artifact, `Missing ${platform} artifact in release manifest`).toBeDefined();
      return [platform, artifact?.sha256];
    })
  ) as ReleaseChecksumBaseline;
}

function expectedReleaseChecksums(version: string): ReleaseChecksumBaseline {
  const baseline = releaseChecksumBaselines[version];
  expect(baseline, `Missing tracked Homebrew checksum baseline for ${version}`).toBeDefined();

  const manifestChecksums = releaseManifestChecksums(version);
  if (manifestChecksums) {
    expect(manifestChecksums).toEqual(baseline);
  }

  return baseline;
}

function formulaSnippetAfter(formula: string, expectedLine: string): string {
  const start = formula.indexOf(expectedLine);
  expect(start).toBeGreaterThanOrEqual(0);
  return formula.slice(start, start + expectedLine.length + 90);
}

describe("Homebrew formula packaging", () => {
  it("installs the current release archives by pinned checksum instead of rebuilding from source", () => {
    const version = packageVersion();
    const expectedChecksums = expectedReleaseChecksums(version);
    const formula = readFileSync(formulaPath, "utf8");

    for (const platform of platforms) {
      const archive = `little-imp-${version}-${platform}.tar.gz`;
      const releaseUrl = `https://github.com/goniszewski/little-imp/releases/download/v${version}/${archive}`;
      const urlLine = `url "${releaseUrl}"`;
      const snippet = formulaSnippetAfter(formula, urlLine);
      const sha256Match = snippet.match(sha256Pattern);

      expect(sha256Match?.[1]).toBeDefined();
      expect(sha256Match?.[1]).toBe(expectedChecksums[platform]);
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
