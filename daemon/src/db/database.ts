import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { join } from "path";
import { Config } from "../config.js";
import { log } from "../logger.js";
import { runMigrations } from "./migrations.js";

let _db: Database | null = null;

/** Open (or return cached) the application SQLite database. */
export function getDatabase(): Database {
  if (_db) return _db;

  mkdirSync(Config.DATA_DIR, { recursive: true });
  const dbPath = join(Config.DATA_DIR, "littleimp.db");

  log.info("Opening database", { path: dbPath });
  const db = new Database(dbPath, { create: true });

  // Performance pragmas (WAL is set in migration but set here too for safety)
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA cache_size = -8000"); // 8 MB page cache
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA recursive_triggers = OFF"); // guard against updated_at trigger recursion

  runMigrations(db);

  _db = db;
  log.info("Database ready", { path: dbPath });
  return db;
}

/** Close the database connection (call during graceful shutdown). */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    log.info("Database closed");
  }
}
