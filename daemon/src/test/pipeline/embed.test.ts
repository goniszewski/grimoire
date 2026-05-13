/**
 * Unit tests for the embed stage utilities (ai/embeddings.ts).
 *
 * - getEmbedding: mocked via globalThis.fetch
 * - buildEmbedInput: pure function, no mocking needed
 * - packFloat32 / unpackFloat32: pure functions
 * - cosineSimilarity: pure function
 * - EmbeddingRepository: uses in-memory SQLite
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  getEmbedding,
  buildEmbedInput,
  packFloat32,
  unpackFloat32,
  cosineSimilarity,
} from "../../ai/embeddings.js";
import { EmbeddingRepository } from "../../db/embedding-repository.js";
import { makeTestDb } from "../helpers/db.js";
import { mockFetch } from "../helpers/fetch.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMBED_CONFIG = {
  baseUrl: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "text-embedding-3-small",
};

function makeEmbedResponse(vector: number[]): Response {
  const payload = JSON.stringify({ data: [{ embedding: vector }] });
  return new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function insertBookmark(db: Database, id = crypto.randomUUID()): string {
  db.run(
    `INSERT INTO bookmarks (id, url, domain, status) VALUES (?, ?, ?, 'indexed')`,
    [id, "https://example.com", "example.com"]
  );
  return id;
}

// ─── packFloat32 / unpackFloat32 ─────────────────────────────────────────────

describe("packFloat32 / unpackFloat32", () => {
  it("round-trips a vector through pack/unpack", () => {
    const original = [0.1, 0.5, -0.3, 1.0, 0.0];
    const packed = packFloat32(original);
    const unpacked = unpackFloat32(packed);
    expect(unpacked.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(unpacked[i]).toBeCloseTo(original[i], 5);
    }
  });

  it("produces a buffer of length * 4 bytes", () => {
    const vec = [1, 2, 3, 4];
    const packed = packFloat32(vec);
    expect(packed.byteLength).toBe(16);
  });
});

// ─── cosineSimilarity ─────────────────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns -1 for opposing vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("returns 0 for zero-length input", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
  });
});

// ─── buildEmbedInput ─────────────────────────────────────────────────────────

describe("buildEmbedInput", () => {
  it("concatenates title, summary, and tags", () => {
    const result = buildEmbedInput({
      title: "My Title",
      summary: "My Summary",
      tags: ["typescript", "node"],
    });
    expect(result).toContain("My Title");
    expect(result).toContain("My Summary");
    expect(result).toContain("typescript node");
  });

  it("omits null/empty fields gracefully", () => {
    const result = buildEmbedInput({ title: null, summary: null, tags: [] });
    expect(result).toBe("");
  });

  it("handles tags-only input", () => {
    const result = buildEmbedInput({ title: null, summary: null, tags: ["a", "b"] });
    expect(result).toBe("a b");
  });

  it("truncates extremely long input to 8000 chars", () => {
    const longTitle = "x".repeat(9000);
    const result = buildEmbedInput({ title: longTitle, summary: null, tags: [] });
    expect(result.length).toBeLessThanOrEqual(8000);
  });
});

// ─── getEmbedding ─────────────────────────────────────────────────────────────

describe("getEmbedding", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns the embedding vector from a successful API response", async () => {
    const vector = [0.1, 0.2, 0.3];
    globalThis.fetch = mockFetch(async () => makeEmbedResponse(vector));

    const result = await getEmbedding(EMBED_CONFIG, "some text");
    expect(result).toEqual(vector);
  });

  it("throws on empty embedding vector in response", async () => {
    globalThis.fetch = mockFetch(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [] }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(getEmbedding(EMBED_CONFIG, "text")).rejects.toThrow(/no vector/i);
  });

  it("throws on missing data field in response", async () => {
    globalThis.fetch = mockFetch(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await expect(getEmbedding(EMBED_CONFIG, "text")).rejects.toThrow(/no vector/i);
  });

  it("throws on non-retryable HTTP 401", async () => {
    globalThis.fetch = mockFetch(async () =>
      new Response("Unauthorized", { status: 401 })
    );

    await expect(getEmbedding(EMBED_CONFIG, "text")).rejects.toThrow(/401/);
  });
});

// ─── EmbeddingRepository ─────────────────────────────────────────────────────

describe("EmbeddingRepository", () => {
  let db: Database;
  let repo: EmbeddingRepository;

  beforeEach(() => {
    db = makeTestDb();
    repo = new EmbeddingRepository(db);
  });

  it("upserts and retrieves an embedding", () => {
    const bookmarkId = insertBookmark(db);
    const vector = [0.1, 0.2, 0.3, 0.4];

    repo.upsert(bookmarkId, "test-model", vector);

    const record = repo.getByBookmarkId(bookmarkId);
    expect(record).not.toBeNull();
    expect(record!.bookmarkId).toBe(bookmarkId);
    expect(record!.model).toBe("test-model");
    expect(record!.dimensions).toBe(4);
    for (let i = 0; i < vector.length; i++) {
      expect(record!.vector[i]).toBeCloseTo(vector[i], 5);
    }
  });

  it("overwrites an existing embedding on upsert", () => {
    const bookmarkId = insertBookmark(db);
    repo.upsert(bookmarkId, "test-model", [1, 0]);
    repo.upsert(bookmarkId, "test-model", [0, 1]);

    const record = repo.getByBookmarkId(bookmarkId);
    expect(record!.vector[0]).toBeCloseTo(0, 5);
    expect(record!.vector[1]).toBeCloseTo(1, 5);
  });

  it("returns null for a bookmark with no embedding", () => {
    const bookmarkId = insertBookmark(db);
    expect(repo.getByBookmarkId(bookmarkId)).toBeNull();
  });

  it("exists() returns false before upsert and true after", () => {
    const bookmarkId = insertBookmark(db);
    expect(repo.exists(bookmarkId, "test-model")).toBe(false);
    repo.upsert(bookmarkId, "test-model", [1, 2, 3]);
    expect(repo.exists(bookmarkId, "test-model")).toBe(true);
  });

  it("stores float32 as packed BLOB (correct byte length)", () => {
    const bookmarkId = insertBookmark(db);
    const dims = 128;
    const vector = Array.from({ length: dims }, (_, i) => i / dims);
    repo.upsert(bookmarkId, "test-model", vector);

    const row = db.query<{ vector: Uint8Array }, [string]>(
      "SELECT vector FROM embeddings WHERE bookmark_id = ?"
    ).get(bookmarkId);
    expect(row?.vector.byteLength).toBe(dims * 4);
  });
});
