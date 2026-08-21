import type { Database } from "bun:sqlite";

/**
 * Ensure the bookmarks.updated_at auto-touch trigger exists with the real body.
 * Always DROP+CREATE so a crash mid-migrate cannot leave a missing or no-op
 * trigger in place until the next openDatabase/boot.
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

/**
 * Install a no-op updated_at trigger so legacy migrate can write historical
 * timestamps. Prefer this over leaving the trigger absent across a crash window.
 */
export function installBookmarksUpdatedAtPassthrough(db: Database): void {
  db.exec(`DROP TRIGGER IF EXISTS trg_bookmarks_updated_at`);
  db.exec(`
CREATE TRIGGER trg_bookmarks_updated_at
AFTER UPDATE ON bookmarks
FOR EACH ROW
BEGIN
  SELECT 1;
END;
`);
}
