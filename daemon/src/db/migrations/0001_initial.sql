-- Migration 0001: initial schema
-- Run once; guarded by schema_migrations table.
-- Note: connection-scoped PRAGMAs (foreign_keys, journal_mode) are set in
-- database.ts before migrations run — they cannot be set inside a transaction
-- and do not belong in migration files.

-- ─── Migration tracking ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Categories ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL,
  parent_id  TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- ─── Bookmarks ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookmarks (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  url         TEXT NOT NULL UNIQUE,
  domain      TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  -- saved | fetched | extracted | ai_enriched | indexed
  status      TEXT NOT NULL DEFAULT 'saved'
                   CHECK (status IN ('saved','fetched','extracted','ai_enriched','indexed')),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  favicon_url TEXT,
  screenshot_url TEXT,
  is_pinned   INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
  read_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_domain      ON bookmarks(domain);
CREATE INDEX IF NOT EXISTS idx_bookmarks_status      ON bookmarks(status);
CREATE INDEX IF NOT EXISTS idx_bookmarks_category    ON bookmarks(category_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created     ON bookmarks(created_at);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_archived ON bookmarks(is_archived);

-- ─── Bookmark content ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookmark_content (
  bookmark_id    TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  raw_html       TEXT,
  markdown       TEXT,
  summary        TEXT,
  author         TEXT,
  published_at   TEXT,
  word_count     INTEGER,
  language       TEXT,
  extracted_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── Tags ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tags (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
  PRIMARY KEY (bookmark_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);

-- ─── Jobs ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type        TEXT NOT NULL,
  -- pending | running | done | failed
  status      TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','done','failed')),
  payload     TEXT NOT NULL DEFAULT '{}',   -- JSON
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  started_at  TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status  ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);

-- ─── Agent suggestions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_suggestions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'category' | 'tag' | 'title' | ...
  value       TEXT NOT NULL,
  confidence  REAL,
  -- pending | accepted | rejected
  status      TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_suggestions_bookmark ON agent_suggestions(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status   ON agent_suggestions(status);

-- ─── Timeline events ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS timeline_events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  bookmark_id TEXT REFERENCES bookmarks(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,   -- 'created' | 'status_changed' | 'tagged' | ...
  payload     TEXT NOT NULL DEFAULT '{}',   -- JSON diff / metadata
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_timeline_bookmark ON timeline_events(bookmark_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created  ON timeline_events(created_at);

-- ─── Embeddings ──────────────────────────────────────────────────────────────
-- sqlite-vec requires dynamic extension loading which Bun's bundled SQLite
-- does not support. The table below stores serialised float32 vectors as BLOBs
-- for forward-compatibility. When Bun gains extension support (or we switch to
-- a custom build), replace this with a vec0 virtual table.

CREATE TABLE IF NOT EXISTS embeddings (
  bookmark_id TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  model       TEXT NOT NULL,
  dimensions  INTEGER NOT NULL,
  vector      BLOB NOT NULL,   -- packed float32 little-endian
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ─── updated_at auto-update triggers ────────────────────────────────────────
-- DEFAULT only fires on INSERT; these triggers keep updated_at current on UPDATE.

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_updated_at
AFTER UPDATE ON bookmarks
FOR EACH ROW
BEGIN
  UPDATE bookmarks SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW
BEGIN
  UPDATE categories SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE id = NEW.id;
END;

-- ─── FTS5 full-text search ───────────────────────────────────────────────────

-- FTS5 with explicit rowid tracking via bookmark_id.
-- We do NOT use content='' (contentless) because we need bookmark_id
-- to be retrievable from MATCH results without a join on rowid.
-- The trade-off is slight storage duplication vs query simplicity.

CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
  bookmark_id UNINDEXED,
  title,
  summary,
  tags,
  content,
  tokenize='unicode61 remove_diacritics 1'
);

-- Triggers keep the FTS index in sync with bookmarks + bookmark_content.
-- Tags are stored as a space-separated string (updated separately when tags change).

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_fts_insert
AFTER INSERT ON bookmarks
BEGIN
  INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
  VALUES (NEW.id, COALESCE(NEW.title,''), COALESCE(NEW.description,''), '', '');
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_fts_update
AFTER UPDATE ON bookmarks
BEGIN
  DELETE FROM bookmarks_fts WHERE bookmark_id = OLD.id;
  INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
  VALUES (NEW.id, COALESCE(NEW.title,''), COALESCE(NEW.description,''), '', '');
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_fts_delete
AFTER DELETE ON bookmarks
BEGIN
  DELETE FROM bookmarks_fts WHERE bookmark_id = OLD.id;
END;

-- Record this migration as applied
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0001');
