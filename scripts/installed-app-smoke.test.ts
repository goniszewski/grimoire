import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  archiveRootDirectoryNameFromEntries,
  backupNameFromPath,
  detectReleasePlatform,
  releaseArchiveName,
  runCommandCapture,
} from "./installed-app-smoke";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
const releaseChecklist = readFileSync("docs/release-checklist.md", "utf8");
const smokeRunner = readFileSync("scripts/installed-app-smoke.ts", "utf8");

describe("installed-app smoke suite", () => {
  it("exposes a repeatable installed-artifact smoke command", () => {
    expect(packageJson.scripts?.["test:e2e:installed"]).toBe(
      "npm run package:release && bun run scripts/installed-app-smoke.ts"
    );
    expect(releaseChecklist).toContain("npm run test:e2e:installed");
    expect(releaseChecklist).toContain("installed-app smoke");
  });

  it("selects the packaged archive for the current operating system", () => {
    expect(detectReleasePlatform("darwin")).toBe("macos");
    expect(detectReleasePlatform("linux")).toBe("linux");
    expect(() => detectReleasePlatform("win32")).toThrow("Unsupported installed-app smoke platform");
    expect(releaseArchiveName("0.1.0-beta", "linux")).toBe("little-imp-0.1.0-beta-linux.tar.gz");
    expect(releaseArchiveName("0.1.0-beta", "macos")).toBe("little-imp-0.1.0-beta-macos.tar.gz");
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
