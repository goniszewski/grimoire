import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPayloadChecksums,
  createReleaseManifest,
  packageRelease,
  stageReleasePayload,
} from "./release-packager";

function writeFixtureFile(root: string, path: string, contents: string): void {
  const fullPath = join(root, path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, contents);
}

function createProjectFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "little-imp-release-fixture-"));

  writeFixtureFile(root, "package.json", JSON.stringify({ name: "little-imp", version: "1.2.3-beta" }));
  writeFixtureFile(root, "LICENSE", "license\n");
  writeFixtureFile(root, "README.md", "# Little Imp\n");
  writeFixtureFile(root, "dist/index.html", "<div id=\"root\"></div>\n");
  writeFixtureFile(root, "dist/assets/app.js", "console.log('little imp');\n");
  writeFixtureFile(root, "daemon/package.json", JSON.stringify({ name: "littleimpd" }));
  writeFixtureFile(root, "daemon/bun.lock", "lock\n");
  writeFixtureFile(root, "daemon/.env.example", "HOST=127.0.0.1\n");
  writeFixtureFile(root, "daemon/install.sh", "#!/usr/bin/env bash\n");
  writeFixtureFile(root, "daemon/platform/littleimp.service", "[Service]\n");
  writeFixtureFile(root, "daemon/platform/com.littleimp.daemon.plist", "<plist />\n");
  writeFixtureFile(root, "daemon/src/cli.ts", "console.log('cli');\n");
  writeFixtureFile(root, "daemon/src/index.ts", "console.log('daemon');\n");
  writeFixtureFile(root, "daemon/src/db/migrations/0001_initial.sql", "SELECT 1;\n");
  writeFixtureFile(root, "daemon/src/db/migrations/._0001_initial.sql", "AppleDouble metadata\n");
  writeFixtureFile(root, "daemon/src/test/ignored.test.ts", "throw new Error('not runtime');\n");
  writeFixtureFile(root, "daemon/node_modules/ignored/index.js", "module.exports = {};\n");

  return root;
}

describe("release packager", () => {
  it("stages the installable payload with daemon runtime files, frontend bundle, CLI, and metadata", () => {
    const projectRoot = createProjectFixture();
    const stageRoot = join(mkdtempSync(join(tmpdir(), "little-imp-release-stage-")), "payload");

    const result = stageReleasePayload({
      projectRoot,
      stageRoot,
      platform: "linux",
      version: "1.2.3-beta",
      generatedAt: "2026-05-26T00:00:00.000Z",
    });

    expect(result.rootDirectoryName).toBe("little-imp-1.2.3-beta-linux");
    expect(readFileSync(join(result.payloadRoot, "VERSION"), "utf8")).toBe("1.2.3-beta\n");
    expect(readFileSync(join(result.payloadRoot, "dist/index.html"), "utf8")).toContain("root");
    expect(readFileSync(join(result.payloadRoot, "daemon/install.sh"), "utf8")).toContain("bash");
    expect(readFileSync(join(result.payloadRoot, "daemon/src/cli.ts"), "utf8")).toContain("cli");
    expect(readFileSync(join(result.payloadRoot, "daemon/src/db/migrations/0001_initial.sql"), "utf8")).toContain(
      "SELECT 1"
    );
    expect(readFileSync(join(result.payloadRoot, "bin/littleimp"), "utf8")).toContain("../daemon/src/cli.ts");
    expect(readFileSync(join(result.payloadRoot, "RELEASE.json"), "utf8")).toContain("\"platform\": \"linux\"");
    expect(readFileSync(join(result.payloadRoot, "SIGNING.md"), "utf8")).toContain("detach-sign");

    expect(statSync(join(result.payloadRoot, "bin/littleimp")).mode & 0o111).toBeGreaterThan(0);
    expect(statSync(join(result.payloadRoot, "daemon/install.sh")).mode & 0o111).toBeGreaterThan(0);

    expect(() => statSync(join(result.payloadRoot, "daemon/src/test/ignored.test.ts"))).toThrow();
    expect(() => statSync(join(result.payloadRoot, "daemon/src/db/migrations/._0001_initial.sql"))).toThrow();
    expect(() => statSync(join(result.payloadRoot, "daemon/node_modules/ignored/index.js"))).toThrow();
  });

  it("builds deterministic payload checksums and excludes the checksum file itself", () => {
    const root = mkdtempSync(join(tmpdir(), "little-imp-checksums-"));
    writeFixtureFile(root, "b.txt", "second\n");
    writeFixtureFile(root, "a.txt", "first\n");
    writeFixtureFile(root, "CHECKSUMS.sha256", "stale\n");

    const checksums = buildPayloadChecksums(root);

    expect(checksums.map((entry) => entry.path)).toEqual(["a.txt", "b.txt"]);
    expect(checksums[0].sha256).toHaveLength(64);
  });

  it("refuses to package when required daemon runtime files are missing", () => {
    const projectRoot = createProjectFixture();
    rmSync(join(projectRoot, "daemon/install.sh"));

    expect(() =>
      stageReleasePayload({
        projectRoot,
        stageRoot: join(mkdtempSync(join(tmpdir(), "little-imp-release-stage-")), "payload"),
        platform: "macos",
        version: "1.2.3-beta",
      })
    ).toThrow(/Required file is missing: .*daemon.*install\.sh/);
  });

  it("rejects version strings that cannot be used safely in archive paths", () => {
    const projectRoot = createProjectFixture();

    expect(() =>
      stageReleasePayload({
        projectRoot,
        stageRoot: join(mkdtempSync(join(tmpdir(), "little-imp-release-stage-")), "payload"),
        platform: "linux",
        version: "../1.2.3",
      })
    ).toThrow("Release version contains unsupported characters");
  });

  it("removes stale detached signatures when rebuilding release artifacts", () => {
    const projectRoot = createProjectFixture();
    const outputDir = mkdtempSync(join(tmpdir(), "little-imp-release-output-"));
    const staleSignaturePath = join(outputDir, "little-imp-1.2.3-beta-linux.tar.gz.asc");
    writeFileSync(staleSignaturePath, "signature for old archive\n");

    packageRelease({
      projectRoot,
      outputDir,
      version: "1.2.3-beta",
      platforms: ["linux"],
      skipBuild: true,
      generatedAt: "2026-05-26T00:00:00.000Z",
      logger: { log: () => undefined },
    });

    expect(existsSync(staleSignaturePath)).toBe(false);
  });

  it("creates a signature-ready manifest for every release artifact", () => {
    const manifest = createReleaseManifest({
      version: "1.2.3-beta",
      generatedAt: "2026-05-26T00:00:00.000Z",
      artifacts: [
        {
          platform: "macos",
          archiveName: "little-imp-1.2.3-beta-macos.tar.gz",
          sha256: "a".repeat(64),
        },
        {
          platform: "linux",
          archiveName: "little-imp-1.2.3-beta-linux.tar.gz",
          sha256: "b".repeat(64),
        },
      ],
    });

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      name: "little-imp",
      version: "1.2.3-beta",
      generatedAt: "2026-05-26T00:00:00.000Z",
      signing: {
        detachedSignatureExtension: ".asc",
        requiredBeforePublication: true,
      },
    });
    expect(manifest.artifacts).toEqual([
      {
        platform: "macos",
        archive: "little-imp-1.2.3-beta-macos.tar.gz",
        checksum: "little-imp-1.2.3-beta-macos.tar.gz.sha256",
        sha256: "a".repeat(64),
        signature: "little-imp-1.2.3-beta-macos.tar.gz.asc",
      },
      {
        platform: "linux",
        archive: "little-imp-1.2.3-beta-linux.tar.gz",
        checksum: "little-imp-1.2.3-beta-linux.tar.gz.sha256",
        sha256: "b".repeat(64),
        signature: "little-imp-1.2.3-beta-linux.tar.gz.asc",
      },
    ]);
  });
});
