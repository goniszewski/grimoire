-- Support server-side library parity filters over existing bookmark metadata.

CREATE INDEX IF NOT EXISTS idx_bookmarks_is_pinned ON bookmarks(is_pinned);
CREATE INDEX IF NOT EXISTS idx_bookmarks_read_at ON bookmarks(read_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_opened_count ON bookmarks(opened_count);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0016');
