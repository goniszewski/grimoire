import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  version: string;
  scripts?: Record<string, string>;
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
const formulaPath = join(projectRoot, "Formula", "grimoire.rb");
const readProjectFile = (path: string) => readFileSync(join(projectRoot, path), "utf8");
const sha256Pattern = /sha256 "([a-f0-9]{64})"/;
const releaseChecksumBaselines: Record<string, ReleaseChecksumBaseline> = {
  "0.1.0-beta": {
    macos: "d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59",
    linux: "a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098",
  },
  // Placeholder checksums — replace with actual SHA-256 values when release artifacts are built and published.
  "1.0.0": {
    macos: "000000000000000000000000000000000000000000000000000000000000000a",
    linux: "000000000000000000000000000000000000000000000000000000000000000b",
  },
  "1.0.1": {
    macos: "a8c934821cc8db588ef9b3213f013c4cd99f1ae23ba8f18e400727191a9d49c1",
    linux: "42cf4ea63bb31ea2380a0b3c8c4c65f7af943974ce1024dd9562a2484e343cff",
  },
  "1.1.0": {
    macos: "98e96cc53bebf02265c86d2014bba0d9cf9978a7bc411d041cac86bef1ce8021",
    linux: "793c416e22173c4c825f564487d5ae704db5d3bedb99553545f7f1dad83657d7",
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
  it("blocks native upgrades before invoking an older runtime and forwards other commands unchanged", () => {
    const root = mkdtempSync(join(tmpdir(), "grimoire-formula-"));
    try {
      const runtime = join(root, "old bun");
      // Stand in for an older archive that ignores LITTLEIMP_PACKAGE_MANAGER.
      writeFileSync(runtime, '#!/bin/bash\nprintf "%s\\n" "$LITTLEIMP_PACKAGE_MANAGER" "$@"\n', { mode: 0o755 });
      const formula = readFileSync(formulaPath, "utf8");
      const wrapper = formula.match(/cli_wrapper = <<~EOS\n([\s\S]*?)^\s*EOS/m)?.[1];
      expect(wrapper).toBeDefined();
      const cliPath = join(root, "old release", "daemon", "src", "cli.ts");
      const contents = wrapper!
        .replace(/^ {6}/gm, "")
        .replaceAll("#{bun}", runtime)
        .replaceAll("#{opt_libexec}", join(root, "old release"));

      for (const command of ["grimoire", "littleimp"]) {
        const executable = join(root, command);
        writeFileSync(executable, contents, { mode: 0o755 });
        for (const action of ["install", "upgrade"]) {
          for (const options of [[], ["--archive", "missing.tar.gz", "--checksum", "missing.sha256", "--json"]]) {
            const result = spawnSync(executable, ["update", action, ...options], { encoding: "utf8" });
            expect(result.error).toBeUndefined();
            expect(result.status).toBe(2);
            expect(result.stderr).toContain("brew upgrade grimoire");
            expect(result.stdout).toBe("");
          }
        }

        for (const args of [[], ["--help"], ["update", "check", "--json"], ["backup", "verify", "--file", "path with spaces", ""]]) {
          const result = spawnSync(executable, args, { encoding: "utf8" });
          expect(result.error).toBeUndefined();
          expect(result.status).toBe(0);
          expect(result.stderr).toBe("");
          expect(result.stdout).toBe(["homebrew", cliPath, ...args, ""].join("\n"));
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("installs the current release archives by pinned checksum instead of rebuilding from source", () => {
    const version = packageVersion();
    const expectedChecksums = expectedReleaseChecksums(version);
    const formula = readFileSync(formulaPath, "utf8");

    for (const platform of platforms) {
      const archive = `little-imp-${version}-${platform}.tar.gz`;
      const releaseUrl = `https://github.com/goniszewski/grimoire/releases/download/v${version}/${archive}`;
      const urlLine = `url "${releaseUrl}"`;
      const snippet = formulaSnippetAfter(formula, urlLine);
      const sha256Match = snippet.match(sha256Pattern);

      expect(sha256Match?.[1]).toBeDefined();
      expect(sha256Match?.[1]).toBe(expectedChecksums[platform]);
    }

    expect(formula).toContain('depends_on "bun"');
    expect(formula).not.toContain('depends_on "oven-sh/bun/bun"');
    expect(formula).toContain('libexec.install "daemon", "dist"');
    expect(formula).toContain('"install", "--production", "--frozen-lockfile", "--cwd", libexec/"daemon"');
    expect(formula).toContain('formula_opt_bin("bun")');
    expect(formula).toContain('LITTLEIMP_PACKAGE_MANAGER="homebrew"');
    expect(formula).toContain('(bin/"grimoire").write');
    expect(formula).toContain('(bin/"littleimp").write');
    expect(formula).toContain('(bin/"grimoire").chmod 0555');
    expect(formula).toContain('(bin/"littleimp").chmod 0555');
    expect(formula).toContain('(bin/"littleimpd").write');
    expect(formula).toContain('(bin/"littleimpd").chmod 0555');
    expect(formula).toContain("service do");
    expect(formula).toContain("keep_alive true");
    expect(formula).toMatch(/HOST:\s+"127\.0\.0\.1"/);
    expect(formula).toMatch(/PORT:\s+"3210"/);
    expect(formula).toContain("brew services start grimoire");
    expect(formula).toContain("brew upgrade grimoire");
    expect(formula).not.toMatch(/git clone|npm run build|bun run build|system ".*daemon\/install\.sh/);
  });

  it("documents Homebrew as a pending path until live validation passes", () => {
    const readme = readProjectFile("README.md");
    const packageJson = JSON.parse(readProjectFile("package.json")) as PackageJson;

    expect(readme).toContain("### Homebrew (pending live validation)");
    expect(readme).toContain("Homebrew is not a supported");
    expect(readme).toContain("brew trust --formula goniszewski/grimoire/grimoire");
    expect(readme).not.toContain("brew install little-imp");
    expect(readme).not.toContain("brew services start little-imp");

    const installGuide = readProjectFile("docs/05-install-without-docker.md");
    expect(installGuide).toContain("brew trust --formula goniszewski/grimoire/grimoire");
    expect(packageJson.scripts?.["test:homebrew"]).toBe("bash scripts/homebrew-smoke.sh");
    expect(packageJson.scripts?.["test:homebrew:published"]).toBe(
      "bash scripts/homebrew-smoke.sh published"
    );
  });
});
