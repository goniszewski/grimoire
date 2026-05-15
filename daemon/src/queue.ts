import { randomUUID } from "crypto";
import type { Database } from "bun:sqlite";
import { log } from "./logger.js";
import { Job, JobStatus } from "./types/job.js";

interface StoredJobRow {
  id: string;
  type: string;
  status: JobStatus;
  payload: string;
  error: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
  next_run_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface JobQueueOptions {
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  maxRetryDelayMs?: number;
  now?: () => Date;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 5_000;
const DEFAULT_MAX_RETRY_DELAY_MS = 5 * 60_000;

/**
 * Job queue with an in-memory mode for lightweight tests and an optional
 * SQLite-backed mode for durable daemon work.
 */
export class JobQueue {
  private jobs = new Map<string, Job>();
  // Maintains insertion order for FIFO dequeue
  private order: string[] = [];
  // O(1) pending counter — avoids iterating the full map on size()
  private pendingCount = 0;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly db?: Database,
    options: JobQueueOptions = {}
  ) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.now = options.now ?? (() => new Date());
    if (this.db) this.recoverInterruptedJobs();
  }

  enqueue<T>(type: string, payload: T): Job<T> {
    const createdAt = this.now();
    const job: Job<T> = {
      id: randomUUID(),
      type,
      status: JobStatus.Pending,
      payload,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt,
      nextRunAt: createdAt,
    };

    if (this.db) {
      this.db.run(
        `INSERT INTO jobs (
           id, type, status, payload, attempts, max_attempts, created_at, next_run_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          job.id,
          job.type,
          job.status,
          JSON.stringify(job.payload),
          job.attempts,
          job.maxAttempts,
          this.formatDate(job.createdAt),
          this.formatDate(job.nextRunAt),
        ]
      );
      return job;
    }

    this.jobs.set(job.id, job as Job);
    this.order.push(job.id);
    this.pendingCount++;
    return job;
  }

  /** Returns and removes the next pending job (FIFO), or null if none. */
  dequeue(): Job | null {
    if (this.db) return this.dequeueFromDb();

    while (this.order.length > 0) {
      const id = this.order[0];
      const job = this.jobs.get(id);
      if (!job) {
        this.order.shift();
        continue;
      }
      if (job.status === JobStatus.Pending) {
        this.order.shift();
        job.status = JobStatus.Running;
        job.startedAt = new Date();
        this.pendingCount--;
        return job;
      }
      // Non-pending job in the order list — unexpected, log and skip
      log.warn("JobQueue: non-pending job found in order list — skipping", {
        id,
        status: job.status,
      });
      this.order.shift();
    }
    return null;
  }

  /** Peek at the next pending job without removing it. */
  peek(): Job | null {
    if (this.db) {
      const row = this.nextReadyRow();
      return row ? this.mapRow(row) : null;
    }

    for (const id of this.order) {
      const job = this.jobs.get(id);
      if (job?.status === JobStatus.Pending) return job;
    }
    return null;
  }

  /** Number of pending jobs. O(1). */
  size(): number {
    if (this.db) {
      return (
        this.db
          .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM jobs WHERE status = 'pending'")
          .get()?.count ?? 0
      );
    }

    return this.pendingCount;
  }

  getById(id: string): Job | undefined {
    if (this.db) {
      const row = this.db.query<StoredJobRow, [string]>("SELECT * FROM jobs WHERE id = ?").get(id);
      return row ? this.mapRow(row) : undefined;
    }

    return this.jobs.get(id);
  }

  /** Mark a job as done or failed after processing, then evict it from memory. */
  complete(id: string, error?: string): void {
    if (this.db) {
      this.completeInDb(id, error);
      return;
    }

    const job = this.jobs.get(id);
    if (!job) return;
    job.status = error ? JobStatus.Failed : JobStatus.Done;
    job.finishedAt = new Date();
    if (error) job.error = error;
    // Evict to prevent unbounded memory growth in the in-memory test queue.
    // SQLite-backed queues persist terminal jobs in the jobs table.
    this.jobs.delete(id);
    // Remove from the order array so it doesn't accumulate stale entries.
    // We use splice here rather than filtering so the operation stays O(n) once
    // rather than O(n) on every dequeue pass.
    const idx = this.order.indexOf(id);
    if (idx !== -1) this.order.splice(idx, 1);
  }

  private dequeueFromDb(): Job | null {
    const row = this.nextReadyRow();
    if (!row || !this.db) return null;

    const startedAt = this.now();
    const info = this.db.run(
      `UPDATE jobs
       SET status = ?, started_at = ?, finished_at = NULL
       WHERE id = ? AND status = ?`,
      [JobStatus.Running, this.formatDate(startedAt), row.id, JobStatus.Pending]
    );
    if (info.changes === 0) return null;

    return this.mapRow({
      ...row,
      status: JobStatus.Running,
      started_at: this.formatDate(startedAt),
      finished_at: null,
    });
  }

  private recoverInterruptedJobs(): void {
    if (!this.db) return;

    const readyAt = this.formatDate(this.now());
    const info = this.db.run(
      `UPDATE jobs
       SET status = ?, started_at = NULL, next_run_at = COALESCE(next_run_at, ?)
       WHERE status = ?`,
      [JobStatus.Pending, readyAt, JobStatus.Running]
    );
    if (info.changes > 0) {
      log.warn("JobQueue: recovered interrupted running jobs", { count: info.changes });
    }
  }

  private nextReadyRow(): StoredJobRow | null {
    if (!this.db) return null;
    return (
      this.db
        .query<StoredJobRow, [JobStatus, string]>(
          `SELECT *
           FROM jobs
           WHERE status = ?
             AND COALESCE(next_run_at, created_at) <= ?
           ORDER BY COALESCE(next_run_at, created_at), created_at
           LIMIT 1`
        )
        .get(JobStatus.Pending, this.formatDate(this.now())) ?? null
    );
  }

  private completeInDb(id: string, error?: string): void {
    if (!this.db) return;

    const row = this.db.query<StoredJobRow, [string]>("SELECT * FROM jobs WHERE id = ?").get(id);
    if (!row) return;

    const finishedAt = this.now();
    if (!error) {
      this.db.run(
        `UPDATE jobs
         SET status = ?, error = NULL, finished_at = ?
         WHERE id = ?`,
        [JobStatus.Done, this.formatDate(finishedAt), id]
      );
      return;
    }

    const attempts = row.attempts + 1;
    const maxAttempts = row.max_attempts || this.maxAttempts;

    if (attempts >= maxAttempts) {
      this.db.run(
        `UPDATE jobs
         SET status = ?, attempts = ?, error = ?, finished_at = ?
         WHERE id = ?`,
        [JobStatus.Failed, attempts, error, this.formatDate(finishedAt), id]
      );
      return;
    }

    const retryAt = new Date(finishedAt.getTime() + this.retryDelayMs(attempts));
    this.db.run(
      `UPDATE jobs
       SET status = ?, attempts = ?, error = ?, next_run_at = ?, started_at = NULL, finished_at = ?
       WHERE id = ?`,
      [
        JobStatus.Pending,
        attempts,
        error,
        this.formatDate(retryAt),
        this.formatDate(finishedAt),
        id,
      ]
    );
  }

  private retryDelayMs(attempts: number): number {
    return Math.min(this.retryBaseDelayMs * 2 ** (attempts - 1), this.maxRetryDelayMs);
  }

  private mapRow(row: StoredJobRow): Job {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      payload: JSON.parse(row.payload),
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      createdAt: this.parseDate(row.created_at),
      nextRunAt: this.parseDate(row.next_run_at ?? row.created_at),
      startedAt: this.parseOptionalDate(row.started_at),
      finishedAt: this.parseOptionalDate(row.finished_at),
      error: row.error ?? undefined,
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString();
  }

  private parseDate(value: string): Date {
    return new Date(value);
  }

  private parseOptionalDate(value: string | null): Date | undefined {
    return value ? new Date(value) : undefined;
  }
}
