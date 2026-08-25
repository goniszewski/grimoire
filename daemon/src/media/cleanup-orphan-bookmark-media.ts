import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";

/**
 * Remove media-cache/bookmarks/<id> directories with no matching bookmarks row.
 * Clears crash-window orphans after migrate rollback and on daemon open.
 */
export function cleanupOrphanBookmarkMedia(db: Database, dataDir: string): void {
  const cacheRoot = join(dataDir, "media-cache", "bookmarks");
  if (!existsSync(cacheRoot)) return;
  let entries: string[];
  try {
    entries = readdirSync(cacheRoot);
  } catch {
    return;
  }
  const existsStmt = db.query<{ ok: number }, [string]>(
    "SELECT 1 AS ok FROM bookmarks WHERE id = ? LIMIT 1"
  );
  for (const id of entries) {
    if (!id || id.startsWith(".")) continue;
    if (existsStmt.get(id)) continue;
    try {
      rmSync(join(cacheRoot, id), { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}
