-- Add personal notes field to bookmarks table.
-- Notes are user-authored Markdown text, separate from the AI-generated summary.

ALTER TABLE bookmarks ADD COLUMN notes TEXT;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0008');
