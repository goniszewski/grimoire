-- Migration 0002: FTS5 sync triggers for bookmark_content and bookmark_tags
-- Keeps bookmarks_fts.content, bookmarks_fts.summary, and bookmarks_fts.tags
-- up to date when related rows change.

-- ─── bookmark_content → FTS5 sync ─────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_bookmark_content_fts_insert
AFTER INSERT ON bookmark_content
BEGIN
  UPDATE bookmarks_fts
  SET summary = COALESCE(NEW.summary, ''),
      content = COALESCE(NEW.markdown, '')
  WHERE bookmark_id = NEW.bookmark_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmark_content_fts_update
AFTER UPDATE ON bookmark_content
BEGIN
  UPDATE bookmarks_fts
  SET summary = COALESCE(NEW.summary, ''),
      content = COALESCE(NEW.markdown, '')
  WHERE bookmark_id = NEW.bookmark_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmark_content_fts_delete
AFTER DELETE ON bookmark_content
BEGIN
  UPDATE bookmarks_fts
  SET summary = '', content = ''
  WHERE bookmark_id = OLD.bookmark_id;
END;

-- ─── bookmark_tags → FTS5 sync ────────────────────────────────────────────────
-- Rebuild the space-separated tag string for the affected bookmark.

CREATE TRIGGER IF NOT EXISTS trg_bookmark_tags_fts_insert
AFTER INSERT ON bookmark_tags
BEGIN
  UPDATE bookmarks_fts
  SET tags = (
    SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
    FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = NEW.bookmark_id
  )
  WHERE bookmark_id = NEW.bookmark_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmark_tags_fts_delete
AFTER DELETE ON bookmark_tags
BEGIN
  UPDATE bookmarks_fts
  SET tags = (
    SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
    FROM tags t
    JOIN bookmark_tags bt ON bt.tag_id = t.id
    WHERE bt.bookmark_id = OLD.bookmark_id
  )
  WHERE bookmark_id = OLD.bookmark_id;
END;

-- Record this migration as applied
INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0002');
