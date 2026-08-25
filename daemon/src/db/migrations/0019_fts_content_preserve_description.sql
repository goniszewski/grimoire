-- Migration 0019: bookmark_content FTS triggers must not drop bookmarks.description
-- from search when summary is null/blank (common after migrate + partial extract).

DROP TRIGGER IF EXISTS trg_bookmark_content_fts_insert;
DROP TRIGGER IF EXISTS trg_bookmark_content_fts_update;

CREATE TRIGGER IF NOT EXISTS trg_bookmark_content_fts_insert
AFTER INSERT ON bookmark_content
BEGIN
  UPDATE bookmarks_fts
  SET summary = CASE
        WHEN NEW.summary IS NOT NULL AND trim(NEW.summary) != ''
             AND (SELECT description FROM bookmarks WHERE id = NEW.bookmark_id) IS NOT NULL
             AND trim(COALESCE((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id), '')) != ''
             AND instr(NEW.summary, (SELECT description FROM bookmarks WHERE id = NEW.bookmark_id)) = 0
             AND instr((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id), NEW.summary) = 0
          THEN trim((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id) || ' ' || NEW.summary)
        WHEN NEW.summary IS NOT NULL AND trim(NEW.summary) != ''
          THEN trim(NEW.summary)
        ELSE COALESCE((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id), '')
      END,
      content = COALESCE(NEW.markdown, '')
  WHERE bookmark_id = NEW.bookmark_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmark_content_fts_update
AFTER UPDATE ON bookmark_content
BEGIN
  UPDATE bookmarks_fts
  SET summary = CASE
        WHEN NEW.summary IS NOT NULL AND trim(NEW.summary) != ''
             AND (SELECT description FROM bookmarks WHERE id = NEW.bookmark_id) IS NOT NULL
             AND trim(COALESCE((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id), '')) != ''
             AND instr(NEW.summary, (SELECT description FROM bookmarks WHERE id = NEW.bookmark_id)) = 0
             AND instr((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id), NEW.summary) = 0
          THEN trim((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id) || ' ' || NEW.summary)
        WHEN NEW.summary IS NOT NULL AND trim(NEW.summary) != ''
          THEN trim(NEW.summary)
        ELSE COALESCE((SELECT description FROM bookmarks WHERE id = NEW.bookmark_id), '')
      END,
      content = COALESCE(NEW.markdown, '')
  WHERE bookmark_id = NEW.bookmark_id;
END;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0019');
