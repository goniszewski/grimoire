/**
 * Unit tests for the AI enrichment stage (ai/enrichment.ts).
 *
 * The LLM HTTP call is mocked via globalThis.fetch — no real network traffic.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { enrichBookmark } from "../../ai/enrichment.js";
import { makeTestDb } from "../helpers/db.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LLM_CONFIG = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
};

function makeLlmResponse(body: string): Response {
  const payload = JSON.stringify({
    choices: [{ message: { content: body } }],
  });
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function insertBookmark(db: Database): string {
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO bookmarks (id, url, domain, status) VALUES (?, ?, ?, 'extracted')`,
    [id, "https://example.com", "example.com"]
  );
  return id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("enrichBookmark", () => {
  let db: Database;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    db = makeTestDb();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("parses valid LLM JSON and persists summary, tags, category", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () =>
      makeLlmResponse(
        JSON.stringify({
          summary: "A great article about TypeScript.",
          tags: ["typescript", "web-dev"],
          category: "Article",
          confidence: 0.9,
        })
      );

    await enrichBookmark(db, LLM_CONFIG, {
      bookmarkId,
      title: "TypeScript Tips",
      content: "Some content about TypeScript.",
    });

    // Status should be advanced
    const bm = db.query<{ status: string }, [string]>(
      "SELECT status FROM bookmarks WHERE id = ?"
    ).get(bookmarkId);
    expect(bm?.status).toBe("ai_enriched");

    // Summary should be stored in bookmark_content
    const content = db.query<{ summary: string }, [string]>(
      "SELECT summary FROM bookmark_content WHERE bookmark_id = ?"
    ).get(bookmarkId);
    expect(content?.summary).toBe("A great article about TypeScript.");

    // Tags should be linked
    const tags = db.query<{ name: string }, [string]>(
      `SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?`
    ).all(bookmarkId);
    const tagNames = tags.map((t) => t.name).sort();
    expect(tagNames).toContain("typescript");
    expect(tagNames).toContain("web-dev");

    // Category should be linked
    const cat = db.query<{ name: string }, [string]>(
      `SELECT c.name FROM categories c JOIN bookmarks b ON b.category_id = c.id WHERE b.id = ?`
    ).get(bookmarkId);
    expect(cat?.name).toBe("Article");
  });

  it("sanitises tags to lowercase hyphenated format", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () =>
      makeLlmResponse(
        JSON.stringify({
          summary: "Summary.",
          tags: ["TypeScript!", "Web Dev", "node.js"],
          category: "Tutorial",
          confidence: 0.8,
        })
      );

    await enrichBookmark(db, LLM_CONFIG, {
      bookmarkId,
      title: "Title",
      content: "Content",
    });

    const tags = db.query<{ name: string }, [string]>(
      `SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = ?`
    ).all(bookmarkId);
    const tagNames = tags.map((t) => t.name);
    // All tags should be lowercase and contain only letters/digits/hyphens
    for (const name of tagNames) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("uses 'Other' category for unknown category strings", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () =>
      makeLlmResponse(
        JSON.stringify({
          summary: "S.",
          tags: [],
          category: "CompletelyUnknownCategory",
          confidence: 0.1,
        })
      );

    await enrichBookmark(db, LLM_CONFIG, {
      bookmarkId,
      title: "Title",
      content: "Content",
    });

    const cat = db.query<{ name: string }, [string]>(
      `SELECT c.name FROM categories c JOIN bookmarks b ON b.category_id = c.id WHERE b.id = ?`
    ).get(bookmarkId);
    expect(cat?.name).toBe("Other");
  });

  // ── Invalid JSON from LLM ───────────────────────────────────────────────

  it("throws when LLM returns invalid JSON", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () => makeLlmResponse("not json at all }{");

    await expect(
      enrichBookmark(db, LLM_CONFIG, {
        bookmarkId,
        title: "Title",
        content: "Content",
      })
    ).rejects.toThrow();
  });

  it("throws when LLM returns markdown-fenced invalid JSON", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () =>
      makeLlmResponse("```json\nnot valid json\n```");

    await expect(
      enrichBookmark(db, LLM_CONFIG, {
        bookmarkId,
        title: "Title",
        content: "Content",
      })
    ).rejects.toThrow();
  });

  it("strips markdown code fences and parses valid JSON", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () =>
      makeLlmResponse(
        "```json\n" +
          JSON.stringify({
            summary: "Fenced summary.",
            tags: ["foo"],
            category: "Article",
            confidence: 0.7,
          }) +
          "\n```"
      );

    await expect(
      enrichBookmark(db, LLM_CONFIG, {
        bookmarkId,
        title: "Title",
        content: "Content",
      })
    ).resolves.toBeUndefined();

    const content = db.query<{ summary: string }, [string]>(
      "SELECT summary FROM bookmark_content WHERE bookmark_id = ?"
    ).get(bookmarkId);
    expect(content?.summary).toBe("Fenced summary.");
  });

  // ── HTTP error from LLM ─────────────────────────────────────────────────

  it("throws on LLM HTTP 400 (non-retryable) error", async () => {
    const bookmarkId = insertBookmark(db);

    // HTTP 400 is non-retryable in llm-client, so it fails fast.
    globalThis.fetch = async () =>
      new Response("Bad Request", { status: 400 });

    await expect(
      enrichBookmark(db, LLM_CONFIG, {
        bookmarkId,
        title: "Title",
        content: "Content",
      })
    ).rejects.toThrow("HTTP 400");
  });

  it("throws on LLM HTTP 401 auth error", async () => {
    const bookmarkId = insertBookmark(db);

    globalThis.fetch = async () =>
      new Response("Unauthorized", { status: 401 });

    await expect(
      enrichBookmark(db, LLM_CONFIG, {
        bookmarkId,
        title: "Title",
        content: "Content",
      })
    ).rejects.toThrow();
  });
});
