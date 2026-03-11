import { log } from "./logger.js";

interface ScheduledTask {
  name: string;
  intervalMs: number;
  fn: () => void | Promise<void>;
  timer: ReturnType<typeof setInterval> | null;
  currentRun: Promise<void> | null;
}

/**
 * Runs named recurring tasks at fixed intervals.
 */
export class Scheduler {
  private tasks = new Map<string, ScheduledTask>();
  private started = false;

  register(name: string, intervalMs: number, fn: () => void | Promise<void>): void {
    if (this.started) {
      throw new Error(
        `Scheduler.register("${name}") called after start() — task would never run`
      );
    }
    if (this.tasks.has(name)) {
      log.warn("Scheduler task already registered — skipping", { name });
      return;
    }
    this.tasks.set(name, { name, intervalMs, fn, timer: null, currentRun: null });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const task of this.tasks.values()) {
      task.timer = setInterval(() => {
        const ts = new Date().toISOString();
        log.info("Scheduler task running", { name: task.name, ts });
        task.currentRun = Promise.resolve()
          .then(() => task.fn())
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            log.error("Scheduler task error", { name: task.name, error: msg });
          })
          .finally(() => {
            task.currentRun = null;
          });
      }, task.intervalMs);
    }
    log.info("Scheduler started", { tasks: [...this.tasks.keys()] });
  }

  /** Clears all timers and waits for any in-flight task executions to finish. */
  async stop(): Promise<void> {
    for (const task of this.tasks.values()) {
      if (task.timer) {
        clearInterval(task.timer);
        task.timer = null;
      }
    }
    // Await any tasks currently mid-execution
    const inFlight = [...this.tasks.values()]
      .map((t) => t.currentRun)
      .filter((p): p is Promise<void> => p !== null);
    if (inFlight.length > 0) {
      log.info("Scheduler waiting for in-flight tasks…", { count: inFlight.length });
      await Promise.allSettled(inFlight);
    }
    this.started = false;
    log.info("Scheduler stopped");
  }
}
