-- Separate soft-delete (trash) from user-archive.
-- is_archived: user explicitly archived the bookmark (still accessible via /archive)
-- is_trashed:  user deleted the bookmark (hidden everywhere; future trash/restore feature)

ALTER TABLE bookmarks ADD COLUMN is_trashed INTEGER NOT NULL DEFAULT 0 CHECK (is_trashed IN (0,1));

CREATE INDEX IF NOT EXISTS idx_bookmarks_is_trashed ON bookmarks(is_trashed);

-- Migrate existing soft-deleted rows: rows where is_archived=1 that were set by the
-- old softDelete() path are moved to is_trashed=1, is_archived=0.
-- Because the old system used is_archived=1 for both delete and archive, we cannot
-- distinguish them retroactively, so we treat all existing is_archived=1 rows as trashed.
UPDATE bookmarks SET is_trashed = 1, is_archived = 0 WHERE is_archived = 1;
