import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const releaseChecklist = readFileSync("docs/release-checklist.md", "utf8");
const matrixEvidence = readFileSync("docs/installer-matrix-validation.md", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
const linuxMatrixScript = readFileSync("scripts/validate-linux-installer-matrix.sh", "utf8");

const supportedTargets = [
  "macOS 12+ arm64",
  "macOS 12+ x64",
  "Ubuntu 24.04 LTS",
  "Debian 12",
];

const requiredValidationSteps = [
  "clean install",
  "health check",
  "autostart registration",
  "upgrade",
  "uninstall",
  "purge",
];

describe("installer matrix documentation", () => {
  it("names every supported MVP installer target in the release checklist", () => {
    expect(releaseChecklist).toContain("## Supported Installer Matrix");

    for (const target of supportedTargets) {
      expect(releaseChecklist).toContain(target);
    }
  });

  it("records validation evidence and required steps for every matrix target", () => {
    for (const target of supportedTargets) {
      expect(matrixEvidence).toContain(target);
    }

    for (const step of requiredValidationSteps) {
      expect(matrixEvidence.toLowerCase()).toContain(step);
    }
  });

  it("exposes a repeatable Linux systemd-user matrix smoke command", () => {
    expect(packageJson.scripts?.["installer:matrix:linux"]).toBe("bash scripts/validate-linux-installer-matrix.sh");
    expect(linuxMatrixScript).toContain("ubuntu:24.04");
    expect(linuxMatrixScript).toContain("debian:12");
    expect(linuxMatrixScript).toContain("RELEASE_ARCHIVE_NAME");
    expect(linuxMatrixScript).toContain("package.json");
    expect(linuxMatrixScript).toContain("./install.sh --upgrade");
    expect(linuxMatrixScript).toContain("./install.sh --uninstall");
    expect(linuxMatrixScript).toContain("./install.sh --uninstall --purge");
    expect(linuxMatrixScript).toContain("systemctl --user is-enabled littleimpd");
  });
});
