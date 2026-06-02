import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

type IntegrationTokenCreateResponse = {
  data: {
    token: string;
  };
};

type CaptureResponse = {
  data: {
    bookmark: {
      id: string;
      url: string;
      title: string | null;
      category_id: string | null;
      notes: string | null;
      tags: string[];
    };
    capture: {
      bookmark_id: string;
      source_client: string | null;
      source_url: string | null;
      referrer_url: string | null;
      selected_text: string | null;
      captured_at: string;
      updated_at: string;
    } | null;
    created: boolean;
    job_id: string | null;
  };
};

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

describe("capture endpoint", () => {
  let db: Database;
  let queue: JobQueue;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = makeTestDb();
    queue = new JobQueue(db);
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test", staticDir: false });
  });

  afterEach(() => {
    db.close();
  });

  async function createToken(): Promise<string> {
    const res = await app.request("/integration-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:3210",
      },
      body: JSON.stringify({ name: "Browser capture" }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as IntegrationTokenCreateResponse;
    return json.data.token;
  }

  it("requires a managed integration bearer token", async () => {
    const res = await app.request("/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/no-token" }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("captures a new bookmark with metadata and enqueues normal ingestion", async () => {
    const token = await createToken();
    const category = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Research")!;

    const res = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bearer(token),
      },
      body: JSON.stringify({
        url: "https://example.com/capture",
        title: "Captured resource",
        tags: ["TypeScript", "rag", "typescript"],
        category_id: category.id,
        notes: "Read after the SQLite notes.",
        source: {
          client: "bookmarklet",
          source_url: "https://example.com/article-list",
          referrer_url: "https://example.com/",
          selected_text: "Relevant excerpt",
        },
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as CaptureResponse;
    expect(json.data.created).toBe(true);
    expect(json.data.job_id).toBeString();
    expect(json.data.bookmark).toMatchObject({
      url: "https://example.com/capture",
      title: "Captured resource",
      category_id: category.id,
      notes: "Read after the SQLite notes.",
      tags: ["rag", "typescript"],
    });
    expect(json.data.capture).toMatchObject({
      bookmark_id: json.data.bookmark.id,
      source_client: "bookmarklet",
      source_url: "https://example.com/article-list",
      referrer_url: "https://example.com/",
      selected_text: "Relevant excerpt",
    });
    expect(json.data.capture?.captured_at).toBeString();
    expect(json.data.capture?.updated_at).toBeString();

    const job = queue.peek();
    expect(job?.type).toBe("ingest");
    expect(job?.payload).toMatchObject({
      bookmarkId: json.data.bookmark.id,
      url: "https://example.com/capture",
    });
  });

  it("resolves a root category name when category_id is not supplied", async () => {
    const token = await createToken();

    const res = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bearer(token),
      },
      body: JSON.stringify({
        url: "https://example.com/category-name",
        category: "Reading Queue",
      }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as CaptureResponse;
    const category = db
      .query<{ name: string }, [string]>("SELECT name FROM categories WHERE id = ?")
      .get(json.data.bookmark.category_id ?? "");
    expect(category?.name).toBe("Reading Queue");
  });

  it("accepts the documented maximum notes size under the capture body limit", async () => {
    const token = await createToken();
    const body = JSON.stringify({
      url: "https://example.com/large-capture-notes",
      notes: "a".repeat(100_000),
    });

    const res = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(body.length),
        ...bearer(token),
      },
      body,
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as CaptureResponse;
    expect(json.data.bookmark.notes).toHaveLength(100_000);
  });

  it("returns existing active captures idempotently without merging metadata or queueing work", async () => {
    const token = await createToken();
    const first = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bearer(token),
      },
      body: JSON.stringify({
        url: "https://example.com/duplicate-capture",
        title: "Original title",
        tags: ["original"],
        notes: "Original notes",
      }),
    });
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as CaptureResponse;
    expect(queue.size()).toBe(1);

    const duplicate = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bearer(token),
      },
      body: JSON.stringify({
        url: "https://example.com/duplicate-capture",
        title: "Replacement title",
        tags: ["replacement"],
        category: "Should Not Be Created",
        notes: "Replacement notes",
      }),
    });

    expect(duplicate.status).toBe(200);
    const duplicateJson = (await duplicate.json()) as CaptureResponse;
    expect(duplicateJson.data.created).toBe(false);
    expect(duplicateJson.data.job_id).toBeNull();
    expect(duplicateJson.data.bookmark).toMatchObject({
      id: firstJson.data.bookmark.id,
      title: "Original title",
      tags: ["original"],
      notes: "Original notes",
    });
    expect(queue.size()).toBe(1);

    const sideEffectCategory = db
      .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM categories WHERE name = ?")
      .get("Should Not Be Created");
    expect(sideEffectCategory?.count).toBe(0);
  });

  it("rejects private URLs and ambiguous category fields", async () => {
    const token = await createToken();

    const privateUrl = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bearer(token),
      },
      body: JSON.stringify({ url: "http://127.0.0.1/internal" }),
    });
    expect(privateUrl.status).toBe(422);

    const category = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Research")!;
    const ambiguousCategory = await app.request("/capture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bearer(token),
      },
      body: JSON.stringify({
        url: "https://example.com/ambiguous-category",
        category_id: category.id,
        category: "Research",
      }),
    });
    expect(ambiguousCategory.status).toBe(422);
  });

  describe("bookmarklet endpoint (GET /capture/bookmarklet)", () => {
    it("returns 400 when token is missing", async () => {
      const res = await app.request("/capture/bookmarklet?url=https://example.com/test");
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain("Missing token");
    });

    it("returns 400 when url is missing", async () => {
      const token = await createToken();
      const res = await app.request(`/capture/bookmarklet?token=${token}`);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain("Missing url");
    });

    it("returns 401 for invalid token", async () => {
      const res = await app.request("/capture/bookmarklet?token=invalid&url=https://example.com/test");
      expect(res.status).toBe(401);
      const text = await res.text();
      expect(text).toContain("Invalid or revoked token");
    });

    it("returns 422 for private URLs", async () => {
      const token = await createToken();
      const res = await app.request(`/capture/bookmarklet?token=${token}&url=http://127.0.0.1/internal`);
      expect(res.status).toBe(422);
      const text = await res.text();
      expect(text).toContain("must not target a private or loopback host");
    });

    it("returns 201 and saves a new bookmark via bookmarklet", async () => {
      const token = await createToken();
      const res = await app.request(
        `/capture/bookmarklet?token=${token}&url=${encodeURIComponent("https://example.com/bookmarklet-test")}&title=${encodeURIComponent("Bookmarklet Test")}`
      );
      expect(res.status).toBe(201);
      const text = await res.text();
      expect(text).toContain("Saved");

      // Confirm the bookmark was persisted
      const bookmark = db
        .query<{ id: string; title: string }, [string]>("SELECT id, title FROM bookmarks WHERE url = ?")
        .get("https://example.com/bookmarklet-test");
      expect(bookmark).not.toBeNull();
      expect(bookmark?.title).toBe("Bookmarklet Test");
    });

    it("returns 200 HTML for a duplicate URL (already exists)", async () => {
      const token = await createToken();
      const url = "https://example.com/bookmarklet-dup";

      // First capture
      const first = await app.request(
        `/capture/bookmarklet?token=${token}&url=${encodeURIComponent(url)}&title=First`
      );
      expect(first.status).toBe(201);

      // Duplicate via bookmarklet
      const second = await app.request(
        `/capture/bookmarklet?token=${token}&url=${encodeURIComponent(url)}&title=Second`
      );
      expect(second.status).toBe(200);
      const text = await second.text();
      expect(text).toContain("Already saved");
    });
  });
});
