-- Migration 0018: Stop trg_bookmarks_fts_update from overwriting FTS summary
-- with bookmarks.description on every bookmark UPDATE (pin/open/status/etc).
-- That wiped LLM bookmark_content.summary tokens after migrate+ingest indexed them.
-- Title still syncs here; summary/content/tags stay owned by bookmark_content /
-- bookmark_tags triggers and explicit pipeline/migrate FTS rebuilds.

DROP TRIGGER IF EXISTS trg_bookmarks_fts_update;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_fts_update
AFTER UPDATE ON bookmarks
BEGIN
  UPDATE bookmarks_fts
  SET title = COALESCE(NEW.title, '')
  WHERE bookmark_id = OLD.id;
END;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0018');
