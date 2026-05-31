-- Add a first-class read-later flag separate from pinned/starred state.
-- Existing pinned bookmarks keep their meaning; read_later defaults to off.

ALTER TABLE bookmarks ADD COLUMN read_later INTEGER NOT NULL DEFAULT 0 CHECK (read_later IN (0,1));

CREATE INDEX IF NOT EXISTS idx_bookmarks_read_later ON bookmarks(read_later);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0011');
