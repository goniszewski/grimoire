import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  archiveRootDirectoryNameFromEntries,
  backupNameFromPath,
  defaultPublishedReleaseBaseUrl,
  detectReleasePlatform,
  downloadPublishedReleaseArtifact,
  releaseArchiveName,
  runCommandCapture,
  type SignatureRunner,
} from "./installed-app-smoke";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
const releaseChecklist = readFileSync("docs/release-checklist.md", "utf8");
const smokeRunner = readFileSync("scripts/installed-app-smoke.ts", "utf8");

function sha256(path: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function fetchFromReleaseDir(releaseDir: string): typeof fetch {
  return async (url) => {
    const fileName = new URL(String(url)).pathname.split("/").pop();
    if (!fileName) return new Response("missing", { status: 404 });
    const path = join(releaseDir, fileName);
    if (!existsSync(path)) return new Response("missing", { status: 404 });
    return new Response(readFileSync(path));
  };
}

describe("installed-app smoke suite", () => {
  it("exposes a repeatable installed-artifact smoke command", () => {
    expect(packageJson.scripts?.["test:e2e:installed"]).toBe(
      "npm run package:release && bun run scripts/installed-app-smoke.ts"
    );
    expect(packageJson.scripts?.["test:e2e:installed:published"]).toBe(
      "bun run scripts/installed-app-smoke.ts --source published --require-signature"
    );
    expect(releaseChecklist).toContain("npm run test:e2e:installed");
    expect(releaseChecklist).toContain("npm run test:e2e:installed:published");
    expect(releaseChecklist).toContain("installed-app smoke");
  });

  it("selects the packaged archive for the current operating system", () => {
    expect(detectReleasePlatform("darwin")).toBe("macos");
    expect(detectReleasePlatform("linux")).toBe("linux");
    expect(() => detectReleasePlatform("win32")).toThrow("Unsupported installed-app smoke platform");
    expect(releaseArchiveName("0.1.0-beta", "linux")).toBe("little-imp-0.1.0-beta-linux.tar.gz");
    expect(releaseArchiveName("0.1.0-beta", "macos")).toBe("little-imp-0.1.0-beta-macos.tar.gz");
    expect(defaultPublishedReleaseBaseUrl("0.1.0-beta")).toBe(
      "https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta"
    );
    expect(() => defaultPublishedReleaseBaseUrl("../0.1.0-beta")).toThrow(
      "Release version contains unsupported characters"
    );
  });

  it("downloads and verifies published release artifacts before running the smoke", async () => {
    const version = "1.2.3-beta";
    const platform = "linux";
    const archiveName = releaseArchiveName(version, platform);
    const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-published-release-"));
    const downloadDir = mkdtempSync(join(tmpdir(), "little-imp-published-download-"));
    const archivePath = join(releaseDir, archiveName);
    const signatureCalls: string[][] = [];
    const signatureRunner: SignatureRunner = (command, args) => {
      signatureCalls.push([command, ...args]);
      return { status: 0, stdout: "", stderr: "" };
    };

    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(archivePath, "published archive bytes\n");
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${sha256(archivePath)}  ${archiveName}\n`);
    writeFileSync(join(releaseDir, `${archiveName}.asc`), "signature\n");

    const result = await downloadPublishedReleaseArtifact({
      version,
      platform,
      releaseBaseUrl: "https://downloads.example.test/releases/v1.2.3-beta",
      downloadDir,
      fetchImpl: fetchFromReleaseDir(releaseDir),
      signatureRunner,
    });

    const downloadedArchivePath = join(downloadDir, archiveName);
    expect(result.archivePath).toBe(downloadedArchivePath);
    expect(result.checksumPath).toBe(`${downloadedArchivePath}.sha256`);
    expect(result.signaturePath).toBe(`${downloadedArchivePath}.asc`);
    expect(result.checksumVerified).toBe(true);
    expect(result.signatureVerified).toBe(true);
    expect(signatureCalls).toEqual([["gpg", "--verify", `${downloadedArchivePath}.asc`, downloadedArchivePath]]);
  });

  it("rejects published release artifacts when the checksum does not match", async () => {
    const version = "1.2.3-beta";
    const platform = "linux";
    const archiveName = releaseArchiveName(version, platform);
    const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-published-release-"));
    const downloadDir = mkdtempSync(join(tmpdir(), "little-imp-published-download-"));

    writeFileSync(join(releaseDir, archiveName), "tampered archive bytes\n");
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${"0".repeat(64)}  ${archiveName}\n`);

    await expect(
      downloadPublishedReleaseArtifact({
        version,
        platform,
        releaseBaseUrl: "https://downloads.example.test/releases/v1.2.3-beta",
        downloadDir,
        fetchImpl: fetchFromReleaseDir(releaseDir),
      })
    ).rejects.toThrow("Checksum mismatch");
  });

  it("fails published release validation when a required detached signature is missing", async () => {
    const version = "1.2.3-beta";
    const platform = "linux";
    const archiveName = releaseArchiveName(version, platform);
    const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-published-release-"));
    const downloadDir = mkdtempSync(join(tmpdir(), "little-imp-published-download-"));
    const archivePath = join(releaseDir, archiveName);
    let signatureCalls = 0;

    writeFileSync(archivePath, "published archive bytes\n");
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${sha256(archivePath)}  ${archiveName}\n`);

    await expect(
      downloadPublishedReleaseArtifact({
        version,
        platform,
        releaseBaseUrl: "https://downloads.example.test/releases/v1.2.3-beta",
        downloadDir,
        fetchImpl: fetchFromReleaseDir(releaseDir),
        requireSignature: true,
        signatureRunner: () => {
          signatureCalls += 1;
          return { status: 0, stdout: "", stderr: "" };
        },
      })
    ).rejects.toThrow("Missing detached signature");
    expect(signatureCalls).toBe(0);
  });

  it("derives restore-safe backup names from daemon backup paths", () => {
    expect(backupNameFromPath("/tmp/littleimp/backups/2026-05-27T08-00-00-000Z")).toBe(
      "2026-05-27T08-00-00-000Z"
    );
    expect(() => backupNameFromPath("/tmp/littleimp/backups/")).toThrow("Backup path did not include a name");
  });

  it("rejects unsafe release archive layouts before extraction", () => {
    expect(
      archiveRootDirectoryNameFromEntries([
        "little-imp-0.1.0-beta-linux/",
        "little-imp-0.1.0-beta-linux/daemon/install.sh",
      ], "linux")
    ).toBe("little-imp-0.1.0-beta-linux");

    expect(() =>
      archiveRootDirectoryNameFromEntries([
        "little-imp-0.1.0-beta-linux/daemon/install.sh",
        "../outside.txt",
      ], "linux")
    ).toThrow("Unsafe archive path");

    expect(() =>
      archiveRootDirectoryNameFromEntries([
        "little-imp-0.1.0-beta-linux/daemon/install.sh",
        "unexpected-root/file.txt",
      ], "linux")
    ).toThrow("exactly one top-level directory");
  });

  it("times out child commands instead of hanging indefinitely", async () => {
    const result = await runCommandCapture(
      process.execPath,
      ["-e", "setTimeout(() => {}, 5000)"],
      { cwd: process.cwd(), env: process.env, timeoutMs: 50 }
    );

    expect(result.timedOut).toBe(true);
    expect(result.status).toBeNull();
  });

  it("covers the MVP installed-app journeys without relying on a development server", () => {
    for (const expected of [
      "POST /bookmarks",
      "GET /search",
      "POST /import",
      "waitForBookmarkUrl",
      "importedBookmarkUrl",
      "GET /export",
      "GET /settings",
      "POST /backup",
      "POST /restore",
      "littleimp update check",
      "data survives upgrade",
      "uninstall without purge",
      "daemon.log",
    ]) {
      expect(smokeRunner).toContain(expected);
    }
  });
});
