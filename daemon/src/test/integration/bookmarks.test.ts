import { describe, it, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

describe("Bookmarks API", () => {
  let app: ReturnType<typeof createApp>;
  let queue: JobQueue;
  let db: Database;

  beforeEach(() => {
    db = makeTestDb();
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

  it("PUT /bookmarks/:id updates read_later without changing pinned state", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    const res = await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_later: 1 }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { data: { read_later: 0 | 1; is_pinned: 0 | 1 } };
    expect(json.data.read_later).toBe(1);
    expect(json.data.is_pinned).toBe(0);
  });

  it("PUT /bookmarks/:id updates every supported bookmark mutation field", async () => {
    const category = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Research")!;
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/mutable" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };
    const readAt = "2026-05-31T12:00:00.000Z";

    const res = await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Renamed bookmark",
        category_id: category.id,
        tags: ["TypeScript", "Testing"],
        is_pinned: 1,
        read_later: 1,
        is_archived: 1,
        read_at: readAt,
        notes: "A personal note",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        title: string | null;
        category_id: string | null;
        tags: string[];
        is_pinned: 0 | 1;
        read_later: 0 | 1;
        is_archived: 0 | 1;
        read_at: string | null;
        notes: string | null;
      };
    };
    expect(json.data).toMatchObject({
      title: "Renamed bookmark",
      category_id: category.id,
      is_pinned: 1,
      read_later: 1,
      is_archived: 1,
      read_at: readAt,
      notes: "A personal note",
    });
    expect(json.data.tags).toEqual(["testing", "typescript"]);
  });

  it("PUT /bookmarks/:id clears nullable fields and replacement tags", async () => {
    const category = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Documentation")!;
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/clearable", title: "Original" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: category.id,
        tags: ["docs"],
        read_at: "2026-05-31T12:00:00.000Z",
        notes: "keep temporarily",
      }),
    });

    const res = await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: null,
        category_id: null,
        tags: [],
        read_at: null,
        notes: null,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        title: string | null;
        category_id: string | null;
        tags: string[];
        read_at: string | null;
        notes: string | null;
      };
    };
    expect(json.data.title).toBeNull();
    expect(json.data.category_id).toBeNull();
    expect(json.data.tags).toEqual([]);
    expect(json.data.read_at).toBeNull();
    expect(json.data.notes).toBeNull();
  });

  for (const [field, value] of [
    ["url", "https://example.com/unsupported-url"],
    ["summary", "Unsupported summary mutation"],
    ["description", "Unsupported description mutation"],
    ["opened_count", 42],
    ["last_opened_at", "2026-05-31T12:00:00.000Z"],
    ["is_trashed", 1],
    ["created_at", "2026-05-31T12:00:00.000Z"],
  ] as const) {
    it(`PUT /bookmarks/:id rejects unsupported patch field ${field}`, async () => {
      const createRes = await app.request("/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://example.com/reject-${field.replaceAll("_", "-")}` }),
      });
      const { data: bm } = await createRes.json() as { data: { id: string } };

      const res = await app.request(`/bookmarks/${bm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      expect(res.status).toBe(422);
      const json = await res.json() as { title: string; detail?: string };
      expect(json.title).toBe("Unprocessable Entity");
      expect(json.detail).toContain(field);
    });
  }

  it("PUT /bookmarks/:id rejects non-object JSON patches", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/non-object-patch" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    const res = await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("not an object"),
    });

    expect(res.status).toBe(422);
    const json = await res.json() as { detail?: string };
    expect(json.detail).toContain("JSON object");
  });

  it("GET /bookmarks filters by read_later", async () => {
    const readLaterRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/read-later" }),
    });
    const normalRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/normal" }),
    });
    const { data: readLater } = await readLaterRes.json() as { data: { id: string } };
    const { data: normal } = await normalRes.json() as { data: { id: string } };

    await app.request(`/bookmarks/${readLater.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_later: 1 }),
    });

    const filteredRes = await app.request("/bookmarks?read_later=true");
    expect(filteredRes.status).toBe(200);
    const filtered = await filteredRes.json() as { data: Array<{ id: string; read_later: 0 | 1 }> };
    expect(filtered.data.map((b) => b.id)).toContain(readLater.id);
    expect(filtered.data.map((b) => b.id)).not.toContain(normal.id);
    expect(filtered.data.every((b) => b.read_later === 1)).toBe(true);
  });

  it("POST /bookmarks/:id/open increments opened_count on every user open", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/open-metrics" }),
    });
    const { data: bm } = await createRes.json() as {
      data: { id: string; opened_count: number; last_opened_at: string | null };
    };

    expect(bm.opened_count).toBe(0);
    expect(bm.last_opened_at).toBeNull();

    const firstOpenRes = await app.request(`/bookmarks/${bm.id}/open`, { method: "POST" });
    expect(firstOpenRes.status).toBe(200);
    const firstOpen = await firstOpenRes.json() as {
      data: { opened_count: number; last_opened_at: string | null };
    };
    expect(firstOpen.data.opened_count).toBe(1);
    expect(Date.parse(firstOpen.data.last_opened_at ?? "")).not.toBeNaN();

    const secondOpenRes = await app.request(`/bookmarks/${bm.id}/open`, { method: "POST" });
    expect(secondOpenRes.status).toBe(200);
    const secondOpen = await secondOpenRes.json() as {
      data: { opened_count: number; last_opened_at: string | null };
    };
    expect(secondOpen.data.opened_count).toBe(2);

    const detailRes = await app.request(`/bookmarks/${bm.id}`);
    const detail = await detailRes.json() as {
      data: { opened_count: number; last_opened_at: string | null };
    };
    expect(detail.data.opened_count).toBe(2);
    expect(detail.data.last_opened_at).toBe(secondOpen.data.last_opened_at);
  });

  it("POST /bookmarks/:id/open returns 404 for missing bookmarks", async () => {
    const res = await app.request("/bookmarks/does-not-exist/open", { method: "POST" });

    expect(res.status).toBe(404);
  });

  it("GET /export includes pinned/starred mapping and read_later state", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/exported" }),
    });
    const { data: bm } = await createRes.json() as { data: { id: string } };

    await app.request(`/bookmarks/${bm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: 1, read_later: 1 }),
    });
    await app.request(`/bookmarks/${bm.id}/open`, { method: "POST" });

    const jsonRes = await app.request("/export?format=json");
    expect(jsonRes.status).toBe(200);
    const exported = await jsonRes.json() as Array<{
      id: string;
      is_pinned: 0 | 1;
      read_later: 0 | 1;
      opened_count: number;
      last_opened_at: string | null;
    }>;
    expect(exported.find((row) => row.id === bm.id)).toMatchObject({
      is_pinned: 1,
      read_later: 1,
      opened_count: 1,
    });
    expect(exported.find((row) => row.id === bm.id)?.last_opened_at).not.toBeNull();

    const csvRes = await app.request("/export?format=csv");
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    expect(csv.split("\n")[0]).toContain("is_pinned");
    expect(csv.split("\n")[0]).toContain("read_later");
    expect(csv.split("\n")[0]).toContain("opened_count");
    expect(csv.split("\n")[0]).toContain("last_opened_at");
  });

  it("GET /export rejects invalid read_later filters", async () => {
    const res = await app.request("/export?read_later=maybe");

    expect(res.status).toBe(422);
    const json = await res.json() as { error: string };
    expect(json.error).toContain("read_later");
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

  it("GET /bookmarks/:id returns populated extracted content metadata", async () => {
    const createRes = await app.request("/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/detail-content" }),
    });
    const { data: created } = await createRes.json() as { data: { id: string } };

    db.run(
      `INSERT INTO bookmark_content (
         bookmark_id, raw_html, markdown, summary, author, published_at, word_count, language
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        "<article>Readable article body.</article>",
        "## Extracted notes\n\nReadable article body.",
        "A short extracted summary",
        "Ada Lovelace",
        "2024-01-12T09:00:00Z",
        1284,
        "en",
      ]
    );

    const res = await app.request(`/bookmarks/${created.id}`);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        content: {
          markdown: string | null;
          summary: string | null;
          author: string | null;
          published_at: string | null;
          word_count: number | null;
          language: string | null;
          extracted_at: string;
        } | null;
      };
    };

    expect(json.data.content).toMatchObject({
      markdown: "## Extracted notes\n\nReadable article body.",
      summary: "A short extracted summary",
      author: "Ada Lovelace",
      published_at: "2024-01-12T09:00:00Z",
      word_count: 1284,
      language: "en",
    });
    expect(Date.parse(json.data.content?.extracted_at ?? "")).not.toBeNaN();
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
