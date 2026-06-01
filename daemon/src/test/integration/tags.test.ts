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

  async function createBookmark(url: string) {
    const res = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return await res.json() as { data: { id: string; tags: string[] } };
  }

  async function createTag(name: string) {
    const res = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return await res.json() as { data: { id: string; name: string } };
  }

  async function attachTag(bookmarkId: string, name: string) {
    return app.request(`/bookmarks/${bookmarkId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

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

  // ─── PUT /tags/:id ────────────────────────────────────────────────────────

  it("PUT /tags/:id renames a tag across bookmark references and filters", async () => {
    const { data: bm } = await createBookmark("https://example.com/tagged");
    const { data: tag } = await createTag("typescript");
    await attachTag(bm.id, "typescript");

    const renameRes = await app.request(`/tags/${tag.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "reactquery" }),
    });

    expect(renameRes.status).toBe(200);
    const renameJson = await renameRes.json() as { data: { id: string; name: string } };
    expect(renameJson.data).toEqual(expect.objectContaining({ id: tag.id, name: "reactquery" }));

    const bookmarkRes = await app.request(`/bookmarks/${bm.id}`);
    const bookmarkJson = await bookmarkRes.json() as { data: { tags: string[] } };
    expect(bookmarkJson.data.tags).toContain("reactquery");
    expect(bookmarkJson.data.tags).not.toContain("typescript");

    const newFilterRes = await app.request("/bookmarks?tag=reactquery");
    const newFilterJson = await newFilterRes.json() as { pagination: { total: number } };
    expect(newFilterJson.pagination.total).toBe(1);

    const oldFilterRes = await app.request("/bookmarks?tag=typescript");
    const oldFilterJson = await oldFilterRes.json() as { pagination: { total: number } };
    expect(oldFilterJson.pagination.total).toBe(0);

    const newSearchRes = await app.request("/search?q=reactquery&mode=keyword");
    const newSearchJson = await newSearchRes.json() as { pagination: { total: number } };
    expect(newSearchJson.pagination.total).toBe(1);

    const oldSearchRes = await app.request("/search?q=typescript&mode=keyword");
    const oldSearchJson = await oldSearchRes.json() as { pagination: { total: number } };
    expect(oldSearchJson.pagination.total).toBe(0);

    const tagsRes = await app.request("/tags");
    const tagsJson = await tagsRes.json() as { data: Array<{ id: string; name: string; bookmark_count: number }> };
    expect(tagsJson.data).toContainEqual(
      expect.objectContaining({ id: tag.id, name: "reactquery", bookmark_count: 1 })
    );
    expect(tagsJson.data.some((t) => t.name === "typescript")).toBe(false);
  });

  it("PUT /tags/:id returns 400 for malformed JSON on existing tags", async () => {
    const { data: tag } = await createTag("typescript");

    const res = await app.request(`/tags/${tag.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    expect(res.status).toBe(400);
  });

  it("PUT /tags/:id rejects duplicate target names without merging tags", async () => {
    const { data: source } = await createTag("typescript");
    const { data: target } = await createTag("react-query");

    const res = await app.request(`/tags/${source.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "react-query" }),
    });

    expect(res.status).toBe(409);
    const problem = await res.json() as { title: string; detail?: string };
    expect(problem.title).toBe("Conflict");
    expect(problem.detail).toContain("already exists");

    const tagsRes = await app.request("/tags");
    const tagsJson = await tagsRes.json() as { data: Array<{ id: string; name: string }> };
    expect(tagsJson.data).toContainEqual(expect.objectContaining({ id: source.id, name: "typescript" }));
    expect(tagsJson.data).toContainEqual(expect.objectContaining({ id: target.id, name: "react-query" }));
  });

  it("PUT /tags/:id rejects invalid target names", async () => {
    const { data: tag } = await createTag("typescript");

    const res = await app.request(`/tags/${tag.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invalid Name!" }),
    });

    expect(res.status).toBe(422);
  });

  it("PUT /tags/:id returns 404 for unknown tags", async () => {
    const res = await app.request("/tags/does-not-exist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "typescript" }),
    });

    expect(res.status).toBe(404);
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
