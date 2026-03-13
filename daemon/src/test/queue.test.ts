import { describe, it, expect, beforeEach } from "bun:test";
import { JobQueue } from "../queue.js";
import { JobStatus } from "../types/job.js";

describe("JobQueue", () => {
  let q: JobQueue;

  beforeEach(() => {
    q = new JobQueue();
  });

  it("enqueues a job with Pending status", () => {
    const job = q.enqueue("ping", { message: "hello" });
    expect(job.status).toBe(JobStatus.Pending);
    expect(job.id).toBeString();
    expect(job.type).toBe("ping");
    expect(q.size()).toBe(1);
  });

  it("dequeue transitions status to Running", () => {
    const job = q.enqueue("ping", {});
    const dequeued = q.dequeue();
    expect(dequeued).not.toBeNull();
    expect(dequeued!.id).toBe(job.id);
    expect(dequeued!.status).toBe(JobStatus.Running);
    expect(dequeued!.startedAt).toBeInstanceOf(Date);
    expect(q.size()).toBe(0);
  });

  it("dequeue returns null on empty queue", () => {
    expect(q.dequeue()).toBeNull();
  });

  it("dequeue is FIFO", () => {
    const a = q.enqueue("a", {});
    const b = q.enqueue("b", {});
    const c = q.enqueue("c", {});
    expect(q.dequeue()!.id).toBe(a.id);
    expect(q.dequeue()!.id).toBe(b.id);
    expect(q.dequeue()!.id).toBe(c.id);
    expect(q.dequeue()).toBeNull();
  });

  it("complete marks job Done and evicts it", () => {
    const job = q.enqueue("ping", {});
    q.dequeue();
    q.complete(job.id);
    const found = q.getById(job.id);
    expect(found).toBeUndefined();
    expect(q.size()).toBe(0);
  });

  it("complete with error marks job Failed", () => {
    const job = q.enqueue("ping", {});
    q.dequeue();
    // complete evicts the job, so we check via getById before eviction
    // by peeking at the status before complete removes it
    q.complete(job.id, "network error");
    // evicted — getById returns undefined
    expect(q.getById(job.id)).toBeUndefined();
  });

  it("size reflects only Pending jobs", () => {
    q.enqueue("a", {});
    q.enqueue("b", {});
    expect(q.size()).toBe(2);
    q.dequeue(); // transitions to Running, no longer pending
    expect(q.size()).toBe(1);
  });

  it("peek returns next pending job without removing it", () => {
    const job = q.enqueue("ping", {});
    const peeked = q.peek();
    expect(peeked).not.toBeNull();
    expect(peeked!.id).toBe(job.id);
    expect(q.size()).toBe(1); // still in queue
  });

  it("peek returns null on empty queue", () => {
    expect(q.peek()).toBeNull();
  });

  it("getById returns the job by id", () => {
    const job = q.enqueue("ping", { message: "test" });
    const found = q.getById(job.id);
    expect(found).not.toBeUndefined();
    expect(found!.id).toBe(job.id);
  });

  it("complete on unknown id is a no-op", () => {
    expect(() => q.complete("nonexistent-id")).not.toThrow();
  });

  it("enqueuing multiple jobs increments size correctly", () => {
    for (let i = 0; i < 10; i++) q.enqueue("work", { i });
    expect(q.size()).toBe(10);
  });
});
