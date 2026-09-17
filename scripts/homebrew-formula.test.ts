import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// Formula releases can advance independently of this source branch. Keep the
// reviewed artifact manifest tracked, rather than consulting ignored build output.
function formulaRelease(): ReleaseManifest {
  return JSON.parse(readProjectFile("Formula/release.json")) as ReleaseManifest;
}

function expectedReleaseChecksums(version: string): ReleaseChecksumBaseline {
  const manifest = formulaRelease();
  expect(manifest.version).toBe(version);
  expect(manifest.artifacts).toHaveLength(platforms.length);
  return Object.fromEntries(platforms.map((platform) => {
    const artifacts = manifest.artifacts.filter((entry) => entry.platform === platform);
    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0];
    expect(artifact.archive).toBe(`little-imp-${version}-${platform}.tar.gz`);
    expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    return [platform, artifact.sha256];
  })) as ReleaseChecksumBaseline;
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
    const version = formulaRelease().version;
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
    expect(formula).toContain(
      '"install", "--production", "--frozen-lockfile", "--ignore-scripts", "--cwd", libexec/"daemon"'
    );
    expect(formula).toContain('formula_opt_bin("bun")');
    expect(formula).toContain("post_install_steps do");
    expect(formula).not.toContain("def post_install");
    expect(formula).toContain('unless_path_exists "little-imp/.env", base: :var');
    expect(formula).toContain('set_permissions "little-imp/.env", "0600", base: :var, recursive: false');
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

  it("documents the published macOS path and keeps unverified platforms explicit", () => {
    const readme = readProjectFile("README.md");
    const packageJson = JSON.parse(readProjectFile("package.json")) as PackageJson;

    expect(readme).toContain("### Homebrew");
    expect(readme).toContain("Linux Homebrew remains unverified");
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
