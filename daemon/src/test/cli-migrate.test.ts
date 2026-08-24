import { describe, it, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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
    expect(harness.stdout.join("\n")).toContain("Experimental v0.5 migration");
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
    expect(harness.stdout.join("\n")).toContain("Experimental v0.5 migration");
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

  it("apply reads password from --password-file and env", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-pw-"));
    const pwFile = join(dir, "pw.txt");
    writeFileSync(pwFile, "file-secret\n");
    try {
      const fromFile = makeCliHarness({
        data: {
          owner: { username: "alice" },
          dryRun: false,
          categoriesCreated: 0,
          categoriesReused: 0,
          tagsCreated: 0,
          tagsReused: 0,
          bookmarksCreated: 0,
          bookmarksMerged: 0,
          bookmarksSkipped: 0,
          bookmarksFailed: 0,
          mediaImported: 0,
          mediaSkipped: 0,
          warnings: [],
        },
      });
      expect(
        await fromFile.run([
          "migrate",
          "apply",
          "--data-dir",
          "/tmp/v05-data",
          "--password-file",
          pwFile,
          "--yes",
        ])
      ).toBe(0);
      expect(JSON.parse(String(fromFile.calls[0]?.init?.body)).password).toBe("file-secret");

      const stdout: string[] = [];
      const stderr: string[] = [];
      const calls: FetchCall[] = [];
      const code = await runLittleImpCli(
        ["migrate", "apply", "--data-dir", "/tmp/v05-data", "--yes"],
        {
          env: { LITTLEIMP_MIGRATE_PASSWORD: "env-secret" },
          fetch: (async (url: string | URL | Request, init?: RequestInit) => {
            calls.push({ url: String(url), init });
            return new Response(
              JSON.stringify({
                data: {
                  owner: { username: "alice" },
                  dryRun: false,
                  categoriesCreated: 0,
                  categoriesReused: 0,
                  tagsCreated: 0,
                  tagsReused: 0,
                  bookmarksCreated: 0,
                  bookmarksMerged: 0,
                  bookmarksSkipped: 0,
                  bookmarksFailed: 0,
                  mediaImported: 0,
                  mediaSkipped: 0,
                  warnings: [],
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            );
          }) as typeof fetch,
          stdout: (line) => stdout.push(line),
          stderr: (line) => stderr.push(line),
        }
      );
      expect(code).toBe(0);
      expect(JSON.parse(String(calls[0]?.init?.body)).password).toBe("env-secret");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("apply exits non-zero when bookmarksFailed > 0", async () => {
    const harness = makeCliHarness({
      data: {
        owner: { username: "alice" },
        dryRun: false,
        categoriesCreated: 0,
        categoriesReused: 0,
        tagsCreated: 0,
        tagsReused: 0,
        bookmarksCreated: 0,
        bookmarksMerged: 0,
        bookmarksSkipped: 0,
        bookmarksFailed: 2,
        mediaImported: 0,
        mediaSkipped: 0,
        warnings: ["Failed https://example.com/x: boom"],
      },
    }, 207);
    expect(
      await harness.run(["migrate", "apply", "--data-dir", "/tmp/v05-data", "--yes"])
    ).toBe(1);
    expect(harness.stdout.join("\n")).toContain("failed 2");
    expect(harness.stderr.join("\n")).toMatch(/Partial apply: 2 bookmark\(s\) failed/i);
  });

  it("surfaces problem+json detail from migrate auth failures", async () => {
    const harness = makeCliHarness(
      {
        type: "https://littleimp.app/problems/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: 'Password does not match v0.5 user "alice"',
      },
      401
    );
    expect(
      await harness.run([
        "migrate",
        "apply",
        "--data-dir",
        "/tmp/v05-data",
        "--password",
        "wrong",
        "--yes",
      ])
    ).toBe(1);
    expect(harness.stderr.join("\n")).toContain('Password does not match v0.5 user "alice"');
    expect(harness.stderr.join("\n")).not.toContain("status 401");
  });
});
