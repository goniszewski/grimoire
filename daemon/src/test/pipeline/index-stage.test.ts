/**
 * Unit tests for the index stage of the pipeline.
 *
 * The index stage updates the FTS5 table so the bookmark becomes searchable.
 * We run the full pipeline in a controlled way:
 *   - fetch stage: mocked via globalThis.fetch to return static HTML
 *   - ai_enrich stage: skipped (AI provider unset in runtime settings during test)
 *   - embed stage: skipped (embedding provider has no usable API key during test)
 *   - index stage: real, writing to in-memory SQLite
 *
 * We then verify the bookmark is returned by an FTS search query.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Database } from "bun:sqlite";
import { runPipeline } from "../../pipeline/pipeline.js";
import * as extractor from "../../pipeline/extractor.js";
import { SearchRepository } from "../../db/search-repository.js";
import { makeTestDb } from "../helpers/db.js";
import { mockFetch } from "../helpers/fetch.js";
import * as bookmarkMedia from "../../media/bookmark-media.js";

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

    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

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

  it("preserves an existing title during reprocess unless AI fields are replaceable", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/manual-title";
    const html = `
      <html>
        <head><title>Extracted Replacement Title</title></head>
        <body><article><p>Manual title preservation content.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Manual Title");
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url }, { replaceAiFields: false });

    const bm = db.query<{ title: string | null }, [string]>(
      "SELECT title FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    expect(bm?.title).toBe("Manual Title");
  });

  it("updates the bookmark title during normal ingest", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/extracted-title";
    const html = `
      <html>
        <head><title>Extracted Article Title</title></head>
        <body><article><p>Normal ingest should keep populating extracted titles.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Initial Title");
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url });

    const bm = db.query<{ title: string | null }, [string]>(
      "SELECT title FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    expect(bm?.title).toBe("Extracted Article Title");
  });

  it("preserveExistingContent keeps migrated description and HTML", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/migrated-content";
    const html = `
      <html>
        <head><title>Live Title</title></head>
        <body><article><p>Freshly fetched page body that must not clobber import.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Imported Title");
    db.run("UPDATE bookmarks SET description = ? WHERE id = ?", [
      "Imported description",
      bookmarkId,
    ]);
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown)
       VALUES (?, ?, ?)`,
      [bookmarkId, "<p>imported html</p>", "imported markdown"]
    );
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });

    const bm = db
      .query<{ title: string | null; description: string | null }, [string]>(
        "SELECT title, description FROM bookmarks WHERE id = ?"
      )
      .get(bookmarkId);
    expect(bm?.title).toBe("Imported Title");
    expect(bm?.description).toBe("Imported description");

    const content = db
      .query<{ raw_html: string | null; markdown: string | null }, [string]>(
        "SELECT raw_html, markdown FROM bookmark_content WHERE bookmark_id = ?"
      )
      .get(bookmarkId);
    expect(content?.raw_html).toBe("<p>imported html</p>");
    expect(content?.markdown).toBe("imported markdown");
  });

  it("preserveExistingContent keeps migrated author and published_at", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/migrated-author";
    const html = `
      <html>
        <head><title>Live Title</title><meta name="author" content="Live Author"></head>
        <body><article><p>Body</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Imported Title");
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, author, published_at)
       VALUES (?, 'Ada Lovelace', '2024-01-15')`,
      [bookmarkId]
    );
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });

    const content = db
      .query<{ author: string | null; published_at: string | null }, [string]>(
        "SELECT author, published_at FROM bookmark_content WHERE bookmark_id = ?"
      )
      .get(bookmarkId);
    expect(content?.author).toBe("Ada Lovelace");
    expect(content?.published_at).toBe("2024-01-15");
  });

  it("preserveExistingContent keeps imported media and upgrades URL-stub titles", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/stub-title";
    const html = `
      <html>
        <head><title>Extracted Live Title</title></head>
        <body>
          <article><p>Body</p></article>
          <link rel="icon" href="https://cdn.example.com/should-not-replace.ico" />
        </body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, url); // URL stub title
    db.run(
      `INSERT INTO bookmark_media
         (id, bookmark_id, kind, source_url, cache_path, media_type, size_bytes, alt, display_order)
       VALUES (?, ?, 'favicon', 'legacy://icon', 'media-cache/bookmarks/x/favicon.ico', 'image/x-icon', 16, NULL, 0)`,
      [crypto.randomUUID(), bookmarkId]
    );
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    const cacheSpy = spyOn(bookmarkMedia, "cacheBookmarkMedia").mockResolvedValue({
      favicon: null,
      screenshot: null,
      images: [],
    });
    try {
      await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });
      expect(cacheSpy).toHaveBeenCalledTimes(1);
    } finally {
      cacheSpy.mockRestore();
    }

    const bm = db
      .query<{ title: string | null }, [string]>("SELECT title FROM bookmarks WHERE id = ?")
      .get(bookmarkId);
    expect(bm?.title).toBe("Extracted Live Title");

    const media = db
      .query<{ c: number; source_url: string }, [string]>(
        `SELECT COUNT(*) AS c, MAX(source_url) AS source_url
         FROM bookmark_media WHERE bookmark_id = ?`
      )
      .get(bookmarkId);
    expect(media?.c).toBe(1);
    expect(media?.source_url).toBe("legacy://icon");
  });

  it("preserveExistingContent indexes migrated markdown into FTS, not live extract", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/migrated-fts";
    const html = `
      <html>
        <head><title>Live Title</title></head>
        <body><article><p>Live extract body with uniquephrasezebra.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Imported Title");
    // Existing description blocks live extract from writing the zebra phrase into
    // bookmarks.description (and thus FTS summary via updateFts fallback).
    db.run("UPDATE bookmarks SET description = ? WHERE id = ?", [
      "imported description without live token",
      bookmarkId,
    ]);
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown)
       VALUES (?, ?, ?)`,
      [bookmarkId, "<p>imported</p>", "imported uniquephrasealpha markdown body"]
    );
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });

    const byImported = searchRepo.keywordSearch({
      q: "uniquephrasealpha",
      limit: 10,
      offset: 0,
    });
    expect(byImported.items.map((i) => i.id)).toContain(bookmarkId);

    const byLive = searchRepo.keywordSearch({
      q: "uniquephrasezebra",
      limit: 10,
      offset: 0,
    });
    expect(byLive.items.map((i) => i.id)).not.toContain(bookmarkId);
  });

  it("preserveExistingContent keeps migrated description searchable in FTS summary", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/migrated-desc-fts";
    const html = `
      <html>
        <head><title>Live Title</title></head>
        <body><article><p>Live body without the unique token.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Imported Title");
    db.run("UPDATE bookmarks SET description = ? WHERE id = ?", [
      "uniquephasedescmigrate only in description",
      bookmarkId,
    ]);
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown)
       VALUES (?, ?, ?)`,
      [bookmarkId, "<p>imported</p>", "imported markdown without that token"]
    );
    // Seed FTS the way migrate does (description in summary column).
    db.run(`DELETE FROM bookmarks_fts WHERE bookmark_id = ?`, [bookmarkId]);
    db.run(
      `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
       VALUES (?, ?, ?, '', ?)`,
      [
        bookmarkId,
        "Imported Title",
        "uniquephasedescmigrate only in description",
        "imported markdown without that token",
      ]
    );
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });

    const fts = db
      .query<{ summary: string | null }, [string]>(
        "SELECT summary FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(bookmarkId);
    expect(fts?.summary).toContain("uniquephasedescmigrate");

    const found = searchRepo.keywordSearch({
      q: "uniquephasedescmigrate",
      limit: 10,
      offset: 0,
    });
    expect(found.items.map((i) => i.id)).toContain(bookmarkId);
  });

  it("keeps migrated description searchable in FTS even after LLM summary is written", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/desc-plus-summary-fts";
    const html = `
      <html>
        <head><title>Live Title</title></head>
        <body><article><p>Live body.</p></article></body>
      </html>
    `;

    insertBookmark(db, bookmarkId, url, "Imported Title");
    db.run("UPDATE bookmarks SET description = ? WHERE id = ?", [
      "uniquephasedescplus only in description",
      bookmarkId,
    ]);
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown, summary)
       VALUES (?, ?, ?, ?)`,
      [
        bookmarkId,
        "<p>imported</p>",
        "imported markdown",
        "LLM summary with uniquephrasesummarytoken",
      ]
    );
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });

    const fts = db
      .query<{ summary: string | null }, [string]>(
        "SELECT summary FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(bookmarkId);
    expect(fts?.summary).toContain("uniquephasedescplus");
    expect(fts?.summary).toContain("uniquephrasesummarytoken");

    const byDesc = searchRepo.keywordSearch({
      q: "uniquephasedescplus",
      limit: 10,
      offset: 0,
    });
    expect(byDesc.items.map((i) => i.id)).toContain(bookmarkId);
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

    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));
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
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

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
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));
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
    globalThis.fetch = mockFetch(async () => makeHtmlResponse(html, url));

    // Should not throw
    await runPipeline(db, { bookmarkId, url });

    const bm = db.query<{ status: string }, [string]>(
      "SELECT status FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    // Should reach at least "extracted" or "indexed"
    expect(bm).not.toBeNull();
    expect(["extracted", "indexed"]).toContain(bm!.status);
  });

  it("extract failure keeps migrated description searchable in FTS", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/extract-fail-fts";
    insertBookmark(db, bookmarkId, url, "Imported Title");
    db.run("UPDATE bookmarks SET description = ? WHERE id = ?", [
      "uniqueextractfaildesc",
      bookmarkId,
    ]);
    db.run(`DELETE FROM bookmarks_fts WHERE bookmark_id = ?`, [bookmarkId]);
    db.run(
      `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
       VALUES (?, 'Imported Title', 'uniqueextractfaildesc', '', '')`,
      [bookmarkId]
    );

    const extractSpy = spyOn(extractor, "extractContent").mockImplementation(async () => {
      throw new Error("injected extract failure");
    });
    globalThis.fetch = mockFetch(async () =>
      makeHtmlResponse("<html><body>x</body></html>", url)
    );
    try {
      await runPipeline(db, { bookmarkId, url }, { preserveExistingContent: true });
      expect(extractSpy).toHaveBeenCalled();
      const fts = db
        .query<{ summary: string | null }, [string]>(
          "SELECT summary FROM bookmarks_fts WHERE bookmark_id = ?"
        )
        .get(bookmarkId);
      expect(fts?.summary).toContain("uniqueextractfaildesc");
      const found = searchRepo.keywordSearch({
        q: "uniqueextractfaildesc",
        limit: 10,
        offset: 0,
      });
      expect(found.items.map((i) => i.id)).toContain(bookmarkId);
    } finally {
      extractSpy.mockRestore();
    }
  });

  it("pipeline throws when fetch fails (HTTP 404)", async () => {
    const bookmarkId = crypto.randomUUID();
    const url = "https://example.com/missing";

    insertBookmark(db, bookmarkId, url, "Missing Page");
    globalThis.fetch = mockFetch(async () =>
      withUrl(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
        url
      )
    );

    await expect(runPipeline(db, { bookmarkId, url })).rejects.toThrow("HTTP 404");

    // Status should still be "saved" (not advanced past fetch)
    const bm = db.query<{ status: string }, [string]>(
      "SELECT status FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    expect(bm?.status).toBe("saved");
  });
});
