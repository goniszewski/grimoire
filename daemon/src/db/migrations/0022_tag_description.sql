-- Migration 0022: optional free-text description for tags (mirrors categories.description).

ALTER TABLE tags ADD COLUMN description TEXT;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0022');
