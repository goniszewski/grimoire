import { describe, it, expect, beforeEach } from "bun:test";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("Bookmarks API", () => {
  let app: ReturnType<typeof createApp>;
  let queue: JobQueue;

  beforeEach(() => {
    const db = makeTestDb();
    queue = new JobQueue();
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test" });
  });

  // ─── POST /bookmarks ──────────────────────────────────────────────────────

  it("POST /bookmarks creates a bookmark and enqueues a job", async () => {
    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { data: { url: string; id: string } };
    expect(json.data.url).toBe("https://example.com");
    expect(json.data.id).toBeString();
    expect(queue.size()).toBe(1);
  });

  it("POST /bookmarks is idempotent — returns 200 for duplicate active URL", async () => {
    await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const res2 = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    expect(res2.status).toBe(200);
    const json = await res2.json() as { data: { url: string } };
    expect(json.data.url).toBe("https://example.com");
  });

  it("POST /bookmarks with missing url returns 422", async () => {
    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No URL" }),
    });
    expect(res.status).toBe(422);
  });

  it("POST /bookmarks with invalid URL returns 422", async () => {
    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "not-a-url" }),
    });
    expect(res.status).toBe(422);
  });

  // ─── GET /bookmarks ───────────────────────────────────────────────────────

  it("GET /bookmarks returns data array and pagination", async () => {
    const res = await app.request("/bookmarks");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: unknown[]; pagination: unknown };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.pagination).toBeDefined();
  });

  // ─── GET /bookmarks/:id ───────────────────────────────────────────────────

  it("GET /bookmarks/:id returns the bookmark with content field", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const { data: created } = await createRes.json() as { data: { id: string } };

    const res = await app.request(`/bookmarks/${created.id}`);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: { id: string; content: unknown } };
    expect(json.data.id).toBe(created.id);
    expect("content" in json.data).toBe(true);
  });

  it("GET /bookmarks/:id returns 404 for unknown id", async () => {
    const res = await app.request("/bookmarks/does-not-exist");
    expect(res.status).toBe(404);
  });

  // ─── Archive flow ─────────────────────────────────────────────────────────

  it("archive flow: archived bookmark excluded from default list, visible with ?archived=true", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    // Archive it
    const archiveRes = await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: 1 }),
    });
    expect(archiveRes.status).toBe(200);

    // Should not appear in default list
    const listRes = await app.request("/bookmarks");
    const listJson = await listRes.json() as { data: Array<{ id: string }> };
    expect(listJson.data.some((b) => b.id === bm.id)).toBe(false);

    // Should appear in archived list
    const archivedRes = await app.request("/bookmarks?archived=true");
    const archivedJson = await archivedRes.json() as { data: Array<{ id: string }> };
    expect(archivedJson.data.some((b) => b.id === bm.id)).toBe(true);

    // Unarchive — back in main list
    const unarchiveRes = await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: 0 }),
    });
    expect(unarchiveRes.status).toBe(200);

    const listRes2 = await app.request("/bookmarks");
    const listJson2 = await listRes2.json() as { data: Array<{ id: string }> };
    expect(listJson2.data.some((b) => b.id === bm.id)).toBe(true);
  });

  // ─── Trash flow ───────────────────────────────────────────────────────────

  it("trash flow: soft-delete, restore, re-appears in bookmarks list", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://bun.sh" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    // Soft delete
    const deleteRes = await app.request(`/bookmarks/${bm.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    // Should be in trash
    const trashRes = await app.request("/trash");
    expect(trashRes.status).toBe(200);
    const trashJson = await trashRes.json() as { data: Array<{ id: string }> };
    expect(trashJson.data.some((b) => b.id === bm.id)).toBe(true);

    // Restore
    const restoreRes = await app.request(`/bookmarks/${bm.id}/restore`, { method: "POST" });
    expect(restoreRes.status).toBe(200);

    // Should be back in main list
    const listRes = await app.request("/bookmarks");
    const listJson = await listRes.json() as { data: Array<{ id: string }> };
    expect(listJson.data.some((b) => b.id === bm.id)).toBe(true);
  });

  // ─── Hard delete flow ─────────────────────────────────────────────────────

  it("hard delete: soft-delete then permanent-delete empties the trash", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://bun.sh" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    // Soft delete first
    const softDeleteRes = await app.request(`/bookmarks/${bm.id}`, { method: "DELETE" });
    expect(softDeleteRes.status).toBe(204);

    // Hard delete
    const hardDeleteRes = await app.request(`/bookmarks/${bm.id}/permanent`, { method: "DELETE" });
    expect(hardDeleteRes.status).toBe(204);

    // Trash should now be empty
    const trashRes = await app.request("/trash");
    const trashJson = await trashRes.json() as { data: Array<{ id: string }> };
    expect(trashJson.data.some((b) => b.id === bm.id)).toBe(false);
  });
});
