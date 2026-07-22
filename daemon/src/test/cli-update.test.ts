import { describe, expect, it } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { spawnSync } from "child_process";
import { runLittleImpCli } from "../cli.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

type SpawnCall = {
  command: string;
  args: string[];
};

function makeUpdateHarness(response: unknown, status = 200, env: Record<string, string | undefined> = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls: FetchCall[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
  };

  return {
    calls,
    stdout,
    stderr,
    run: (args: string[]) =>
      runLittleImpCli(args, {
        env,
        fetch: fetchImpl as typeof fetch,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      }),
  };
}

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

function createUpgradeArchiveFixture(options: { badChecksum?: boolean; signature?: boolean; version?: string } = {}) {
  const releaseDir = mkdtempSync(join(tmpdir(), "little-imp-cli-upgrade-release-"));
  const payloadStage = join(releaseDir, "payload");
  const version = options.version ?? "0.2.0-beta";
  const platform = platformName();
  const archiveRoot = `little-imp-${version}-${platform}`;
  const archiveName = `${archiveRoot}.tar.gz`;
  const archivePath = join(releaseDir, archiveName);
  const checksumPath = `${archivePath}.sha256`;
  const signaturePath = `${archivePath}.asc`;
  const payloadRoot = join(payloadStage, archiveRoot);

  mkdirSync(payloadRoot, { recursive: true });
  writeFileSync(join(payloadRoot, "VERSION"), `${version}\n`);
  writeExecutable(
    join(payloadRoot, "daemon", "install.sh"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "# The real test injects spawnSync, so this should not execute.",
      "exit 99",
      "",
    ].join("\n")
  );

  const tar = spawnSync("tar", ["-czf", archivePath, "-C", payloadStage, archiveRoot], {
    encoding: "utf8",
  });
  if (tar.status !== 0) {
    throw new Error(tar.stderr);
  }

  const digest = options.badChecksum ? "0".repeat(64) : sha256(archivePath);
  writeFileSync(checksumPath, `${digest}  ${archiveName}\n`);
  if (options.signature) {
    writeFileSync(signaturePath, "invalid signature\n");
  }

  return {
    archiveName,
    archivePath,
    checksumPath,
    signaturePath,
    releaseDir,
    version,
  };
}

function makeUpgradeHarness(
  healthVersion = "0.2.0-beta",
  runCommand?: (command: string, args: string[]) => { status: number; stderr?: string }
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const fetchCalls: FetchCall[] = [];
  const spawnCalls: SpawnCall[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify({ status: "ok", version: healthVersion }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const spawnImpl = (command: string, args: string[]) => {
    spawnCalls.push({ command, args });
    const result = runCommand?.(command, args);
    if (result) {
      return {
        status: result.status,
        signal: null,
        output: ["", "", result.stderr ?? ""],
        pid: 123,
        stdout: "",
        stderr: result.stderr ?? "",
      };
    }
    return {
      status: 0,
      signal: null,
      output: ["", "", ""],
      pid: 123,
      stdout: "",
      stderr: "",
    };
  };

  return {
    fetchCalls,
    spawnCalls,
    stdout,
    stderr,
    run: (args: string[]) =>
      runLittleImpCli(args, {
        env: {},
        fetch: fetchImpl as typeof fetch,
        spawnSync: spawnImpl,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      }),
  };
}

describe("littleimp update CLI", () => {
  it("reports the newest compatible release from the configured source", async () => {
    const harness = makeUpdateHarness([
      {
        tag_name: "v1.1.0-beta.1",
        name: "Grimoire 1.1.0 beta 1",
        draft: false,
        prerelease: true,
        published_at: "2026-05-18T12:00:00Z",
        html_url: "https://github.com/goniszewski/grimoire/releases/tag/v1.1.0-beta.1",
      },
      {
        tag_name: "v1.0.1",
        name: "Grimoire 1.0.1",
        draft: false,
        prerelease: false,
        published_at: "2026-05-17T12:00:00Z",
        html_url: "https://github.com/goniszewski/grimoire/releases/tag/v1.0.1",
      },
    ]);

    const code = await harness.run([
      "update",
      "check",
      "--source",
      "https://updates.example.test/releases",
      "--json",
    ]);

    expect(code).toBe(0);
    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0].url).toBe("https://updates.example.test/releases");
    expect(harness.calls[0].init?.headers).toEqual({
      accept: "application/vnd.github+json",
      "user-agent": "littleimp-update-check/1.0.0",
    });
    expect(JSON.parse(harness.stdout[0])).toEqual({
      current_version: "1.0.0",
      update_available: true,
      source: "https://updates.example.test/releases",
      channel: "stable",
      latest: {
        version: "1.0.1",
        tag: "v1.0.1",
        name: "Grimoire 1.0.1",
        prerelease: false,
        published_at: "2026-05-17T12:00:00Z",
        url: "https://github.com/goniszewski/grimoire/releases/tag/v1.0.1",
      },
    });
  });

  it("ignores prereleases on the stable channel", async () => {
    const harness = makeUpdateHarness([
      {
        tag_name: "v0.3.0-beta.1",
        name: "Little Imp 0.3.0 beta 1",
        draft: false,
        prerelease: true,
        published_at: "2026-05-18T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.3.0-beta.1",
      },
      {
        tag_name: "v0.2.0",
        name: "Little Imp 0.2.0",
        draft: false,
        prerelease: false,
        published_at: "2026-05-17T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0",
      },
    ]);

    const code = await harness.run([
      "update",
      "check",
      "--channel",
      "stable",
      "--source",
      "https://updates.example.test/releases",
      "--json",
    ]);

    expect(code).toBe(0);
    expect(JSON.parse(harness.stdout[0]).latest).toMatchObject({
      version: "0.2.0",
      prerelease: false,
    });
  });

  it("ignores malformed release tags when selecting the newest update", async () => {
    const harness = makeUpdateHarness([
      {
        tag_name: "v9..0",
        name: "Invalid release tag",
        draft: false,
        prerelease: false,
        published_at: "2026-05-19T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v9..0",
      },
      {
        tag_name: "v0.2.0",
        name: "Little Imp 0.2.0",
        draft: false,
        prerelease: false,
        published_at: "2026-05-18T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0",
      },
    ]);

    const code = await harness.run(["update", "check", "--source", "https://updates.example.test/releases", "--json"]);

    expect(code).toBe(0);
    expect(JSON.parse(harness.stdout[0]).latest).toMatchObject({
      version: "0.2.0",
      tag: "v0.2.0",
    });
  });

  it("reports up-to-date when no compatible release is newer", async () => {
    const harness = makeUpdateHarness([
      {
        tag_name: "v0.1.0-beta",
        name: "Little Imp 0.1.0 beta",
        draft: false,
        prerelease: true,
        published_at: "2026-05-15T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.1.0-beta",
      },
    ]);

    const code = await harness.run(["update", "check", "--source", "https://updates.example.test/releases"]);

    expect(code).toBe(0);
    expect(harness.stdout.join("\n")).toContain("Grimoire is up to date");
    expect(harness.stdout.join("\n")).toContain("1.0.0");
  });

  it("uses LITTLEIMP_UPDATE_SOURCE when no source flag is provided", async () => {
    const harness = makeUpdateHarness([], 200, {
      LITTLEIMP_UPDATE_SOURCE: "https://mirror.example.test/releases",
    });

    const code = await harness.run(["update", "check", "--json"]);

    expect(code).toBe(0);
    expect(harness.calls[0].url).toBe("https://mirror.example.test/releases");
    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      source: "https://mirror.example.test/releases",
      update_available: false,
    });
  });

  it("rejects unexpected positional arguments with an update-specific error", async () => {
    const harness = makeUpdateHarness([]);

    const code = await harness.run(["update", "check", "extra"]);

    expect(code).toBe(2);
    expect(harness.calls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("Unexpected argument for update check");
  });

  it("upgrades from a verified local release archive and checks the restarted daemon version", async () => {
    const fixture = createUpgradeArchiveFixture();
    const harness = makeUpgradeHarness(fixture.version);

    const code = await harness.run([
      "update",
      "install",
      "--archive",
      fixture.archivePath,
      "--checksum",
      fixture.checksumPath,
      "--allow-unsigned",
      "--json",
    ]);

    expect(code).toBe(0);
    expect(harness.spawnCalls).toHaveLength(1);
    expect(harness.spawnCalls[0].command).toBe("bash");
    expect(harness.spawnCalls[0].args[0]).toEndWith("/daemon/install.sh");
    expect(harness.spawnCalls[0].args).toContain("--upgrade");
    expect(harness.fetchCalls[0].url).toBe("http://127.0.0.1:3210/health");
    expect(JSON.parse(harness.stdout[0])).toMatchObject({
      current_version: "1.0.0",
      upgraded_version: fixture.version,
      archive: fixture.archivePath,
      checksum_verified: true,
      signature_verified: false,
      restart_status: "healthy",
      health_version: fixture.version,
    });
  });

  it("refuses to upgrade a local release archive when checksum verification fails", async () => {
    const fixture = createUpgradeArchiveFixture({ badChecksum: true });
    const harness = makeUpgradeHarness(fixture.version);

    const code = await harness.run([
      "update",
      "install",
      "--archive",
      fixture.archivePath,
      "--checksum",
      fixture.checksumPath,
    ]);

    expect(code).toBe(1);
    expect(harness.spawnCalls).toHaveLength(0);
    expect(harness.fetchCalls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("Checksum mismatch");
  });

  it("refuses to upgrade a local release archive when detached signature verification fails", async () => {
    const fixture = createUpgradeArchiveFixture({ signature: true });
    const harness = makeUpgradeHarness(fixture.version, (command) =>
      command === "gpg" ? { status: 1, stderr: "bad signature" } : { status: 0 }
    );

    const code = await harness.run([
      "update",
      "install",
      "--archive",
      fixture.archivePath,
      "--checksum",
      fixture.checksumPath,
      "--signature",
      fixture.signaturePath,
    ]);

    expect(code).toBe(1);
    expect(harness.spawnCalls).toHaveLength(1);
    expect(harness.spawnCalls[0].command).toBe("gpg");
    expect(harness.fetchCalls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("Signature verification failed");
  });

  it("downloads a selected release artifact before running the packaged upgrade", async () => {
    const fixture = createUpgradeArchiveFixture({ signature: true });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const fetchCalls: FetchCall[] = [];
    const spawnCalls: SpawnCall[] = [];
    const baseUrl = "https://updates.example.test/little-imp/v0.2.0-beta";
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      const rawUrl = String(url);
      fetchCalls.push({ url: rawUrl, init });
      if (rawUrl.endsWith(fixture.archiveName)) {
        return new Response(Bun.file(fixture.archivePath));
      }
      if (rawUrl.endsWith(`${fixture.archiveName}.sha256`)) {
        return new Response(Bun.file(fixture.checksumPath));
      }
      if (rawUrl.endsWith(`${fixture.archiveName}.asc`)) {
        return new Response(Bun.file(fixture.signaturePath));
      }
      if (rawUrl === "http://127.0.0.1:3210/health") {
        return new Response(JSON.stringify({ status: "ok", version: fixture.version }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("unexpected", { status: 500 });
    };
    const spawnImpl = (command: string, args: string[]) => {
      spawnCalls.push({ command, args });
      return {
        status: 0,
        signal: null,
        output: ["", "", ""],
        pid: 123,
        stdout: "",
        stderr: command === "gpg" ? "gpg: Good signature from Test Key\nPrimary key fingerprint: AAAABBBBCCCCDDDDEEEEFFFF0000111122223333" : "",
      };
    };

    const code = await runLittleImpCli([
      "update",
      "install",
      "--version",
      fixture.version,
      "--release-base-url",
      baseUrl,
      "--json",
    ], {
      env: {},
      fetch: fetchImpl as typeof fetch,
      spawnSync: spawnImpl,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(fetchCalls.map((call) => call.url)).toEqual([
      `${baseUrl}/${fixture.archiveName}`,
      `${baseUrl}/${fixture.archiveName}.sha256`,
      `${baseUrl}/${fixture.archiveName}.asc`,
      "http://127.0.0.1:3210/health",
    ]);
    expect(spawnCalls.some((call) => call.command === "gpg")).toBe(true);
    expect(JSON.parse(stdout[0])).toMatchObject({
      upgraded_version: fixture.version,
      checksum_verified: true,
      signature_verified: true,
      restart_status: "healthy",
    });
    expect(JSON.parse(stdout[0]).archive).toEndWith(fixture.archiveName);
  });

  it("refuses remote upgrades when the detached signature is missing", async () => {
    const fixture = createUpgradeArchiveFixture();
    const stderr: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      const rawUrl = String(url);
      if (rawUrl.endsWith(fixture.archiveName)) return new Response(Bun.file(fixture.archivePath));
      if (rawUrl.endsWith(`${fixture.archiveName}.sha256`)) return new Response(Bun.file(fixture.checksumPath));
      if (rawUrl.endsWith(`${fixture.archiveName}.asc`)) return new Response("missing", { status: 404 });
      return new Response("unexpected", { status: 500 });
    };

    const code = await runLittleImpCli([
      "update",
      "install",
      "--version",
      fixture.version,
      "--release-base-url",
      `https://updates.example.test/little-imp/v${fixture.version}`,
    ], {
      env: {},
      fetch: fetchImpl as typeof fetch,
      spawnSync: () => ({ status: 0, signal: null, output: ["", "", ""], pid: 1, stdout: "", stderr: "" }),
      stdout: () => undefined,
      stderr: (line) => stderr.push(line),
    });

    expect(code).toBe(1);
    expect(stderr.join("\n")).toContain("Detached signature");
  });

  it("checks the release source before downloading the latest compatible upgrade when no version is provided", async () => {
    const fixture = createUpgradeArchiveFixture({ version: "1.0.1", signature: true });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const fetchCalls: FetchCall[] = [];
    const spawnCalls: SpawnCall[] = [];
    const sourceUrl = "https://updates.example.test/releases";
    const tagUrl = `https://updates.example.test/little-imp/releases/tag/v${fixture.version}`;
    const baseUrl = `https://updates.example.test/little-imp/releases/download/v${fixture.version}`;
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      const rawUrl = String(url);
      fetchCalls.push({ url: rawUrl, init });
      if (rawUrl === sourceUrl) {
        return new Response(JSON.stringify([
          {
            tag_name: `v${fixture.version}`,
            name: `Little Imp ${fixture.version}`,
            draft: false,
            prerelease: false,
            published_at: "2026-05-26T12:00:00Z",
            html_url: tagUrl,
          },
        ]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (rawUrl.endsWith(fixture.archiveName)) {
        return new Response(Bun.file(fixture.archivePath));
      }
      if (rawUrl.endsWith(`${fixture.archiveName}.sha256`)) {
        return new Response(Bun.file(fixture.checksumPath));
      }
      if (rawUrl.endsWith(`${fixture.archiveName}.asc`)) {
        return new Response(Bun.file(fixture.signaturePath));
      }
      if (rawUrl === "http://127.0.0.1:3210/health") {
        return new Response(JSON.stringify({ status: "ok", version: fixture.version }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("unexpected", { status: 500 });
    };
    const spawnImpl = (command: string, args: string[]) => {
      spawnCalls.push({ command, args });
      return {
        status: 0,
        signal: null,
        output: ["", "", ""],
        pid: 123,
        stdout: "",
        stderr: command === "gpg" ? "gpg: Good signature\nPrimary key fingerprint: AAAABBBBCCCCDDDDEEEEFFFF0000111122223333" : "",
      };
    };

    const code = await runLittleImpCli([
      "update",
      "install",
      "--source",
      sourceUrl,
      "--json",
    ], {
      env: {},
      fetch: fetchImpl as typeof fetch,
      spawnSync: spawnImpl,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(fetchCalls.map((call) => call.url)).toEqual([
      sourceUrl,
      `${baseUrl}/${fixture.archiveName}`,
      `${baseUrl}/${fixture.archiveName}.sha256`,
      `${baseUrl}/${fixture.archiveName}.asc`,
      "http://127.0.0.1:3210/health",
    ]);
    expect(spawnCalls.some((call) => call.command === "gpg")).toBe(true);
    expect(JSON.parse(stdout[0])).toMatchObject({
      upgraded_version: fixture.version,
      signature_verified: true,
      restart_status: "healthy",
    });
  });
});
