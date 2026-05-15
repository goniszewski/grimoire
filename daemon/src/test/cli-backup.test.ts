import { describe, it, expect } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runLittleImpCli } from "../cli.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function makeCliHarness(response: unknown, status = 200) {
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
        env: {},
        fetch: fetchImpl as typeof fetch,
        stdout: (line) => stdout.push(line),
        stderr: (line) => stderr.push(line),
      }),
  };
}

async function sha256File(path: string): Promise<string> {
  const data = await Bun.file(path).arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeValidBackupDir(): Promise<string> {
  const dir = join(tmpdir(), `littleimp-cli-verify-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, "data"), { recursive: true });
  writeFileSync(join(dir, "snapshot.db"), "sqlite data");
  writeFileSync(join(dir, "data", "settings.json"), JSON.stringify({ backup: true }));
  const snapshotHash = await sha256File(join(dir, "snapshot.db"));
  const settingsHash = await sha256File(join(dir, "data", "settings.json"));
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        backup_format_version: 1,
        app_version: "0.1.0-beta",
        created_at: "2026-05-15T12:00:00.000Z",
        db_size_bytes: 11,
        bookmark_count: 3,
        database: { filename: "snapshot.db", schema_version: "0009", size_bytes: 11 },
        settings: {
          included: true,
          filename: "data/settings.json",
          secrets_policy: "secrets omitted; current local secrets are preserved on restore",
        },
        checksum_algorithm: "sha256",
        included_files: ["snapshot.db", "data/settings.json"],
        compatibility: { min_app_version: "0.1.0-beta", restore_supported: true },
      },
      null,
      2
    )
  );
  writeFileSync(
    join(dir, "checksums.sha256"),
    `${snapshotHash}  snapshot.db\n${settingsHash}  data/settings.json\n`
  );
  return dir;
}

describe("littleimp backup CLI", () => {
  it("creates a backup through the daemon API", async () => {
    const harness = makeCliHarness({
      path: "/tmp/littleimp/backups/2026-05-15T12-00-00-000Z",
      size_bytes: 4096,
      bookmark_count: 7,
      created_at: "2026-05-15T12:00:00.000Z",
    }, 201);

    const code = await harness.run(["backup", "create", "--json"]);

    expect(code).toBe(0);
    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0].url).toBe("http://127.0.0.1:3210/backup");
    expect(harness.calls[0].init?.method).toBe("POST");
    expect(JSON.parse(harness.stdout[0])).toEqual({
      path: "/tmp/littleimp/backups/2026-05-15T12-00-00-000Z",
      size_bytes: 4096,
      bookmark_count: 7,
      created_at: "2026-05-15T12:00:00.000Z",
    });
  });

  it("lists local and remote backups when requested", async () => {
    const harness = makeCliHarness({
      data: [
        {
          name: "local-snapshot",
          path: "/tmp/littleimp/backups/local-snapshot",
          size_bytes: 100,
          bookmark_count: 2,
          created_at: "2026-05-15T12:00:00.000Z",
          source: "local",
        },
      ],
    });

    const code = await harness.run(["backup", "list", "--include-remote", "--json"]);

    expect(code).toBe(0);
    expect(harness.calls[0].url).toBe("http://127.0.0.1:3210/backup/list?include_remote=true");
    expect(JSON.parse(harness.stdout[0]).data[0].name).toBe("local-snapshot");
  });

  it("requires explicit confirmation before restore", async () => {
    const harness = makeCliHarness({ restored_at: "never" });

    const code = await harness.run(["backup", "restore", "local-snapshot"]);

    expect(code).toBe(2);
    expect(harness.calls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("--yes");
  });

  it("restores a local backup through the daemon API when confirmed", async () => {
    const harness = makeCliHarness({
      restored_at: "2026-05-15T12:00:00.000Z",
      bookmark_count: 7,
      checksum_verified: true,
      rollback_path: "/tmp/rollback",
      restart_required: true,
    });

    const code = await harness.run(["backup", "restore", "local-snapshot", "--yes", "--json"]);

    expect(code).toBe(0);
    expect(harness.calls[0].url).toBe("http://127.0.0.1:3210/restore");
    expect(harness.calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(harness.calls[0].init?.body))).toEqual({ name: "local-snapshot" });
    expect(JSON.parse(harness.stdout[0]).restart_required).toBe(true);
  });

  it("restores a remote backup key through the daemon API when confirmed", async () => {
    const harness = makeCliHarness({
      restored_at: "2026-05-15T12:00:00.000Z",
      bookmark_count: 7,
      checksum_verified: true,
      rollback_path: "/tmp/rollback",
      restart_required: true,
    });

    const code = await harness.run([
      "backup",
      "restore",
      "--remote-key",
      "little-imp-backups/snapshot/snapshot.db",
      "--yes",
      "--json",
    ]);

    expect(code).toBe(0);
    expect(JSON.parse(String(harness.calls[0].init?.body))).toEqual({
      source: "remote",
      key: "little-imp-backups/snapshot/snapshot.db",
    });
  });

  it("preserves equals signs in inline flag values", async () => {
    const harness = makeCliHarness({
      restored_at: "2026-05-15T12:00:00.000Z",
      bookmark_count: 7,
      checksum_verified: true,
      rollback_path: "/tmp/rollback",
      restart_required: true,
    });

    const code = await harness.run([
      "backup",
      "restore",
      "--remote-key=little-imp-backups/provider=manual/snapshot.db",
      "--yes",
      "--json",
    ]);

    expect(code).toBe(0);
    expect(JSON.parse(String(harness.calls[0].init?.body))).toEqual({
      source: "remote",
      key: "little-imp-backups/provider=manual/snapshot.db",
    });
  });

  it("rejects unsupported flags instead of silently ignoring them", async () => {
    const harness = makeCliHarness({
      path: "/tmp/littleimp/backups/2026-05-15T12-00-00-000Z",
      size_bytes: 4096,
      bookmark_count: 7,
      created_at: "2026-05-15T12:00:00.000Z",
    }, 201);

    const code = await harness.run(["backup", "create", "--include-remote"]);

    expect(code).toBe(2);
    expect(harness.calls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("Unknown option");
  });

  it("rejects unexpected positional arguments", async () => {
    const harness = makeCliHarness({
      path: "/tmp/littleimp/backups/2026-05-15T12-00-00-000Z",
      size_bytes: 4096,
      bookmark_count: 7,
      created_at: "2026-05-15T12:00:00.000Z",
    }, 201);

    const code = await harness.run(["backup", "create", "extra"]);

    expect(code).toBe(2);
    expect(harness.calls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("Unexpected argument");
  });

  it("rejects multiple local restore names", async () => {
    const harness = makeCliHarness({
      restored_at: "2026-05-15T12:00:00.000Z",
      bookmark_count: 7,
      checksum_verified: true,
      rollback_path: "/tmp/rollback",
      restart_required: true,
    });

    const code = await harness.run(["backup", "restore", "one", "two", "--yes"]);

    expect(code).toBe(2);
    expect(harness.calls).toHaveLength(0);
    expect(harness.stderr.join("\n")).toContain("Unexpected argument");
  });

  it("falls back to the default daemon URL when the environment override is empty", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const calls: FetchCall[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ data: [] }), {
        headers: { "content-type": "application/json" },
      });
    };

    const code = await runLittleImpCli(["backup", "list", "--json"], {
      env: { LITTLEIMP_DAEMON_URL: "" },
      fetch: fetchImpl as typeof fetch,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    });

    expect(code).toBe(0);
    expect(stderr).toHaveLength(0);
    expect(calls[0].url).toBe("http://127.0.0.1:3210/backup/list");
  });

  it("verifies a local snapshot directory without restoring it", async () => {
    const dir = await makeValidBackupDir();
    try {
      const harness = makeCliHarness({});

      const code = await harness.run(["backup", "verify", "--file", dir, "--json"]);

      expect(code).toBe(0);
      expect(harness.calls).toHaveLength(0);
      expect(JSON.parse(harness.stdout[0])).toEqual({
        ok: true,
        path: dir,
        checksum_verified: true,
        verified_files: ["snapshot.db", "data/settings.json"],
        bookmark_count: 3,
        created_at: "2026-05-15T12:00:00.000Z",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns a verification error for a corrupted snapshot", async () => {
    const dir = await makeValidBackupDir();
    writeFileSync(join(dir, "snapshot.db"), "corrupted");
    try {
      const harness = makeCliHarness({});

      const code = await harness.run(["backup", "verify", "--file", dir]);

      expect(code).toBe(1);
      expect(harness.stderr.join("\n")).toContain("Checksum mismatch");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
