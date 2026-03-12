-- Migration 0004: extend agent_suggestions for multi-bookmark suggestion types
-- Makes bookmark_id nullable (category-level suggestions have no single bookmark)
-- and adds a metadata JSON column for structured context (affected IDs, etc.)

-- SQLite does not support ALTER COLUMN, so we recreate the table.
CREATE TABLE IF NOT EXISTS agent_suggestions_new (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE CASCADE,  -- nullable
  type        TEXT NOT NULL,
  value       TEXT NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',  -- JSON: affected ids, category info, etc.
  confidence  REAL,
  status      TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved_at TEXT
);

INSERT INTO agent_suggestions_new
  (id, bookmark_id, type, value, metadata, confidence, status, created_at, resolved_at)
SELECT
  id, bookmark_id, type, value, '{}', confidence, status, created_at, resolved_at
FROM agent_suggestions;

DROP TABLE agent_suggestions;
ALTER TABLE agent_suggestions_new RENAME TO agent_suggestions;

CREATE INDEX IF NOT EXISTS idx_suggestions_bookmark ON agent_suggestions(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status   ON agent_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_type     ON agent_suggestions(type);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0004');
