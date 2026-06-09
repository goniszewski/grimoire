import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import * as sqliteVec from "sqlite-vec";
import { log } from "../logger.js";

const VECTOR_TABLE_PREFIX = "embedding_vec_";
const VECTOR_TABLE_PATTERN = new RegExp(`^${VECTOR_TABLE_PREFIX}\\d+$`);

let customSqliteConfigured = false;
const sqliteVecLoaded = new WeakSet<Database>();
const sqliteVecUnavailable = new WeakMap<Database, string>();

export function configureSqliteForVectorExtensions(): void {
  if (process.env.LITTLEIMP_DISABLE_SQLITE_VEC === "1") return;
  if (customSqliteConfigured) return;

  const candidates = [
    process.env.LITTLEIMP_SQLITE_LIBRARY,
    "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib",
    "/usr/local/opt/sqlite/lib/libsqlite3.dylib",
    "/usr/local/opt/sqlite3/lib/libsqlite3.dylib",
  ].filter((path): path is string => Boolean(path));

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      Database.setCustomSQLite(candidate);
      log.info("Configured custom SQLite library for sqlite-vec", { path: candidate });
      break;
    } catch (error) {
      log.warn("Failed to configure custom SQLite library for sqlite-vec", {
        path: candidate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  customSqliteConfigured = true;
}

export function loadSqliteVec(db: Database): boolean {
  if (process.env.LITTLEIMP_DISABLE_SQLITE_VEC === "1") return false;
  if (sqliteVecLoaded.has(db)) return true;
  if (sqliteVecUnavailable.has(db)) return false;

  try {
    sqliteVec.load(db);
    const version = db.query<{ version: string }, []>("SELECT vec_version() AS version").get()?.version;
    sqliteVecLoaded.add(db);
    log.info("sqlite-vec loaded", { version });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sqliteVecUnavailable.set(db, message);
    log.warn("sqlite-vec unavailable; falling back to BLOB vector scans", { error: message });
    return false;
  }
}

export function disableSqliteVecForDatabase(db: Database, reason: string): void {
  if (sqliteVecUnavailable.has(db)) return;
  sqliteVecLoaded.delete(db);
  sqliteVecUnavailable.set(db, reason);
  log.warn("sqlite-vec disabled for this database; falling back to BLOB vector scans", {
    error: reason,
  });
}

export function vectorTableName(dimensions: number): string {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(`Invalid vector dimensions: ${dimensions}`);
  }
  return `${VECTOR_TABLE_PREFIX}${dimensions}`;
}

export function isVectorTableName(name: string): boolean {
  return VECTOR_TABLE_PATTERN.test(name);
}
