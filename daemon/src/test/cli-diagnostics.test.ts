import { describe, expect, it } from "bun:test";
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

describe("littleimp diagnostics CLI", () => {
  const response = {
    data: {
      generated_at: "2026-05-27T08:00:00.000Z",
      version: "0.1.0-beta",
      platform: { os: "darwin", arch: "arm64", node_env: "production", host: "127.0.0.1", port: 3210 },
      install: { mode: "native" },
      paths: {
        data_dir: "/Users/me/.local/share/littleimp",
        database_path: "/Users/me/.local/share/littleimp/littleimp.db",
        config_file: "/Users/me/.config/littleimp/config.json",
        backup_dir: "/Users/me/.local/share/littleimp/backups",
        log_files: [
          { label: "daemon stdout", path: "/Users/me/.local/share/littleimp/logs/daemon.log" },
          { label: "daemon stderr", path: "/Users/me/.local/share/littleimp/logs/daemon.error.log" },
        ],
      },
      daemon: { status: "ok", uptime_ms: 1000, queue_size: 2, queue: { pending: 2, running: 0, done: 0, failed: 0 } },
      providers: {
        llm: { provider: "none", configured: false, model: null, base_url: null },
        embeddings: { provider: "openai", configured: false, model: "text-embedding-3-small", base_url: "https://api.openai.com/v1" },
      },
      backup: {
        local: { path: "/Users/me/.local/share/littleimp/backups", is_custom: false, writable: true },
        schedule: { enabled: false, cron: "0 3 * * *", retention_count: 7, next_run_at: null },
        s3: { configured: false, endpoint: "", bucket: "", region: "us-east-1", prefix: "little-imp-backups/" },
      },
      search: { keyword: true, semantic: false, hybrid: false },
      omitted_secrets: ["AI provider API keys"],
    },
  };

  it("prints diagnostics JSON from the daemon", async () => {
    const harness = makeCliHarness(response);

    const code = await harness.run(["diagnostics", "--json"]);

    expect(code).toBe(0);
    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0].url).toBe("http://127.0.0.1:3210/diagnostics");
    expect(JSON.parse(harness.stdout[0])).toEqual(response);
  });

  it("prints a readable diagnostics summary", async () => {
    const harness = makeCliHarness(response);

    const code = await harness.run(["diagnostics"]);

    expect(code).toBe(0);
    expect(harness.stdout.join("\n")).toContain("Little Imp 0.1.0-beta diagnostics");
    expect(harness.stdout.join("\n")).toContain("Install: native on darwin/arm64");
    expect(harness.stdout.join("\n")).toContain("Queue: 2 pending");
    expect(harness.stdout.join("\n")).toContain("Logs: /Users/me/.local/share/littleimp/logs/daemon.log");
  });
});
