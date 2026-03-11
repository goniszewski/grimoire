-- Migration 0003: Fix trg_bookmarks_fts_update to preserve content/tags/summary
-- The 0001 trigger used DELETE+INSERT which reset content, tags, and summary to ''
-- on every bookmark UPDATE (e.g. status changes). Replace it with an in-place UPDATE
-- that only refreshes title and summary from the bookmark row itself, leaving the
-- content and tags columns (managed by 0002 triggers) untouched.

DROP TRIGGER IF EXISTS trg_bookmarks_fts_update;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_fts_update
AFTER UPDATE ON bookmarks
BEGIN
  UPDATE bookmarks_fts
  SET title   = COALESCE(NEW.title, ''),
      summary = COALESCE(NEW.description, '')
  WHERE bookmark_id = OLD.id;
END;

-- Record this migration as applied
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0003');
