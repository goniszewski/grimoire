import { randomUUID } from "crypto";
import { log } from "./logger.js";
import { Job, JobStatus } from "./types/job.js";

/**
 * In-memory job queue.
 * Interface is designed so TASK-002 can swap to SQLite backing
 * without changing any caller code.
 *
 * NOTE: This implementation is single-threaded safe. If async I/O is
 * introduced during the SQLite migration, add a mutex around enqueue/dequeue.
 */
export class JobQueue {
  private jobs = new Map<string, Job>();
  // Maintains insertion order for FIFO dequeue
  private order: string[] = [];
  // O(1) pending counter — avoids iterating the full map on size()
  private pendingCount = 0;

  enqueue<T>(type: string, payload: T): Job<T> {
    const job: Job<T> = {
      id: randomUUID(),
      type,
      status: JobStatus.Pending,
      payload,
      createdAt: new Date(),
    };
    this.jobs.set(job.id, job as Job);
    this.order.push(job.id);
    this.pendingCount++;
    return job;
  }

  /** Returns and removes the next pending job (FIFO), or null if none. */
  dequeue(): Job | null {
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
    for (const id of this.order) {
      const job = this.jobs.get(id);
      if (job?.status === JobStatus.Pending) return job;
    }
    return null;
  }

  /** Number of pending jobs. O(1). */
  size(): number {
    return this.pendingCount;
  }

  getById(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /** Mark a job as done or failed after processing, then evict it from memory. */
  complete(id: string, error?: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = error ? JobStatus.Failed : JobStatus.Done;
    job.finishedAt = new Date();
    if (error) job.error = error;
    // Evict to prevent unbounded memory growth.
    // TASK-002 will persist completed jobs to SQLite before this point.
    this.jobs.delete(id);
  }
}
