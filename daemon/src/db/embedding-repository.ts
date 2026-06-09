/**
 * Repository for the `embeddings` table.
 * Vectors are stored as packed float32 little-endian BLOBs.
 */

import { Database } from "bun:sqlite";
import { EmbeddingRow } from "./types.js";
import { cosineSimilarity, packFloat32, unpackFloat32 } from "../ai/embeddings.js";
import {
  disableSqliteVecForDatabase,
  isVectorTableName,
  loadSqliteVec,
  vectorTableName,
} from "./sqlite-vec.js";

export interface EmbeddingRecord {
  bookmarkId: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt: string;
}

export interface NearestEmbeddingRecord {
  bookmarkId: string;
  score: number;
  distance: number;
}

export interface FindNearestEmbeddingOptions {
  limit: number;
  offset?: number;
  excludeBookmarkId?: string | null;
  allowedIds?: Set<string>;
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
    this.upsertVectorIndex(bookmarkId, model, vector.length, blob);
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
        `SELECT e.* FROM embeddings e
         JOIN bookmarks b ON b.id = e.bookmark_id
         WHERE e.model = ? AND b.is_archived = 0 AND b.is_trashed = 0`
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

  countForModel(model: string): number {
    return (
      this.db
        .query<{ count: number }, [string]>(
          `SELECT COUNT(*) AS count FROM embeddings e
           JOIN bookmarks b ON b.id = e.bookmark_id
           WHERE e.model = ? AND b.is_archived = 0 AND b.is_trashed = 0`
        )
        .get(model)?.count ?? 0
    );
  }

  isVectorIndexAvailable(dimensions?: number): boolean {
    if (!loadSqliteVec(this.db)) return false;
    if (dimensions === undefined) return true;
    return this.ensureVectorTable(dimensions);
  }

  rebuildVectorIndex(): void {
    if (!loadSqliteVec(this.db)) return;

    try {
      const rows = this.db
        .query<EmbeddingRow, []>("SELECT * FROM embeddings")
        .all();

      for (const table of this.listVectorTables()) {
        this.db.run(`DELETE FROM ${table}`);
      }
      for (const row of rows) {
        this.upsertVectorIndex(row.bookmark_id, row.model, row.dimensions, row.vector);
      }
    } catch (error) {
      this.disableVectorIndex(error);
    }
  }

  findNearest(
    model: string,
    vector: number[],
    options: FindNearestEmbeddingOptions
  ): NearestEmbeddingRecord[] {
    const limit = Math.max(0, options.limit);
    if (limit === 0 || vector.length === 0) return [];

    const offset = Math.max(0, options.offset ?? 0);
    const indexed = this.findNearestWithVectorIndex(model, vector, {
      ...options,
      limit: limit + offset,
      offset: 0,
    });
    const ranked = indexed ?? this.findNearestWithBlobScan(model, vector, {
      ...options,
      limit: limit + offset,
      offset: 0,
    });
    return ranked.slice(offset, offset + limit);
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

  private upsertVectorIndex(
    bookmarkId: string,
    model: string,
    dimensions: number,
    vectorBlob: Uint8Array
  ): void {
    if (!this.ensureVectorTable(dimensions)) return;

    try {
      const tables = this.listVectorTables();
      if (!loadSqliteVec(this.db)) return;

      const table = vectorTableName(dimensions);
      this.db.transaction(() => {
        for (const existingTable of tables) {
          this.db.run(`DELETE FROM ${existingTable} WHERE bookmark_id = ?`, [bookmarkId]);
        }
        this.db
          .query<unknown, [string, string, Uint8Array]>(
            `INSERT INTO ${table} (bookmark_id, model, embedding)
             VALUES (?, ?, ?)`
          )
          .run(bookmarkId, model, vectorBlob);
      })();
    } catch (error) {
      this.disableVectorIndex(error);
    }
  }

  private ensureVectorTable(dimensions: number): boolean {
    if (!loadSqliteVec(this.db)) return false;
    try {
      const table = vectorTableName(dimensions);
      this.db.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${table} USING vec0(
          bookmark_id TEXT PRIMARY KEY,
          model TEXT PARTITION KEY,
          embedding FLOAT[${dimensions}] distance_metric=cosine
        )`
      );
      return true;
    } catch (error) {
      this.disableVectorIndex(error);
      return false;
    }
  }

  private listVectorTables(): string[] {
    if (!loadSqliteVec(this.db)) return [];
    try {
      return this.db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name LIKE 'embedding_vec_%'`
        )
        .all()
        .map((row) => row.name)
        .filter(isVectorTableName);
    } catch (error) {
      this.disableVectorIndex(error);
      return [];
    }
  }

  private findNearestWithVectorIndex(
    model: string,
    vector: number[],
    options: FindNearestEmbeddingOptions
  ): NearestEmbeddingRecord[] | null {
    try {
      const dimensions = vector.length;
      if (!this.ensureVectorTable(dimensions)) return null;

      if (options.allowedIds?.size === 0) return [];

      const table = vectorTableName(dimensions);
      const modelCount =
        this.db
          .query<{ count: number }, [string]>(
            `SELECT COUNT(*) AS count FROM ${table} WHERE model = ?`
          )
          .get(model)?.count ?? 0;
      if (modelCount === 0) return [];

      const queryBlob = packFloat32(vector);
      let k = options.allowedIds
        ? modelCount
        : Math.min(
            modelCount,
            Math.max(1, options.limit + (options.excludeBookmarkId ? 1 : 0))
          );

      while (true) {
        const rows = this.db
          .query<{ bookmark_id: string; distance: number }, [Uint8Array, string, number]>(
            `SELECT nearest.bookmark_id, nearest.distance
             FROM (
               SELECT bookmark_id, distance
               FROM ${table}
               WHERE embedding MATCH ? AND model = ? AND k = ?
               ORDER BY distance
             ) nearest
             JOIN bookmarks b ON b.id = nearest.bookmark_id
             WHERE b.is_archived = 0 AND b.is_trashed = 0
             ORDER BY nearest.distance`
          )
          .all(queryBlob, model, k);

        const ranked = rows
          .filter((row) => row.bookmark_id !== options.excludeBookmarkId)
          .filter((row) => !options.allowedIds || options.allowedIds.has(row.bookmark_id))
          .map((row) => ({
            bookmarkId: row.bookmark_id,
            distance: row.distance,
            score: 1 - row.distance,
          }));

        if (ranked.length >= options.limit || k >= modelCount) {
          return ranked.slice(0, options.limit);
        }

        k = Math.min(modelCount, Math.max(k + 1, k * 2));
      }
    } catch (error) {
      this.disableVectorIndex(error);
      return null;
    }
  }

  private findNearestWithBlobScan(
    model: string,
    vector: number[],
    options: FindNearestEmbeddingOptions
  ): NearestEmbeddingRecord[] {
    return this.getAllForModel(model)
      .filter((record) => record.bookmarkId !== options.excludeBookmarkId)
      .filter((record) => !options.allowedIds || options.allowedIds.has(record.bookmarkId))
      .map((record) => {
        const score = cosineSimilarity(vector, record.vector);
        return { bookmarkId: record.bookmarkId, score, distance: 1 - score };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit);
  }

  private disableVectorIndex(error: unknown): void {
    disableSqliteVecForDatabase(
      this.db,
      error instanceof Error ? error.message : String(error)
    );
  }
}
