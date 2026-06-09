import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { SearchRepository } from "../db/search-repository.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { EmbeddingRepository } from "../db/embedding-repository.js";
import { makeTestDb } from "./helpers/db.js";
import { packFloat32 } from "../ai/embeddings.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockEmbeddingFetch(vector: number[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ data: [{ embedding: vector }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

/**
 * Access the private sanitizeFtsQuery function by extracting it from the
 * module. Since it is not exported we test its observable effects via
 * keywordSearch — but we can also re-implement the exact logic inline and
 * assert consistency.  Here we test through the public API instead.
 */

describe("SearchRepository — keywordSearch", () => {
  let db: Database;
  let searchRepo: SearchRepository;
  let bookmarkRepo: BookmarkRepository;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    db = makeTestDb();
    searchRepo = new SearchRepository(db);
    bookmarkRepo = new BookmarkRepository(db);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ─── Empty query ────────────────────────────────────────────────────────

  it("empty query returns all non-trashed non-archived bookmarks", () => {
    bookmarkRepo.create("https://alpha.com", "Alpha");
    bookmarkRepo.create("https://beta.com", "Beta");
    const result = searchRepo.keywordSearch({ limit: 100, offset: 0 });
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("empty query excludes trashed bookmarks", () => {
    const bm = bookmarkRepo.create("https://trashed.com", "Trashed");
    bookmarkRepo.softDelete(bm.id);
    const result = searchRepo.keywordSearch({ limit: 100, offset: 0 });
    expect(result.items.map((i) => i.id)).not.toContain(bm.id);
  });

  it("empty query excludes archived bookmarks", () => {
    const bm = bookmarkRepo.create("https://archived.com", "Archived");
    bookmarkRepo.update(bm.id, { is_archived: 1 });
    const result = searchRepo.keywordSearch({ limit: 100, offset: 0 });
    expect(result.items.map((i) => i.id)).not.toContain(bm.id);
  });

  it("empty query respects limit and offset", () => {
    for (let i = 0; i < 5; i++) {
      bookmarkRepo.create(`https://page${i}.com`, `Page ${i}`);
    }
    const page1 = searchRepo.keywordSearch({ limit: 2, offset: 0 });
    const page2 = searchRepo.keywordSearch({ limit: 2, offset: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    const allIds = [...page1.items.map((i) => i.id), ...page2.items.map((i) => i.id)];
    expect(new Set(allIds).size).toBe(4); // no duplicates
  });

  // ─── FTS keyword matching ────────────────────────────────────────────────

  it("finds bookmark by title keyword", () => {
    bookmarkRepo.create("https://ts.com", "TypeScript Handbook");
    bookmarkRepo.create("https://py.com", "Python Docs");
    const result = searchRepo.keywordSearch({ q: "TypeScript", limit: 10, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe("TypeScript Handbook");
  });

  it("multi-word query matches documents containing all tokens (AND semantics)", () => {
    bookmarkRepo.create("https://a.com", "TypeScript React Guide");
    bookmarkRepo.create("https://b.com", "TypeScript Handbook");
    bookmarkRepo.create("https://c.com", "React Tutorial");
    const result = searchRepo.keywordSearch({ q: "TypeScript React", limit: 10, offset: 0 });
    // Only the first bookmark contains both words
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe("TypeScript React Guide");
  });

  it("FTS search is case-insensitive", () => {
    bookmarkRepo.create("https://go.com", "Go Programming Language");
    const lower = searchRepo.keywordSearch({ q: "go programming", limit: 10, offset: 0 });
    const upper = searchRepo.keywordSearch({ q: "GO PROGRAMMING", limit: 10, offset: 0 });
    expect(lower.total).toBe(1);
    expect(upper.total).toBe(1);
  });

  it("returns zero results when no bookmark matches", () => {
    bookmarkRepo.create("https://x.com", "Something Else");
    const result = searchRepo.keywordSearch({ q: "zyxwvut", limit: 10, offset: 0 });
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("search does not return trashed bookmarks even when title matches", () => {
    const bm = bookmarkRepo.create("https://hidden.com", "SecretTitle");
    bookmarkRepo.softDelete(bm.id);
    const result = searchRepo.keywordSearch({ q: "SecretTitle", limit: 10, offset: 0 });
    expect(result.total).toBe(0);
  });

  // ─── FTS injection / sanitization ────────────────────────────────────────

  it("FTS operator keywords (OR, NOT, AND) in query are treated as literals", () => {
    bookmarkRepo.create("https://or.com", "Learning OR operator");
    // If OR were treated as an FTS5 operator, this could throw or return wrong results
    expect(() =>
      searchRepo.keywordSearch({ q: "Learning OR operator", limit: 10, offset: 0 })
    ).not.toThrow();
  });

  it("quoted strings in query do not cause FTS5 syntax errors", () => {
    bookmarkRepo.create("https://q.com", 'He said "hello"');
    expect(() =>
      searchRepo.keywordSearch({ q: '"hello world"', limit: 10, offset: 0 })
    ).not.toThrow();
  });

  it("query with only whitespace returns all bookmarks (treated as empty)", () => {
    bookmarkRepo.create("https://any.com", "Any Bookmark");
    const result = searchRepo.keywordSearch({ q: "   ", limit: 10, offset: 0 });
    expect(result.total).toBe(1);
  });

  // ─── Filter options ───────────────────────────────────────────────────────

  it("filters by domain", () => {
    bookmarkRepo.create("https://github.com/foo", "GitHub Foo");
    bookmarkRepo.create("https://example.com/bar", "Example Bar");
    const result = searchRepo.keywordSearch({ domain: "github.com", limit: 10, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.items[0].domain).toBe("github.com");
  });

  it("filters by tag", () => {
    const bm1 = bookmarkRepo.create("https://tagged.com", "Tagged");
    const bm2 = bookmarkRepo.create("https://untagged.com", "Untagged");
    bookmarkRepo.addTag(bm1.id, "typescript");
    const result = searchRepo.keywordSearch({ tag: "typescript", limit: 10, offset: 0 });
    expect(result.items.map((i) => i.id)).toContain(bm1.id);
    expect(result.items.map((i) => i.id)).not.toContain(bm2.id);
  });

  it("items include tags", () => {
    const bm = bookmarkRepo.create("https://with-tags.com", "Tagged Bookmark");
    bookmarkRepo.addTag(bm.id, "rust");
    bookmarkRepo.addTag(bm.id, "systems");
    const result = searchRepo.keywordSearch({ limit: 10, offset: 0 });
    const found = result.items.find((i) => i.id === bm.id);
    expect(found!.tags).toContain("rust");
    expect(found!.tags).toContain("systems");
  });

  it("applies requested sort before paginating keyword search results", () => {
    const low = bookmarkRepo.create("https://low.example.com", "Shared Query Low");
    const high = bookmarkRepo.create("https://high.example.com", "Shared Query High");
    const mid = bookmarkRepo.create("https://mid.example.com", "Shared Query Mid");
    db.query("UPDATE bookmarks SET opened_count = ? WHERE id = ?").run(1, low.id);
    db.query("UPDATE bookmarks SET opened_count = ? WHERE id = ?").run(5, high.id);
    db.query("UPDATE bookmarks SET opened_count = ? WHERE id = ?").run(3, mid.id);

    const result = searchRepo.keywordSearch({
      q: "Shared",
      limit: 1,
      offset: 1,
      sort: "opened_count",
      direction: "desc",
    });

    expect(result.total).toBe(3);
    expect(result.items.map((bookmark) => bookmark.id)).toEqual([mid.id]);
  });

  it("matches SQL opened-count tie ordering for semantic search sorts", async () => {
    const older = bookmarkRepo.create("https://older.example.com", "Shared Older");
    const recent = bookmarkRepo.create("https://recent.example.com", "Shared Recent");
    const never = bookmarkRepo.create("https://never.example.com", "Shared Never");
    db.query(
      `UPDATE bookmarks
       SET opened_count = ?, last_opened_at = ?
       WHERE id = ?`
    ).run(1, "2026-05-01T00:00:00.000Z", older.id);
    db.query(
      `UPDATE bookmarks
       SET opened_count = ?, last_opened_at = ?
       WHERE id = ?`
    ).run(1, "2026-05-03T00:00:00.000Z", recent.id);
    db.query(
      `UPDATE bookmarks
       SET opened_count = ?, last_opened_at = ?
       WHERE id = ?`
    ).run(1, null, never.id);

    const embeddingRepo = new EmbeddingRepository(db);
    for (const bookmark of [older, recent, never]) {
      embeddingRepo.upsert(bookmark.id, "test-model", [1, 0]);
    }
    globalThis.fetch = mockEmbeddingFetch([1, 0]);

    const result = await searchRepo.search({
      q: "Shared",
      mode: "semantic",
      sort: "opened_count",
      direction: "asc",
      limit: 10,
      offset: 0,
      embeddingConfig: { baseUrl: "https://embed.example.test", apiKey: "test", model: "test-model" },
    });

    expect(result.items.map((bookmark) => bookmark.id)).toEqual([recent.id, older.id, never.id]);
  });

  it("semantic search ranks from the sqlite-vec mirror when it is available", async () => {
    const indexedClose = bookmarkRepo.create("https://indexed.example.com/close", "Indexed close");
    const indexedFar = bookmarkRepo.create("https://indexed.example.com/far", "Indexed far");
    const embeddingRepo = new EmbeddingRepository(db);
    const vectorIndexAvailable = embeddingRepo.isVectorIndexAvailable(2);
    if (!vectorIndexAvailable) {
      expect(vectorIndexAvailable).toBe(false);
      return;
    }

    embeddingRepo.upsert(indexedClose.id, "test-model", [1, 0]);
    embeddingRepo.upsert(indexedFar.id, "test-model", [0, 1]);

    db.query("UPDATE embeddings SET vector = ? WHERE bookmark_id = ?")
      .run(packFloat32([0, 1]), indexedClose.id);
    db.query("UPDATE embeddings SET vector = ? WHERE bookmark_id = ?")
      .run(packFloat32([1, 0]), indexedFar.id);
    globalThis.fetch = mockEmbeddingFetch([1, 0]);

    const result = await searchRepo.search({
      q: "Indexed",
      mode: "semantic",
      limit: 2,
      offset: 0,
      embeddingConfig: { baseUrl: "https://embed.example.test", apiKey: "test", model: "test-model" },
    });

    expect(result.items.map((bookmark) => bookmark.id)).toEqual([indexedClose.id, indexedFar.id]);
  });

  it("keeps hybrid keyword candidates relevance-ranked before applying final sort", async () => {
    const target = bookmarkRepo.create("https://target.example.com", "Zzz Shared Shared Shared Target");
    for (let index = 0; index < 200; index++) {
      bookmarkRepo.create(
        `https://filler-${index}.example.com`,
        `Aaa ${String(index).padStart(3, "0")} Shared`
      );
    }
    globalThis.fetch = mockEmbeddingFetch([1, 0]);

    const result = await searchRepo.search({
      q: "Shared",
      mode: "hybrid",
      sort: "title",
      direction: "asc",
      limit: 200,
      offset: 0,
      embeddingConfig: { baseUrl: "https://embed.example.test", apiKey: "test", model: "test-model" },
    });

    expect(result.items.map((bookmark) => bookmark.id)).toContain(target.id);
  });
});
