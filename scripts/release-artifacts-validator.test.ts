import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256File } from "./release-packager";
import { validateReleaseArtifacts } from "./release-artifacts-validator";

function createReleaseDir(): string {
  return mkdtempSync(join(tmpdir(), "little-imp-release-validation-"));
}

describe("release artifact validator", () => {
  it("validates archive checksums listed in the release manifest", () => {
    const releaseDir = createReleaseDir();
    const archiveName = "little-imp-1.2.3-beta-linux.tar.gz";
    const archivePath = join(releaseDir, archiveName);
    writeFileSync(archivePath, "archive bytes\n");
    const digest = sha256File(archivePath);
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
    writeFileSync(
      join(releaseDir, "release-manifest.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          name: "little-imp",
          version: "1.2.3-beta",
          generatedAt: "2026-05-26T00:00:00.000Z",
          signing: {
            detachedSignatureExtension: ".asc",
            requiredBeforePublication: true,
            instructions: "Sign before publication.",
          },
          artifacts: [
            {
              platform: "linux",
              archive: archiveName,
              checksum: `${archiveName}.sha256`,
              sha256: digest,
              signature: `${archiveName}.asc`,
            },
          ],
        },
        null,
        2
      )
    );

    expect(validateReleaseArtifacts({ releaseDir, requireSignatures: false })).toEqual({
      ok: true,
      errors: [],
      checkedArtifacts: [archiveName],
    });
  });

  it("can enforce detached signatures before publication", () => {
    const releaseDir = createReleaseDir();
    const archiveName = "little-imp-1.2.3-beta-linux.tar.gz";
    const archivePath = join(releaseDir, archiveName);
    writeFileSync(archivePath, "archive bytes\n");
    const digest = sha256File(archivePath);
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
    writeFileSync(
      join(releaseDir, "release-manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "little-imp",
        version: "1.2.3-beta",
        generatedAt: "2026-05-26T00:00:00.000Z",
        signing: {
          detachedSignatureExtension: ".asc",
          requiredBeforePublication: true,
          instructions: "Sign before publication.",
        },
        artifacts: [
          {
            platform: "linux",
            archive: archiveName,
            checksum: `${archiveName}.sha256`,
            sha256: digest,
            signature: `${archiveName}.asc`,
          },
        ],
      })
    );

    const result = validateReleaseArtifacts({ releaseDir, requireSignatures: true });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([`Missing signature: ${archiveName}.asc`]);

    writeFileSync(join(releaseDir, `${archiveName}.asc`), "signature\n");
    expect(validateReleaseArtifacts({ releaseDir, requireSignatures: true }).ok).toBe(true);
  });

  it("does not accept a signature directory as a detached signature", () => {
    const releaseDir = createReleaseDir();
    const archiveName = "little-imp-1.2.3-beta-linux.tar.gz";
    const archivePath = join(releaseDir, archiveName);
    writeFileSync(archivePath, "archive bytes\n");
    const digest = sha256File(archivePath);
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
    mkdirSync(join(releaseDir, `${archiveName}.asc`));
    writeFileSync(
      join(releaseDir, "release-manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "little-imp",
        version: "1.2.3-beta",
        generatedAt: "2026-05-26T00:00:00.000Z",
        signing: {
          detachedSignatureExtension: ".asc",
          requiredBeforePublication: true,
          instructions: "Sign before publication.",
        },
        artifacts: [
          {
            platform: "linux",
            archive: archiveName,
            checksum: `${archiveName}.sha256`,
            sha256: digest,
            signature: `${archiveName}.asc`,
          },
        ],
      })
    );

    expect(validateReleaseArtifacts({ releaseDir, requireSignatures: true }).errors).toEqual([
      `Missing signature: ${archiveName}.asc`,
    ]);
  });

  it("reports checksum drift", () => {
    const releaseDir = createReleaseDir();
    const archiveName = "little-imp-1.2.3-beta-linux.tar.gz";
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(join(releaseDir, archiveName), "changed archive bytes\n");
    writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${"0".repeat(64)}  ${archiveName}\n`);
    writeFileSync(
      join(releaseDir, "release-manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "little-imp",
        version: "1.2.3-beta",
        generatedAt: "2026-05-26T00:00:00.000Z",
        signing: {
          detachedSignatureExtension: ".asc",
          requiredBeforePublication: true,
          instructions: "Sign before publication.",
        },
        artifacts: [
          {
            platform: "linux",
            archive: archiveName,
            checksum: `${archiveName}.sha256`,
            sha256: "0".repeat(64),
            signature: `${archiveName}.asc`,
          },
        ],
      })
    );

    const result = validateReleaseArtifacts({ releaseDir, requireSignatures: false });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(`Checksum mismatch for ${archiveName}`);
  });

  it("rejects manifests that do not contain any artifacts", () => {
    const releaseDir = createReleaseDir();
    writeFileSync(
      join(releaseDir, "release-manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "little-imp",
        version: "1.2.3-beta",
        generatedAt: "2026-05-26T00:00:00.000Z",
        signing: {
          detachedSignatureExtension: ".asc",
          requiredBeforePublication: true,
          instructions: "Sign before publication.",
        },
        artifacts: [],
      })
    );

    expect(validateReleaseArtifacts({ releaseDir })).toEqual({
      ok: false,
      errors: ["Release manifest does not list any artifacts"],
      checkedArtifacts: [],
    });
  });

  it("rejects artifact paths that escape the release directory", () => {
    const releaseDir = createReleaseDir();
    writeFileSync(
      join(releaseDir, "release-manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "little-imp",
        version: "1.2.3-beta",
        generatedAt: "2026-05-26T00:00:00.000Z",
        signing: {
          detachedSignatureExtension: ".asc",
          requiredBeforePublication: true,
          instructions: "Sign before publication.",
        },
        artifacts: [
          {
            platform: "linux",
            archive: "../little-imp-1.2.3-beta-linux.tar.gz",
            checksum: "../little-imp-1.2.3-beta-linux.tar.gz.sha256",
            sha256: "0".repeat(64),
            signature: "../little-imp-1.2.3-beta-linux.tar.gz.asc",
          },
        ],
      })
    );

    const result = validateReleaseArtifacts({ releaseDir });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Invalid artifact archive path: ../little-imp-1.2.3-beta-linux.tar.gz");
  });
});
