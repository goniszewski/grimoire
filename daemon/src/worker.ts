import { log } from "./logger.js";
import { JobQueue } from "./queue.js";
import { Job } from "./types/job.js";

type Handler = (job: Job) => Promise<void>;

/**
 * Polls the queue and dispatches jobs to registered handlers.
 */
export class JobWorker {
  private handlers = new Map<string, Handler>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private currentJob: Promise<void> | null = null;

  constructor(
    private readonly queue: JobQueue,
    private readonly pollIntervalMs = 500
  ) {}

  registerHandler(type: string, handler: Handler): void {
    this.handlers.set(type, handler);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs);
    log.info("JobWorker started", { pollIntervalMs: this.pollIntervalMs });
  }

  /** Stops polling and waits for the current job (if any) to finish. */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.currentJob) {
      log.info("JobWorker waiting for current job to finish…");
      await this.currentJob;
    }
    log.info("JobWorker stopped");
  }

  private poll(): void {
    try {
      if (this.currentJob) return; // still processing previous job

      const job = this.queue.dequeue();
      if (!job) return;

      const handler = this.handlers.get(job.type);
      if (!handler) {
        log.warn("No handler for job type", { type: job.type, id: job.id });
        this.queue.complete(job.id, `No handler registered for type "${job.type}"`);
        return;
      }

      this.currentJob = handler(job)
        .then(() => {
          this.queue.complete(job.id);
          log.info("Job completed", { id: job.id, type: job.type });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.queue.complete(job.id, msg);
          log.error("Job failed", { id: job.id, type: job.type, error: msg });
        })
        .finally(() => {
          this.currentJob = null;
        });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("JobWorker poll error", { error: msg });
    }
  }
}
