-- Migration 0014: local bookmark media cache metadata

CREATE TABLE IF NOT EXISTS bookmark_media (
  id            TEXT PRIMARY KEY,
  bookmark_id   TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('favicon','screenshot','image')),
  source_url    TEXT NOT NULL,
  cache_path    TEXT NOT NULL UNIQUE,
  media_type    TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL CHECK (size_bytes >= 0),
  alt           TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmark_media_bookmark
  ON bookmark_media(bookmark_id, kind, display_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmark_media_source
  ON bookmark_media(bookmark_id, kind, source_url);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0014');
