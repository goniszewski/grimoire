-- Migration 0020: retain the origin of imported bookmark data for reprocessing.

CREATE TABLE IF NOT EXISTS bookmark_provenance (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (bookmark_id, source)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_provenance_source
  ON bookmark_provenance(source);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0020');
