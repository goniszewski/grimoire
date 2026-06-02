import { describe, it, expect, beforeEach } from "bun:test";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";
import { BookmarkRepository } from "../../db/bookmark-repository.js";
import { Database } from "bun:sqlite";

describe("Search API", () => {
  let app: ReturnType<typeof createApp>;
  let db: Database;

  beforeEach(() => {
    db = makeTestDb();
    const queue = new JobQueue();
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test" });
  });

  // ─── Keyword search ───────────────────────────────────────────────────────

  it("GET /search?q=<word>&mode=keyword returns the matching bookmark", async () => {
    // Insert a bookmark with a known title directly via the repository
    const repo = new BookmarkRepository(db);
    repo.create("https://example.com", "SuperUniqueTitle");

    const res = await app.request("/search?q=SuperUniqueTitle&mode=keyword");
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: Array<{ url: string }>;
      pagination: { total: number };
      meta: { mode: string };
    };
    expect(json.meta.mode).toBe("keyword");
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.some((b) => b.url === "https://example.com")).toBe(true);
  });

  it("GET /search with empty query returns all active bookmarks", async () => {
    const repo = new BookmarkRepository(db);
    repo.create("https://example.com", "First");
    repo.create("https://bun.sh", "Second");

    const res = await app.request("/search");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: unknown[]; pagination: { total: number } };
    expect(json.pagination.total).toBe(2);
  });

  it("GET /search with unknown query returns empty results", async () => {
    const repo = new BookmarkRepository(db);
    repo.create("https://example.com", "KnownTitle");

    const res = await app.request("/search?q=xq9z1notmatchinganything&mode=keyword");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: unknown[] };
    expect(json.data.length).toBe(0);
  });

  it("GET /search filters by read_later", async () => {
    const repo = new BookmarkRepository(db);
    const readLater = repo.create("https://example.com/read-later", "Shared Query");
    const normal = repo.create("https://example.com/normal", "Shared Query");
    repo.update(readLater.id, { read_later: 1 });

    const res = await app.request("/search?q=Shared&mode=keyword&read_later=true");
    expect(res.status).toBe(200);
    const json = await res.json() as { data: Array<{ id: string; read_later: 0 | 1 }> };
    expect(json.data.map((b) => b.id)).toContain(readLater.id);
    expect(json.data.map((b) => b.id)).not.toContain(normal.id);
    expect(json.data.every((b) => b.read_later === 1)).toBe(true);
  });

  it("GET /search applies read, pinned, opened count, and last-opened filters", async () => {
    const repo = new BookmarkRepository(db);
    const matching = repo.create("https://example.com/search-filter-match", "Shared Filter Query");
    const unread = repo.create("https://example.com/search-filter-unread", "Shared Filter Query");
    const lowCount = repo.create("https://example.com/search-filter-low-count", "Shared Filter Query");
    const oldOpen = repo.create("https://example.com/search-filter-old-open", "Shared Filter Query");
    repo.update(matching.id, { read_at: "2026-06-01T08:00:00.000Z", is_pinned: 1 });
    repo.update(unread.id, { is_pinned: 1 });
    repo.update(lowCount.id, { read_at: "2026-06-01T08:00:00.000Z", is_pinned: 1 });
    repo.update(oldOpen.id, { read_at: "2026-06-01T08:00:00.000Z", is_pinned: 1 });
    db.query("UPDATE bookmarks SET opened_count = ?, last_opened_at = ? WHERE id = ?")
      .run(3, "2026-06-01T10:00:00.000Z", matching.id);
    db.query("UPDATE bookmarks SET opened_count = ?, last_opened_at = ? WHERE id = ?")
      .run(1, "2026-06-01T10:00:00.000Z", lowCount.id);
    db.query("UPDATE bookmarks SET opened_count = ?, last_opened_at = ? WHERE id = ?")
      .run(3, "2026-05-20T10:00:00.000Z", oldOpen.id);

    const params = new URLSearchParams({
      q: "Shared",
      mode: "keyword",
      read_state: "read",
      is_pinned: "true",
      opened_count_min: "2",
      last_opened_from: "2026-06-01",
      last_opened_to: "2026-06-01",
    });
    const res = await app.request(`/search?${params.toString()}`);
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: Array<{ id: string; read_at: string | null; is_pinned: 0 | 1; opened_count: number }>;
      pagination: { total: number };
    };

    expect(json.pagination.total).toBe(1);
    expect(json.data.map((b) => b.id)).toEqual([matching.id]);
    expect(json.data[0]).toMatchObject({ read_at: "2026-06-01T08:00:00.000Z", is_pinned: 1, opened_count: 3 });
  });

  it("GET /search rejects invalid parity filter params", async () => {
    for (const query of [
      "read_state=finished",
      "is_pinned=maybe",
      "opened_count_min=-1",
      "opened_count_max=abc",
    ]) {
      const res = await app.request(`/search?q=Shared&${query}`);
      expect(res.status).toBe(422);
      const json = await res.json() as { title: string };
      expect(json.title).toBe("Unprocessable Entity");
    }
  });

  it("GET /search rejects invalid sort params", async () => {
    for (const query of [
      "sort=importance",
      "direction=sideways",
      "direction=asc",
    ]) {
      const res = await app.request(`/search?q=Shared&${query}`);
      expect(res.status).toBe(422);
      const json = await res.json() as { title: string };
      expect(json.title).toBe("Unprocessable Entity");
    }
  });

  it("GET /search filters by category_id when duplicate category names exist", async () => {
    const repo = new BookmarkRepository(db);
    const parentA = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Personal")!;
    const parentB = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Work")!;
    const notesA = db
      .query<{ id: string }, [string, string]>("INSERT INTO categories (name, parent_id) VALUES (?, ?) RETURNING id")
      .get("Notes", parentA.id)!;
    const notesB = db
      .query<{ id: string }, [string, string]>("INSERT INTO categories (name, parent_id) VALUES (?, ?) RETURNING id")
      .get("Notes", parentB.id)!;
    const personal = repo.create("https://example.com/personal-search-notes", "Shared Notes");
    const work = repo.create("https://example.com/work-search-notes", "Shared Notes");
    repo.update(personal.id, { category_id: notesA.id });
    repo.update(work.id, { category_id: notesB.id });

    const params = new URLSearchParams({
      q: "Shared",
      mode: "keyword",
      category: "Notes",
      category_id: notesB.id,
    });
    const res = await app.request(`/search?${params.toString()}`);
    expect(res.status).toBe(200);
    const json = await res.json() as { data: Array<{ id: string; category_id: string | null }> };

    expect(json.data.map((b) => b.id)).toEqual([work.id]);
    expect(json.data[0].category_id).toBe(notesB.id);
  });

  it("GET /search?mode=invalid returns 422", async () => {
    const res = await app.request("/search?q=hello&mode=invalid");
    expect(res.status).toBe(422);
  });

  // ─── Response shape ───────────────────────────────────────────────────────

  it("GET /search response includes data, pagination, and meta", async () => {
    const res = await app.request("/search?q=test&mode=keyword");
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: unknown[];
      pagination: { total: number; limit: number; offset: number; has_more: boolean };
      meta: { mode: string };
    };
    expect(Array.isArray(json.data)).toBe(true);
    expect(typeof json.pagination.total).toBe("number");
    expect(typeof json.pagination.limit).toBe("number");
    expect(typeof json.pagination.offset).toBe("number");
    expect(typeof json.pagination.has_more).toBe("boolean");
    expect(json.meta.mode).toBe("keyword");
  });
});
