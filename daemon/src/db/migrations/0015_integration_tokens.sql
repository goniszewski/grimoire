-- Migration 0015: managed bearer tokens for local integration clients.

CREATE TABLE IF NOT EXISTS integration_tokens (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
  token_hash    TEXT NOT NULL UNIQUE,
  token_prefix  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  last_used_at  TEXT,
  revoked_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_active
  ON integration_tokens(revoked_at, created_at);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_prefix
  ON integration_tokens(token_prefix);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0015');
