import type { Database } from "bun:sqlite";

/**
 * Ensure the bookmarks.updated_at auto-touch trigger exists.
 * Legacy migrate temporarily drops it inside its write transaction and restores
 * it before commit; daemon boot also repairs databases left by older versions.
 */
export function ensureBookmarksUpdatedAtTrigger(db: Database): void {
  db.exec(`DROP TRIGGER IF EXISTS trg_bookmarks_updated_at`);
  db.exec(`
CREATE TRIGGER trg_bookmarks_updated_at
AFTER UPDATE ON bookmarks
FOR EACH ROW
BEGIN
  UPDATE bookmarks SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE id = NEW.id;
END;
`);
}
