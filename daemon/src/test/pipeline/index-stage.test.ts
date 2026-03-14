/**
 * Unit tests for the index stage of the pipeline.
 *
 * The index stage updates the FTS5 table so the bookmark becomes searchable.
 * We run the full pipeline in a controlled way:
 *   - fetch stage: mocked via globalThis.fetch to return static HTML
 *   - ai_enrich stage: skipped (LLM_API_KEY unset in Config during test)
 *   - embed stage: skipped (EMBEDDING_API_KEY unset in Config during test)
 *   - index stage: real, writing to in-memory SQLite
 *
 * We then verify the bookmark is returned by an FTS search query.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runPipeline } from "../../pipeline/pipeline.js";
import { SearchRepository } from "../../db/search-repository.js";
import { makeTestDb } from "../helpers/db.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withUrl(res: Response, url: string): Response {
  return new Proxy(res, {
    get(target, prop) {
      if (prop === "url") return url;
      const val = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

function makeHtmlResponse(html: string, finalUrl: string): Response {
  const bytes = new TextEncoder().encode(html);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const res = new Response(stream, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  return withUrl(res, finalUrl);
}

function insertBookmark(db: Database, id: string, url: string, title: string): void {
  db.run(
    `INSERT INTO bookmarks (id, url, domain, title, status) VALUES (?, ?, ?, ?, 'saved')`,
    [id, url, new URL(url).hostname, title]
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("pipeline index stage", () => {
  let db: Database;
  let searchRepo: SearchRepository;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    db = makeTestDb();
    searchRepo = new SearchRepository(db);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── FTS indexing ────────────────────────────────────────────────────────

  it("bookmark is returned by FTS search after pipeline runs", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/typescript-guide";
    const html = `
      <html lang="en">
        <head><title>TypeScript Complete Guide</title></head>
        <body>
          <main>
            <article>
              <h1>TypeScript Complete Guide</h1>
              <p>Learn TypeScript from scratch with practical examples and advanced types.</p>
              <p>This guide covers interfaces, generics, and advanced TypeScript patterns.</p>
            </article>
          </main>
        </body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "TypeScript Complete Guide");

    globalThis.fetch = async () => makeHtmlResponse(html, url);

    await runPipeline(db, { bookmarkId, url });

    // Verify bookmark status is now "indexed"
    const bm = db.query<{ status: string }, [string]>(
      "SELECT status FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    expect(bm?.status).toBe("indexed");

    // FTS search should return the bookmark
    const results = searchRepo.keywordSearch({ q: "TypeScript", limit: 10, offset: 0 });
    const ids = results.items.map((i) => i.id);
    expect(ids).toContain(bookmarkId);
  });

  it("body content is NOT searchable before pipeline runs, but becomes searchable after", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/react-hooks-guide";
    // Use a body-only keyword ("interoperability") not present in the title.
    const html = `
      <html>
        <head><title>React Hooks</title></head>
        <body><article><p>Hooks enable interoperability between class and function components.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "React Hooks");

    // Before pipeline: body text not in FTS — only title is indexed by the INSERT trigger
    const before = searchRepo.keywordSearch({ q: "interoperability", limit: 10, offset: 0 });
    expect(before.items.map((i) => i.id)).not.toContain(bookmarkId);

    globalThis.fetch = async () => makeHtmlResponse(html, url);
    await runPipeline(db, { bookmarkId, url });

    // After pipeline: body text is indexed and the bookmark is found
    const after = searchRepo.keywordSearch({ q: "interoperability", limit: 10, offset: 0 });
    expect(after.items.map((i) => i.id)).toContain(bookmarkId);
  });

  it("FTS finds bookmark by extracted article content", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/rust-memory";
    const html = `
      <html>
        <head><title>Rust Memory Management</title></head>
        <body>
          <article>
            <p>Rust uses ownership and borrowing to guarantee memory safety without a garbage collector.</p>
          </article>
        </body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Rust Memory Management");
    globalThis.fetch = async () => makeHtmlResponse(html, url);

    await runPipeline(db, { bookmarkId, url });

    // Search by content keyword that only appears in the article body, not the title
    const results = searchRepo.keywordSearch({ q: "ownership borrowing", limit: 10, offset: 0 });
    const ids = results.items.map((i) => i.id);
    expect(ids).toContain(bookmarkId);
  });

  it("FTS excludes bookmark after it is trashed", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/graphql-intro";
    const html = `
      <html>
        <head><title>GraphQL Introduction</title></head>
        <body><article><p>GraphQL is a query language for APIs.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "GraphQL Introduction");
    globalThis.fetch = async () => makeHtmlResponse(html, url);
    await runPipeline(db, { bookmarkId, url });

    // Trash the bookmark
    db.run("UPDATE bookmarks SET is_trashed = 1 WHERE id = ?", [bookmarkId]);

    const results = searchRepo.keywordSearch({ q: "GraphQL", limit: 10, offset: 0 });
    const ids = results.items.map((i) => i.id);
    expect(ids).not.toContain(bookmarkId);
  });

  // ── Pipeline resilience ─────────────────────────────────────────────────

  it("pipeline continues to index stage even when extraction produces minimal content", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/minimal";
    // Very sparse HTML — no article/main/body with content
    const html = `<html><head><title>Minimal Page</title></head><body></body></html>`;

    insertBookmark(db, bookmarkId, url, "Minimal Page");
    globalThis.fetch = async () => makeHtmlResponse(html, url);

    // Should not throw
    await runPipeline(db, { bookmarkId, url });

    const bm = db.query<{ status: string }, [string]>(
      "SELECT status FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    // Should reach at least "extracted" or "indexed"
    expect(["extracted", "indexed"]).toContain(bm?.status);
  });

  it("pipeline throws when fetch fails (HTTP 404)", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/missing";

    insertBookmark(db, bookmarkId, url, "Missing Page");
    globalThis.fetch = async () =>
      withUrl(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
        url
      );

    await expect(runPipeline(db, { bookmarkId, url })).rejects.toThrow("HTTP 404");

    // Status should still be "saved" (not advanced past fetch)
    const bm = db.query<{ status: string }, [string]>(
      "SELECT status FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    expect(bm?.status).toBe("saved");
  });
});
