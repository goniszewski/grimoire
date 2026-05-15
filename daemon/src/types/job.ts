export enum JobStatus {
  Pending = "pending",
  Running = "running",
  Done    = "done",
  Failed  = "failed",
}

export interface Job<T = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  nextRunAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
}

// ---------- payload types ----------

export interface PingJobPayload {
  message?: string;
}

export type PingJob = Job<PingJobPayload>;

export interface IngestJobPayload {
  bookmarkId: string;
  url: string;
}

export type IngestJob = Job<IngestJobPayload>;

// Union of all known job payload types (extend as new job types are added)
export type AnyJob = PingJob | IngestJob | Job<unknown>;
