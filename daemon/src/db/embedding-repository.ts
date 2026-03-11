/**
 * Repository for the `embeddings` table.
 * Vectors are stored as packed float32 little-endian BLOBs.
 */

import { Database } from "bun:sqlite";
import { EmbeddingRow } from "./types.js";
import { packFloat32, unpackFloat32 } from "../ai/embeddings.js";

export interface EmbeddingRecord {
  bookmarkId: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt: string;
}

export class EmbeddingRepository {
  constructor(private db: Database) {}

  /** Upsert an embedding for a bookmark. */
  upsert(bookmarkId: string, model: string, vector: number[]): void {
    const blob = packFloat32(vector);
    this.db.run(
      `INSERT INTO embeddings (bookmark_id, model, dimensions, vector)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(bookmark_id) DO UPDATE SET
         model      = excluded.model,
         dimensions = excluded.dimensions,
         vector     = excluded.vector,
         created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      [bookmarkId, model, vector.length, blob]
    );
  }

  /** Get embedding for a single bookmark, or null if not present. */
  getByBookmarkId(bookmarkId: string): EmbeddingRecord | null {
    const row = this.db
      .query<EmbeddingRow, [string]>(
        "SELECT * FROM embeddings WHERE bookmark_id = ?"
      )
      .get(bookmarkId);

    if (!row) return null;
    return {
      bookmarkId: row.bookmark_id,
      model: row.model,
      dimensions: row.dimensions,
      vector: unpackFloat32(row.vector),
      createdAt: row.created_at,
    };
  }

  /**
   * Load all embeddings for a given model.
   * Used for in-process cosine similarity search.
   * For very large libraries (>100k bookmarks) this would need pagination,
   * but is fine for the expected scale of a personal bookmark manager.
   */
  getAllForModel(model: string): EmbeddingRecord[] {
    const rows = this.db
      .query<EmbeddingRow, [string]>(
        "SELECT * FROM embeddings WHERE model = ?"
      )
      .all(model);

    return rows.map((row) => ({
      bookmarkId: row.bookmark_id,
      model: row.model,
      dimensions: row.dimensions,
      vector: unpackFloat32(row.vector),
      createdAt: row.created_at,
    }));
  }

  /** Check whether a bookmark already has an embedding for the given model. */
  exists(bookmarkId: string, model: string): boolean {
    const row = this.db
      .query<{ c: number }, [string, string]>(
        "SELECT COUNT(*) AS c FROM embeddings WHERE bookmark_id = ? AND model = ?"
      )
      .get(bookmarkId, model);
    return (row?.c ?? 0) > 0;
  }
}
