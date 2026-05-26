import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const installerPath = join(projectRoot, "install.sh");

function writeExecutable(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function sha256(path: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function platformName(): "macos" | "linux" {
  return process.platform === "darwin" ? "macos" : "linux";
}

function commandPath(command: string): string {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Could not find ${command}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function createFakeBin(
  options: { gpgMarker?: string; signatureHttpStatus?: number; releaseDirForHttp?: string } = {}
): string {
  const binDir = mkdtempSync(join(tmpdir(), "little-imp-install-bin-"));
  writeExecutable(
    join(binDir, "bun"),
    ["#!/usr/bin/env bash", "echo '1.1.0'", ""].join("\n")
  );

  if (options.gpgMarker) {
    writeExecutable(
      join(binDir, "gpg"),
      ["#!/usr/bin/env bash", `printf '%s\\n' "$*" > "${options.gpgMarker}"`, "exit 0", ""].join("\n")
    );
  }

  if (options.signatureHttpStatus) {
    const realCurl = commandPath("curl");
    writeExecutable(
      join(binDir, "curl"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "args=(\"$@\")",
        'url=""',
        'output=""',
        "wants_status=0",
        'for ((i = 0; i < ${#args[@]}; i++)); do',
        '  case "${args[$i]}" in',
        "    -o)",
        '      output="${args[$((i + 1))]:-}"',
        "      ;;",
        "    -w|--write-out)",
        "      wants_status=1",
        "      ;;",
        "    http://*|https://*|file://*)",
        '      url="${args[$i]}"',
        "      ;;",
        "  esac",
        "done",
        'case "${url}" in',
        "  https://updates.example.test/*)",
        '    file="${url##*/}"',
        '    if [[ "${file}" == *.asc ]]; then',
        "      if (( wants_status )); then",
        `        printf '${options.signatureHttpStatus}'`,
        "        exit 0",
        "      fi",
        "      echo 'signature endpoint failed' >&2",
        "      exit 22",
        "    fi",
        '    if [[ -z "${output}" ]]; then',
        "      echo 'missing -o output path' >&2",
        "      exit 2",
        "    fi",
        `    cp ${JSON.stringify(options.releaseDirForHttp ?? "")}/"\${file}" "\${output}"`,
        "    if (( wants_status )); then printf '200'; fi",
        "    exit 0",
        "    ;;",
        "esac",
        `exec ${JSON.stringify(realCurl)} "$@"`,
        "",
      ].join("\n")
    );
  }

  return binDir;
}

function createReleaseFixture(options: { signature?: boolean } = {}) {
  const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-install-release-"));
  const payloadStage = join(releaseDir, "payload");
  const version = "1.2.3-beta";
  const platform = platformName();
  const archiveRoot = `little-imp-${version}-${platform}`;
  const archiveName = `${archiveRoot}.tar.gz`;
  const archivePath = join(releaseDir, archiveName);
  const markerPath = join(releaseDir, "installer-called.txt");
  const payloadRoot = join(payloadStage, archiveRoot);

  mkdirSync(join(payloadRoot, "daemon"), { recursive: true });
  writeExecutable(
    join(payloadRoot, "daemon", "install.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s\\n" "$*" > "${LITTLEIMP_TEST_INSTALL_MARKER:?}"',
      "",
    ].join("\n")
  );

  const tar = spawnSync("tar", ["-czf", archivePath, "-C", payloadStage, archiveRoot], {
    encoding: "utf8",
  });
  if (tar.status !== 0) {
    throw new Error(tar.stderr);
  }

  const digest = sha256(archivePath);
  writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);
  if (options.signature) {
    writeFileSync(join(releaseDir, `${archiveName}.asc`), "signature\n");
  }

  return {
    archiveName,
    markerPath,
    releaseDir,
    releaseUrl: pathToFileURL(releaseDir).href,
    version,
  };
}

function createUnsafeReleaseFixture() {
  const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-install-release-"));
  const payloadStage = join(releaseDir, "payload");
  const version = "1.2.3-beta";
  const platform = platformName();
  const archiveRoot = `little-imp-${version}-${platform}`;
  const archiveName = `${archiveRoot}.tar.gz`;
  const archivePath = join(releaseDir, archiveName);
  const markerPath = join(releaseDir, "installer-called.txt");

  mkdirSync(payloadStage, { recursive: true });
  writeFileSync(join(releaseDir, "escape.txt"), "outside archive root\n");

  const tar = spawnSync("tar", ["-czf", archivePath, "-C", payloadStage, "../escape.txt"], {
    encoding: "utf8",
  });
  if (tar.status !== 0) {
    throw new Error(tar.stderr);
  }

  const digest = sha256(archivePath);
  writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);

  return {
    archiveName,
    markerPath,
    releaseDir,
    releaseUrl: pathToFileURL(releaseDir).href,
    version,
  };
}

function createSymlinkInstallerFixture() {
  const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-install-release-"));
  const payloadStage = join(releaseDir, "payload");
  const version = "1.2.3-beta";
  const platform = platformName();
  const archiveRoot = `little-imp-${version}-${platform}`;
  const archiveName = `${archiveRoot}.tar.gz`;
  const archivePath = join(releaseDir, archiveName);
  const markerPath = join(releaseDir, "installer-called.txt");
  const payloadRoot = join(payloadStage, archiveRoot);
  const externalInstallerPath = join(releaseDir, "external-install.sh");

  writeExecutable(
    externalInstallerPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "unexpected\\n" > "${LITTLEIMP_TEST_INSTALL_MARKER:?}"',
      "",
    ].join("\n")
  );
  mkdirSync(join(payloadRoot, "daemon"), { recursive: true });
  symlinkSync(externalInstallerPath, join(payloadRoot, "daemon", "install.sh"));

  const tar = spawnSync("tar", ["-czf", archivePath, "-C", payloadStage, archiveRoot], {
    encoding: "utf8",
  });
  if (tar.status !== 0) {
    throw new Error(tar.stderr);
  }

  const digest = sha256(archivePath);
  writeFileSync(join(releaseDir, `${archiveName}.sha256`), `${digest}  ${archiveName}\n`);

  return {
    archiveName,
    markerPath,
    releaseDir,
    releaseUrl: pathToFileURL(releaseDir).href,
    version,
  };
}

function runInstaller(fixture: ReturnType<typeof createReleaseFixture>, args: string[] = [], extraEnv = {}) {
  const result = spawnSync("bash", [installerPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${createFakeBin()}:${process.env.PATH ?? ""}`,
      LITTLEIMP_RELEASE_BASE_URL: fixture.releaseUrl,
      LITTLEIMP_TEST_INSTALL_MARKER: fixture.markerPath,
      LITTLEIMP_VERSION: fixture.version,
      ...extraEnv,
    },
  });

  return result;
}

describe("one-command release installer", () => {
  it("downloads the platform archive, verifies its checksum, and runs the native installer", () => {
    const fixture = createReleaseFixture();

    const result = runInstaller(fixture, ["--upgrade"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Checksum verified: ${fixture.archiveName}`);
    expect(result.stdout).toContain("No detached signature found; checksum verified only.");
    expect(readFileSync(fixture.markerPath, "utf8").trim()).toBe("--upgrade");
  });

  it("does not run the native installer when archive checksum verification fails", () => {
    const fixture = createReleaseFixture();
    writeFileSync(
      join(fixture.releaseDir, `${fixture.archiveName}.sha256`),
      `${"0".repeat(64)}  ${fixture.archiveName}\n`
    );

    const result = runInstaller(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Checksum mismatch for ${fixture.archiveName}`);
    expect(existsSync(fixture.markerPath)).toBe(false);
  });

  it("does not extract archives containing paths outside the release root", () => {
    const fixture = createUnsafeReleaseFixture();

    const result = runInstaller(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsafe archive path: ../escape.txt");
    expect(existsSync(fixture.markerPath)).toBe(false);
  });

  it("rejects unsafe release version values before downloading artifacts", () => {
    const fixture = createReleaseFixture();

    const result = runInstaller(fixture, [], {
      LITTLEIMP_VERSION: "../1.2.3",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Release version contains unsupported characters: ../1.2.3");
    expect(result.stdout).not.toContain("Downloading");
    expect(existsSync(fixture.markerPath)).toBe(false);
  });

  it("does not run a native installer path that is a symlink", () => {
    const fixture = createSymlinkInstallerFixture();

    const result = runInstaller(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Archive contains unsupported entry type 'l'");
    expect(existsSync(fixture.markerPath)).toBe(false);
  });

  it("does not silently ignore HTTP errors when checking for a detached signature", () => {
    const fixture = createReleaseFixture();
    const fakeBin = createFakeBin({ releaseDirForHttp: fixture.releaseDir, signatureHttpStatus: 500 });

    const result = runInstaller(fixture, [], {
      LITTLEIMP_RELEASE_BASE_URL: `https://updates.example.test/${fixture.version}`,
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not download detached signature");
    expect(result.stdout).not.toContain("No detached signature found");
    expect(existsSync(fixture.markerPath)).toBe(false);
  });

  it("verifies a detached signature when the release publishes one", () => {
    const fixture = createReleaseFixture({ signature: true });
    const gpgMarker = join(fixture.releaseDir, "gpg-called.txt");
    const fakeBin = createFakeBin({ gpgMarker });

    const result = runInstaller(fixture, [], {
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Signature verified: ${fixture.archiveName}.asc`);
    expect(readFileSync(gpgMarker, "utf8")).toContain("--verify");
    expect(readFileSync(gpgMarker, "utf8")).toContain(`${fixture.archiveName}.asc`);
  });
});
