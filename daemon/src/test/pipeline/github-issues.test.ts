/**
 * Unit tests for GitHub issue extraction.
 *
 * External GitHub API calls are intercepted through globalThis.fetch.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { BookmarkRepository } from "../../db/bookmark-repository.js";
import { extractContent } from "../../pipeline/extractor.js";
import {
  extractFromGitHubIssue,
  parseGitHubIssueUrl,
} from "../../pipeline/extractors/github-issues.js";
import type { FetchResult } from "../../pipeline/fetcher.js";
import { runPipeline } from "../../pipeline/pipeline.js";
import { makeTestDb } from "../helpers/db.js";
import { mockFetch } from "../helpers/fetch.js";

function makeFetchedHtml(url: string): FetchResult {
  return {
    html: "<html><head><title>GitHub issue</title></head><body></body></html>",
    finalUrl: url,
    contentType: "text/html; charset=utf-8",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function withUrl(res: Response, url: string): Response {
  return new Proxy(res, {
    get(target, prop) {
      if (prop === "url") return url;
      const val = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

function htmlResponse(url: string): Response {
  return withUrl(
    new Response("<html><head><title>GitHub issue</title></head><body></body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
    url
  );
}

describe("GitHub issue extraction", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalGithubToken: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalGithubToken = process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalGithubToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalGithubToken;
    }
  });

  it("routes GitHub issue URLs to the issue API before the repository extractor", async () => {
    const calls: string[] = [];
    const issueUrl = "https://github.com/littleimp/demo/issues/42";

    globalThis.fetch = mockFetch(async (input) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith("/repos/littleimp/demo/issues/42")) {
        return jsonResponse({
          number: 42,
          title: "Preserve imported bookmark folders",
          body: "Importer should keep the nested browser folder context.",
          state: "open",
          labels: [{ name: "bug" }, { name: "import" }],
          created_at: "2026-06-01T10:00:00Z",
          updated_at: "2026-06-02T11:00:00Z",
          user: { login: "alice" },
          assignees: [{ login: "bob" }],
          comments: 1,
        });
      }

      if (url.endsWith("/repos/littleimp/demo/issues/42/comments?per_page=10")) {
        return jsonResponse([
          {
            user: { login: "carol" },
            created_at: "2026-06-02T12:00:00Z",
            body: "The import preview already has the folder data.",
          },
        ]);
      }

      if (url.endsWith("/repos/littleimp/demo")) {
        return jsonResponse({
          full_name: "littleimp/demo",
          description: "Repository fallback should not be used for issues.",
          language: "TypeScript",
          topics: [],
          stargazers_count: 1,
          pushed_at: "2026-06-01T00:00:00Z",
          owner: { login: "littleimp" },
          default_branch: "main",
        });
      }

      return jsonResponse({ message: "not found" }, 404);
    });

    const result = await extractContent(issueUrl, makeFetchedHtml(issueUrl), null);

    expect(calls.some((url) => url.endsWith("/repos/littleimp/demo/issues/42"))).toBe(true);
    expect(result.title).toBe("Preserve imported bookmark folders");
    expect(result.author).toBe("alice");
    expect(result.publishedAt).toBe("2026-06-01T10:00:00Z");
    expect(result.markdown).toContain("**Repository:** littleimp/demo");
    expect(result.markdown).toContain("**State:** open");
    expect(result.markdown).toContain("**Labels:** bug, import");
    expect(result.markdown).toContain("**Assignees:** bob");
    expect(result.markdown).toContain("Importer should keep the nested browser folder context.");
    expect(result.markdown).toContain("## Top Comments");
    expect(result.markdown).toContain("The import preview already has the folder data.");
  });

  it("leaves non-issue GitHub URLs on the repository extractor", async () => {
    const calls: string[] = [];
    const pullUrl = "https://github.com/littleimp/demo/pull/42";

    globalThis.fetch = mockFetch(async (input) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith("/repos/littleimp/demo")) {
        return jsonResponse({
          full_name: "littleimp/demo",
          description: "Repository extraction remains active for pull URLs.",
          language: "TypeScript",
          topics: ["bookmarks"],
          stargazers_count: 5,
          pushed_at: "2026-06-01T00:00:00Z",
          owner: { login: "littleimp" },
          default_branch: "main",
        });
      }

      return jsonResponse({ message: "not found" }, 404);
    });

    const result = await extractContent(pullUrl, makeFetchedHtml(pullUrl), null);

    expect(calls.some((url) => url.endsWith("/repos/littleimp/demo/issues/42"))).toBe(false);
    expect(calls.some((url) => url.endsWith("/repos/littleimp/demo"))).toBe(true);
    expect(result.title).toBe("littleimp/demo");
  });

  it("parses only GitHub issue URLs", () => {
    expect(parseGitHubIssueUrl("https://github.com/littleimp/demo/issues/42")).toEqual({
      owner: "littleimp",
      repo: "demo",
      number: 42,
    });
    expect(parseGitHubIssueUrl("https://github.com/littleimp/demo/pull/42")).toBeNull();
    expect(parseGitHubIssueUrl("https://github.com/littleimp/demo")).toBeNull();
    expect(parseGitHubIssueUrl("https://example.com/littleimp/demo/issues/42")).toBeNull();
  });

  it("sends GITHUB_TOKEN as an authorization header when configured", async () => {
    process.env.GITHUB_TOKEN = "github-token";
    const authorizations: string[] = [];

    globalThis.fetch = mockFetch(async (_input, init) => {
      const authorization = new Headers(init?.headers).get("authorization");
      if (authorization) authorizations.push(authorization);
      return jsonResponse({
        number: 12,
        title: "Token auth issue",
        body: "Token-backed extraction.",
        state: "closed",
        labels: [],
        created_at: "2026-06-01T10:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
        user: { login: "alice" },
        assignees: [],
        comments: 0,
      });
    });

    await extractFromGitHubIssue("https://github.com/littleimp/demo/issues/12");

    expect(authorizations).toContain("Bearer github-token");
  });

  it("throws a clear not-found error for missing issues", async () => {
    globalThis.fetch = mockFetch(async () =>
      jsonResponse({ message: "Not Found" }, 404)
    );

    await expect(
      extractFromGitHubIssue("https://github.com/littleimp/demo/issues/404")
    ).rejects.toThrow("GitHub API 404");
  });

  it("explains rate limits and GITHUB_TOKEN when GitHub refuses unauthenticated requests", async () => {
    globalThis.fetch = mockFetch(async () =>
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-remaining": "0",
        },
      })
    );

    await expect(
      extractFromGitHubIssue("https://github.com/littleimp/demo/issues/42")
    ).rejects.toThrow(/rate limit.*GITHUB_TOKEN/i);
  });

  it("continues extraction when the comments endpoint fails", async () => {
    const issueUrl = "https://github.com/littleimp/demo/issues/9";
    const calls: string[] = [];

    globalThis.fetch = mockFetch(async (input) => {
      const url = String(input);
      calls.push(url);

      if (url.endsWith("/repos/littleimp/demo/issues/9")) {
        return jsonResponse({
          number: 9,
          title: "Body survives comment failure",
          body: "Issue body must be stored even if comments fail.",
          state: "open",
          labels: [{ name: "bug" }],
          created_at: "2026-06-01T10:00:00Z",
          updated_at: "2026-06-01T10:00:00Z",
          user: { login: "alice" },
          assignees: [],
          comments: 5,
        });
      }

      if (url.includes("/repos/littleimp/demo/issues/9/comments")) {
        return new Response(JSON.stringify({ message: "rate limit" }), {
          status: 403,
          headers: { "x-ratelimit-remaining": "0" },
        });
      }

      return jsonResponse({ message: "not found" }, 404);
    });

    const result = await extractFromGitHubIssue(issueUrl);

    expect(calls.some((url) => url.endsWith("/repos/littleimp/demo/issues/9"))).toBe(true);
    expect(calls.some((url) => url.includes("/repos/littleimp/demo/issues/9/comments"))).toBe(true);
    expect(result.title).toBe("Body survives comment failure");
    expect(result.markdown).toContain("Issue body must be stored even if comments fail.");
    expect(result.markdown).not.toContain("## Top Comments");
  });

  it("rejects malformed issue numbers", () => {
    expect(parseGitHubIssueUrl("https://github.com/littleimp/demo/issues/42abc")).toBeNull();
    expect(parseGitHubIssueUrl("https://github.com/littleimp/demo/issues/0")).toBeNull();
    expect(parseGitHubIssueUrl("https://github.com/littleimp/demo/issues/-5")).toBeNull();
  });

  it("merges extracted tags with existing manual tags on reprocess", async () => {
    const db: Database = makeTestDb();
    const repo = new BookmarkRepository(db);
    const issueUrl = "https://github.com/littleimp/demo/issues/77";
    const bookmark = repo.create(issueUrl, "GitHub Issue");
    repo.addTag(bookmark.id, "manual");

    globalThis.fetch = mockFetch(async (input) => {
      const url = String(input);

      if (url === issueUrl) {
        return htmlResponse(issueUrl);
      }

      if (url.endsWith("/repos/littleimp/demo/issues/77")) {
        return jsonResponse({
          number: 77,
          title: "Capture issue labels",
          body: "Labels should merge into bookmark tags.",
          state: "open",
          labels: [{ name: "bug" }, { name: "import" }],
          created_at: "2026-06-01T10:00:00Z",
          updated_at: "2026-06-01T10:00:00Z",
          user: { login: "alice" },
          assignees: [],
          comments: 0,
        });
      }

      return jsonResponse({ message: "not found" }, 404);
    });

    await runPipeline(db, { bookmarkId: bookmark.id, url: issueUrl }, {
      replaceAiFields: true,
    });

    const updated = repo.findById(bookmark.id);
    expect(updated?.tags).toEqual(expect.arrayContaining(["bug", "import", "manual"]))
  });
});
