import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listMigrationFiles } from "../db/migrations.js";

describe("migration discovery", () => {
  it("ignores macOS AppleDouble sidecar files and other non-migration SQL files", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "little-imp-migrations-"));

    try {
      const migrationsDir = join(tempRoot, "migrations");
      await mkdir(migrationsDir);
      await writeFile(join(migrationsDir, "0001_initial.sql"), "SELECT 1;\n");
      await writeFile(join(migrationsDir, "._0001_initial.sql"), "AppleDouble metadata\n");
      await writeFile(join(migrationsDir, "0002_next.sql"), "SELECT 2;\n");
      await writeFile(join(migrationsDir, "notes.sql"), "SELECT 3;\n");
      await writeFile(join(migrationsDir, ".DS_Store"), "metadata\n");

      expect(listMigrationFiles(migrationsDir)).toEqual(["0001_initial.sql", "0002_next.sql"]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
