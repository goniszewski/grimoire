-- Migration 0005: enforce unique category names within the same parent
-- Uses COALESCE so that root-level categories (parent_id IS NULL) are
-- treated as sharing the same "null parent" bucket.

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent
  ON categories(name, COALESCE(parent_id, ''));

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0005');
