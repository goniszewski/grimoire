import { describe, expect, it } from "bun:test";
import { runLittleImpCli } from "../cli.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
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

describe("littleimp update CLI", () => {
  it("reports the newest compatible release from the configured source", async () => {
    const harness = makeUpdateHarness([
      {
        tag_name: "v0.2.0-beta.1",
        name: "Little Imp 0.2.0 beta 1",
        draft: false,
        prerelease: true,
        published_at: "2026-05-18T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0-beta.1",
      },
      {
        tag_name: "v0.1.0",
        name: "Little Imp 0.1.0",
        draft: false,
        prerelease: false,
        published_at: "2026-05-17T12:00:00Z",
        html_url: "https://github.com/goniszewski/little-imp/releases/tag/v0.1.0",
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
      "user-agent": "littleimp-update-check/0.1.0-beta",
    });
    expect(JSON.parse(harness.stdout[0])).toEqual({
      current_version: "0.1.0-beta",
      update_available: true,
      source: "https://updates.example.test/releases",
      channel: "beta",
      latest: {
        version: "0.2.0-beta.1",
        tag: "v0.2.0-beta.1",
        name: "Little Imp 0.2.0 beta 1",
        prerelease: true,
        published_at: "2026-05-18T12:00:00Z",
        url: "https://github.com/goniszewski/little-imp/releases/tag/v0.2.0-beta.1",
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
    expect(harness.stdout.join("\n")).toContain("Little Imp is up to date");
    expect(harness.stdout.join("\n")).toContain("0.1.0-beta");
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
});
