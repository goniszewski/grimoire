import type { Database } from "bun:sqlite";
import type { PipelineFailureRow, PipelineFailureStage } from "../db/types.js";

export interface PipelineFailureInput {
  bookmarkId: string;
  stage: PipelineFailureStage;
  message: string;
  configurationRelated?: boolean;
  retryable?: boolean;
}

export interface PipelineFailureDto {
  stage: PipelineFailureStage;
  message: string;
  configuration_related: boolean;
  retryable: boolean;
  failed_at: string;
  dismissed_at: string | null;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function recordPipelineFailure(db: Database, failure: PipelineFailureInput): void {
  db.run(
    `INSERT INTO pipeline_failures (
       bookmark_id, stage, message, configuration_related, retryable, failed_at, dismissed_at
     )
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), NULL)
     ON CONFLICT(bookmark_id) DO UPDATE SET
       stage = excluded.stage,
       message = excluded.message,
       configuration_related = excluded.configuration_related,
       retryable = excluded.retryable,
       failed_at = excluded.failed_at,
       dismissed_at = NULL`,
    [
      failure.bookmarkId,
      failure.stage,
      failure.message,
      failure.configurationRelated ? 1 : 0,
      failure.retryable === false ? 0 : 1,
    ]
  );
}

export function clearPipelineFailure(db: Database, bookmarkId: string): void {
  db.run("DELETE FROM pipeline_failures WHERE bookmark_id = ?", [bookmarkId]);
}

export function dismissPipelineFailure(db: Database, bookmarkId: string): boolean {
  const info = db.run(
    `UPDATE pipeline_failures
     SET dismissed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
     WHERE bookmark_id = ? AND dismissed_at IS NULL`,
    [bookmarkId]
  );
  return info.changes > 0;
}

export function getPipelineFailure(db: Database, bookmarkId: string): PipelineFailureDto | null {
  const row =
    db
      .query<PipelineFailureRow, [string]>(
        `SELECT *
         FROM pipeline_failures
         WHERE bookmark_id = ? AND dismissed_at IS NULL`
      )
      .get(bookmarkId) ?? null;
  if (!row) return null;

  return {
    stage: row.stage,
    message: row.message,
    configuration_related: row.configuration_related === 1,
    retryable: row.retryable === 1,
    failed_at: row.failed_at,
    dismissed_at: row.dismissed_at,
  };
}
