-- Revisit state stays separate from bookmark modification timestamps.
CREATE TABLE IF NOT EXISTS revisit_bookmarks (
  bookmark_id TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  later_added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  available_after TEXT,
  last_presented_at TEXT
);

CREATE TABLE IF NOT EXISTS revisit_pass (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id TEXT NOT NULL UNIQUE REFERENCES bookmarks(id) ON DELETE CASCADE,
  presented INTEGER NOT NULL DEFAULT 0 CHECK (presented IN (0, 1))
);

CREATE TABLE IF NOT EXISTS revisit_round (
  id TEXT PRIMARY KEY,
  item_ids TEXT NOT NULL,
  decisions TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  last_undo TEXT
);

CREATE INDEX IF NOT EXISTS idx_revisit_pass_pending ON revisit_pass(presented, sequence);
CREATE INDEX IF NOT EXISTS idx_revisit_bookmarks_available ON revisit_bookmarks(available_after);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0021');
