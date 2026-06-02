-- Migration 0017: local integration capture metadata.

CREATE TABLE IF NOT EXISTS bookmark_capture_metadata (
  bookmark_id   TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  source_client TEXT,
  source_url    TEXT,
  referrer_url  TEXT,
  selected_text TEXT,
  captured_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TRIGGER IF NOT EXISTS trg_bookmark_capture_metadata_updated_at
AFTER UPDATE ON bookmark_capture_metadata
FOR EACH ROW
BEGIN
  UPDATE bookmark_capture_metadata
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE bookmark_id = NEW.bookmark_id;
END;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0017');
