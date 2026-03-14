-- Separate soft-delete (trash) from user-archive.
-- is_archived: user explicitly archived the bookmark (still accessible via /archive)
-- is_trashed:  user deleted the bookmark (hidden everywhere; future trash/restore feature)

ALTER TABLE bookmarks ADD COLUMN is_trashed INTEGER NOT NULL DEFAULT 0 CHECK (is_trashed IN (0,1));

CREATE INDEX IF NOT EXISTS idx_bookmarks_is_trashed ON bookmarks(is_trashed);

-- No data migration needed: existing is_archived=1 rows are user archives and must be
-- preserved. The old softDelete() path (is_archived=1 as delete) was replaced by
-- TASK-022 before any production data existed. Existing rows remain as archives and
-- will correctly appear on the /archive page (is_archived=1, is_trashed=0).

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0006');
