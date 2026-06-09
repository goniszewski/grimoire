import { describe, expect, it } from "bun:test";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { EmbeddingRepository } from "../db/embedding-repository.js";
import { makeTestDb } from "./helpers/db.js";

describe("EmbeddingRepository vector index", () => {
  it("dual-writes embeddings into a sqlite-vec table for their dimensions when available", () => {
    const db = makeTestDb();
    const bookmarks = new BookmarkRepository(db);
    const embeddings = new EmbeddingRepository(db);

    const vectorIndexAvailable = embeddings.isVectorIndexAvailable(2);
    if (!vectorIndexAvailable) {
      expect(vectorIndexAvailable).toBe(false);
      return;
    }

    const first = bookmarks.create("https://vectors.example.com/first", "First vector");
    const second = bookmarks.create("https://vectors.example.com/second", "Second vector");

    embeddings.upsert(first.id, "test-model", [1, 0]);
    embeddings.upsert(second.id, "test-model", [0, 1]);

    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'embedding_vec_2'"
      )
      .all();
    expect(tables.map((row) => row.name)).toEqual(["embedding_vec_2"]);

    const indexedRows = db
      .query<{ bookmark_id: string; model: string }, []>(
        "SELECT bookmark_id, model FROM embedding_vec_2 ORDER BY bookmark_id"
      )
      .all();
    const byBookmarkId = (
      left: { bookmark_id: string },
      right: { bookmark_id: string }
    ) => left.bookmark_id.localeCompare(right.bookmark_id);
    expect([...indexedRows].sort(byBookmarkId)).toEqual([
      { bookmark_id: first.id, model: "test-model" },
      { bookmark_id: second.id, model: "test-model" },
    ].sort(byBookmarkId));
  });

  it("returns nearest neighbors from sqlite-vec with cosine similarity scores when available", () => {
    const db = makeTestDb();
    const bookmarks = new BookmarkRepository(db);
    const embeddings = new EmbeddingRepository(db);

    const vectorIndexAvailable = embeddings.isVectorIndexAvailable(2);
    if (!vectorIndexAvailable) {
      expect(vectorIndexAvailable).toBe(false);
      return;
    }

    const close = bookmarks.create("https://vectors.example.com/close", "Close vector");
    const far = bookmarks.create("https://vectors.example.com/far", "Far vector");

    embeddings.upsert(close.id, "test-model", [1, 0]);
    embeddings.upsert(far.id, "test-model", [0, 1]);

    const nearest = embeddings.findNearest("test-model", [0.98, 0.02], {
      limit: 2,
      excludeBookmarkId: null,
    });

    expect(nearest.map((row) => row.bookmarkId)).toEqual([close.id, far.id]);
    expect(nearest[0].score).toBeGreaterThan(nearest[1].score);
    expect(nearest[0].score).toBeGreaterThan(0.99);
  });

  it("excludes archived and trashed bookmarks from vector-indexed nearest neighbors when available", () => {
    const db = makeTestDb();
    const bookmarks = new BookmarkRepository(db);
    const embeddings = new EmbeddingRepository(db);

    const vectorIndexAvailable = embeddings.isVectorIndexAvailable(2);
    if (!vectorIndexAvailable) {
      expect(vectorIndexAvailable).toBe(false);
      return;
    }

    const active = bookmarks.create("https://vectors.example.com/active", "Active vector");
    const far = bookmarks.create("https://vectors.example.com/far-active", "Far active vector");
    const archived = bookmarks.create("https://vectors.example.com/archived", "Archived vector");
    const trashed = bookmarks.create("https://vectors.example.com/trashed", "Trashed vector");

    embeddings.upsert(active.id, "test-model", [0.95, 0.05]);
    embeddings.upsert(far.id, "test-model", [0, 1]);
    embeddings.upsert(archived.id, "test-model", [1, 0]);
    embeddings.upsert(trashed.id, "test-model", [0.99, 0.01]);
    bookmarks.update(archived.id, { is_archived: 1 });
    bookmarks.softDelete(trashed.id);

    const nearest = embeddings.findNearest("test-model", [1, 0], {
      limit: 2,
      excludeBookmarkId: null,
    });

    expect(nearest.map((row) => row.bookmarkId)).toEqual([active.id, far.id]);
  });

  it("keeps the durable embedding when the derived vector mirror cannot be written", () => {
    const db = makeTestDb();
    const bookmarks = new BookmarkRepository(db);
    const embeddings = new EmbeddingRepository(db);
    const bookmark = bookmarks.create("https://vectors.example.com/fallback", "Fallback vector");

    db.exec("CREATE TABLE embedding_vec_2 (bookmark_id TEXT PRIMARY KEY)");

    expect(() => embeddings.upsert(bookmark.id, "test-model", [1, 0])).not.toThrow();
    expect(embeddings.getByBookmarkId(bookmark.id)?.vector).toEqual([1, 0]);

    const nearest = embeddings.findNearest("test-model", [1, 0], {
      limit: 1,
      excludeBookmarkId: null,
    });
    expect(nearest.map((row) => row.bookmarkId)).toEqual([bookmark.id]);
  });
});
