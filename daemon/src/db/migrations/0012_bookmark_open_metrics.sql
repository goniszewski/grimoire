-- Track user-triggered bookmark opens for parity with Grimoire open metrics.

ALTER TABLE bookmarks ADD COLUMN opened_count INTEGER NOT NULL DEFAULT 0 CHECK (opened_count >= 0);
ALTER TABLE bookmarks ADD COLUMN last_opened_at TEXT;

CREATE INDEX IF NOT EXISTS idx_bookmarks_last_opened_at ON bookmarks(last_opened_at);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0012');
