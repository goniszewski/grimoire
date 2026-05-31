-- Migration 0013: category metadata fields for Grimoire parity.

ALTER TABLE categories ADD COLUMN color TEXT;
ALTER TABLE categories ADD COLUMN icon TEXT;
ALTER TABLE categories ADD COLUMN description TEXT;
ALTER TABLE categories ADD COLUMN slug TEXT COLLATE NOCASE;
ALTER TABLE categories ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1));
ALTER TABLE categories ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0,1));

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique
ON categories(slug)
WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categories_is_archived ON categories(is_archived);
CREATE INDEX IF NOT EXISTS idx_categories_is_public ON categories(is_public);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0013');
