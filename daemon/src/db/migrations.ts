import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { log } from "../logger.js";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");
const MIGRATION_FILE_PATTERN = /^\d{4}_.+\.sql$/;

export function listMigrationFiles(migrationsDir: string = MIGRATIONS_DIR): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => MIGRATION_FILE_PATTERN.test(file))
    .sort(); // lexicographic -> 0001, 0002, ...
}

/** Apply all pending SQL migration files in version order. */
export function runMigrations(db: Database): void {
  // Ensure the tracking table exists before we query it
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  const applied = new Set<string>(
    db
      .query<{ version: string }, []>("SELECT version FROM schema_migrations")
      .all()
      .map((r) => r.version)
  );

  const files = listMigrationFiles();

  for (const file of files) {
    const version = file.split("_")[0]; // e.g. "0001"
    if (applied.has(version)) {
      log.info("Migration already applied, skipping", { version, file });
      continue;
    }

    log.info("Applying migration", { version, file });
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");

    // Each migration file runs as a single transaction
    db.transaction(() => {
      db.exec(sql);
    })();

    log.info("Migration applied", { version });
  }
}
