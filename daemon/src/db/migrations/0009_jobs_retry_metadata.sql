-- Add retry scheduling metadata for durable background jobs.

ALTER TABLE jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE jobs ADD COLUMN next_run_at TEXT;

UPDATE jobs
SET next_run_at = COALESCE(next_run_at, created_at)
WHERE next_run_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_ready
  ON jobs(status, next_run_at, created_at);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0009');
