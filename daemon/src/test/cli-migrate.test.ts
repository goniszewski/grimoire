import { describe, it, expect } from "bun:test";
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

describe("littleimp migrate CLI", () => {
  it("inspect posts dataDir to the daemon", async () => {
    const harness = makeCliHarness({
      data: {
        source: "grimoire-v05-sqlite",
        users: [
          {
            username: "alice",
            email: "alice@example.com",
            name: "Alice",
            bookmarkCount: 2,
            categoryCount: 1,
            tagCount: 1,
            disabled: false,
          },
        ],
        totals: {
          users: 1,
          categories: 1,
          tags: 1,
          bookmarks: 2,
          mediaFilesReferenced: 0,
        },
        requiresOwnerSelection: false,
      },
    });

    const code = await harness.run(["migrate", "inspect", "--data-dir", "/tmp/v05-data"]);
    expect(code).toBe(0);
    expect(harness.calls[0]?.url).toBe("http://127.0.0.1:3210/migrate/legacy/inspect");
    const body = JSON.parse(String(harness.calls[0]?.init?.body));
    expect(body.dataDir).toBe("/tmp/v05-data");
    expect(harness.stdout.join("\n")).toContain("alice");
    expect(harness.stdout.join("\n")).toContain("v0.5");
  });

  it("apply requires --yes and forwards owner password", async () => {
    const missingYes = makeCliHarness({});
    expect(
      await missingYes.run(["migrate", "apply", "--data-dir", "/tmp/v05-data"])
    ).toBe(2);
    expect(missingYes.stderr.join("\n")).toContain("--yes");

    const harness = makeCliHarness({
      data: {
        owner: { username: "alice" },
        dryRun: false,
        categoriesCreated: 1,
        categoriesReused: 0,
        tagsCreated: 1,
        tagsReused: 0,
        bookmarksCreated: 2,
        bookmarksMerged: 0,
        bookmarksSkipped: 0,
        bookmarksFailed: 0,
        mediaImported: 0,
        mediaSkipped: 0,
        warnings: [],
      },
    });

    const code = await harness.run([
      "migrate",
      "apply",
      "--archive",
      "/tmp/grimoire-data.zip",
      "--owner",
      "alice",
      "--password",
      "secret",
      "--yes",
      "--merge",
    ]);
    expect(code).toBe(0);
    expect(harness.calls[0]?.url).toBe("http://127.0.0.1:3210/migrate/legacy/apply");
    const body = JSON.parse(String(harness.calls[0]?.init?.body));
    expect(body).toMatchObject({
      archivePath: "/tmp/grimoire-data.zip",
      owner: "alice",
      password: "secret",
      requirePassword: true,
      mergeDuplicates: true,
      dryRun: false,
    });
    expect(harness.stdout.join("\n")).toContain("Migrated owner: alice");
  });

  it("dry-run apply skips --yes and forwards dryRun", async () => {
    const harness = makeCliHarness({
      data: {
        owner: { username: "alice" },
        dryRun: true,
        categoriesCreated: 2,
        categoriesReused: 0,
        tagsCreated: 1,
        tagsReused: 0,
        bookmarksCreated: 1,
        bookmarksMerged: 0,
        bookmarksSkipped: 1,
        bookmarksFailed: 0,
        mediaImported: 1,
        mediaSkipped: 0,
        warnings: ["Dry run — no changes were written to the local library."],
      },
    });

    const code = await harness.run([
      "migrate",
      "apply",
      "--data-dir",
      "/tmp/v05-data",
      "--owner",
      "alice",
      "--dry-run",
    ]);
    expect(code).toBe(0);
    const body = JSON.parse(String(harness.calls[0]?.init?.body));
    expect(body).toMatchObject({
      dataDir: "/tmp/v05-data",
      owner: "alice",
      dryRun: true,
    });
    expect(harness.stdout.join("\n")).toContain("Dry run");
    expect(harness.stdout.join("\n")).toContain("Would migrate owner: alice");
  });
});
