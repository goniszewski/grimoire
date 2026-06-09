/**
 * Shared test helper: opens an in-memory SQLite database and runs all
 * migrations against it, giving each test suite a clean, fully-migrated DB.
 */

import { Database } from "bun:sqlite";
import { EmbeddingRepository } from "../../db/embedding-repository.js";
import { runMigrations } from "../../db/migrations.js";
import { configureSqliteForVectorExtensions } from "../../db/sqlite-vec.js";

export function makeTestDb(): Database {
  configureSqliteForVectorExtensions();
  const db = new Database(":memory:");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  runMigrations(db);
  new EmbeddingRepository(db).rebuildVectorIndex();
  return db;
}
