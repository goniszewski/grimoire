import { describe, it, expect, beforeEach } from "bun:test";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("Tags API", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = makeTestDb();
    const queue = new JobQueue();
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test" });
  });

  // ─── POST /tags ───────────────────────────────────────────────────────────

  it("POST /tags creates a tag", async () => {
    const res = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { data: { id: string; name: string } };
    expect(json.data.name).toBe("typescript");
    expect(json.data.id).toBeString();
  });

  it("POST /tags is idempotent — returns 200 for duplicate tag name", async () => {
    await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });
    const res2 = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });
    expect(res2.status).toBe(200);
    const json = await res2.json() as { data: { name: string } };
    expect(json.data.name).toBe("typescript");
  });

  it("POST /tags rejects invalid tag name format", async () => {
    const res = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invalid Name!" }),
    });
    expect(res.status).toBe(422);
  });

  // ─── GET /tags ────────────────────────────────────────────────────────────

  it("GET /tags returns created tags", async () => {
    await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });

    const res = await app.request("/tags");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: Array<{ name: string }> };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.some((t) => t.name === "typescript")).toBe(true);
  });

  // ─── POST /bookmarks/:id/tags ─────────────────────────────────────────────

  it("POST /bookmarks/:id/tags attaches a tag to a bookmark", async () => {
    // Create bookmark
    const bmRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const { data: bm } = await bmRes.json() as { data: { id: string } };

    // Attach tag
    const tagRes = await app.request(`/bookmarks/${bm.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });
    expect(tagRes.status).toBe(201);
    const json = await tagRes.json() as { data: { tags: string[] } };
    expect(json.data.tags).toContain("typescript");
  });

  // ─── DELETE /bookmarks/:id/tags/:tagId ────────────────────────────────────

  it("DELETE /bookmarks/:id/tags/:tagId detaches the tag", async () => {
    // Create bookmark
    const bmRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const { data: bm } = await bmRes.json() as { data: { id: string } };

    // Create tag
    const tagCreateRes = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });
    const { data: tag } = await tagCreateRes.json() as { data: { id: string } };

    // Attach tag to bookmark
    await app.request(`/bookmarks/${bm.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });

    // Detach
    const detachRes = await app.request(`/bookmarks/${bm.id}/tags/${tag.id}`, {
      method: "DELETE",
    });
    expect(detachRes.status).toBe(204);

    // Verify tag is no longer on the bookmark
    const bmGetRes = await app.request(`/bookmarks/${bm.id}`);
    const bmJson = await bmGetRes.json() as { data: { tags: string[] } };
    expect(bmJson.data.tags).not.toContain("typescript");
  });

  // ─── DELETE /tags/:id ─────────────────────────────────────────────────────

  it("DELETE /tags/:id removes the tag", async () => {
    const createRes = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });
    const { data: tag } = await createRes.json() as { data: { id: string } };

    const deleteRes = await app.request(`/tags/${tag.id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    // Should no longer appear in tag list
    const listRes = await app.request("/tags");
    const listJson = await listRes.json() as { data: Array<{ id: string }> };
    expect(listJson.data.some((t) => t.id === tag.id)).toBe(false);
  });

  it("DELETE /tags/:id returns 404 for unknown id", async () => {
    const res = await app.request("/tags/does-not-exist", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
