-- Persist the latest actionable pipeline failure per bookmark.

CREATE TABLE IF NOT EXISTS pipeline_failures (
  bookmark_id            TEXT PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
  stage                  TEXT NOT NULL
                         CHECK (stage IN ('fetch','extract','ai_enrich','embed','index')),
  message                TEXT NOT NULL,
  configuration_related  INTEGER NOT NULL DEFAULT 0 CHECK (configuration_related IN (0,1)),
  retryable              INTEGER NOT NULL DEFAULT 1 CHECK (retryable IN (0,1)),
  failed_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  dismissed_at           TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_failures_failed_at
  ON pipeline_failures(failed_at);

CREATE INDEX IF NOT EXISTS idx_pipeline_failures_stage
  ON pipeline_failures(stage);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0010');
