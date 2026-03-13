-- Add trashed_at timestamp so the purge job can enforce the 30-day retention window.
-- Backfill existing trashed rows with a placeholder date so they are eventually purged.

ALTER TABLE bookmarks ADD COLUMN trashed_at TEXT;

-- Backfill rows already in the trash; use the current time as the trashed date.
UPDATE bookmarks SET trashed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE is_trashed = 1 AND trashed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_trashed_at ON bookmarks(trashed_at);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0007');
