import { describe, it, expect, beforeEach } from "bun:test";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("Demo data route", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = makeTestDb();
    const queue = new JobQueue();
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test" });
  });

  it("POST /demo/load loads demo bookmarks into an empty library and returns counts", async () => {
    const res = await app.request("/demo/load", { method: "POST" });
    expect(res.status).toBe(200);

    const json = await res.json() as { data: { bookmarks_created: number; categories_created: number } };
    expect(json.data.bookmarks_created).toBe(10);
    expect(json.data.categories_created).toBe(3);

    // Verify bookmarks were actually inserted
    const bookmarksRes = await app.request("/bookmarks");
    const bookmarksJson = await bookmarksRes.json() as { pagination: { total: number } };
    expect(bookmarksJson.pagination.total).toBe(10);

    // Verify categories were created
    const categoriesRes = await app.request("/categories");
    const categoriesJson = await categoriesRes.json() as { data: Array<{ name: string; bookmark_count: number }> };
    expect(categoriesJson.data.length).toBe(3);
    expect(categoriesJson.data.map((c: { name: string }) => c.name).sort()).toEqual([
      "Design",
      "Engineering",
      "Research",
    ]);

    // Verify tags exist on bookmarks
    const tagsRes = await app.request("/tags");
    const tagsJson = await tagsRes.json() as { data: Array<{ name: string; bookmark_count: number }> };
    expect(tagsJson.data.length).toBeGreaterThanOrEqual(5);
    const tagNames = tagsJson.data.map((t: { name: string }) => t.name);
    expect(tagNames).toContain("typescript");
    expect(tagNames).toContain("design");
  });

  it("POST /demo/load returns 409 when the library already has bookmarks", async () => {
    // First, load demo data
    await app.request("/demo/load", { method: "POST" });

    // Second attempt should fail
    const res = await app.request("/demo/load", { method: "POST" });
    expect(res.status).toBe(409);

    const json = await res.json() as { error: string };
    expect(json.error).toContain("not empty");
  });

  it("POST /demo/load returns 409 when a single bookmark exists", async () => {
    // Create one bookmark
    await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    const res = await app.request("/demo/load", { method: "POST" });
    expect(res.status).toBe(409);
  });
});
