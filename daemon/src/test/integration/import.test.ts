import { describe, it, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../../server.js";
import { JobQueue } from "../../queue.js";
import { makeTestDb } from "../helpers/db.js";

const NETSCAPE_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com" ADD_DATE="1600000000">Example Site</A>
    <DT><A HREF="https://bun.sh" ADD_DATE="1600000001" TAGS="javascript,runtime">Bun</A>
</DL>`;

describe("Import API", () => {
  let app: ReturnType<typeof createApp>;
  let db: Database;

  beforeEach(() => {
    db = makeTestDb();
    const queue = new JobQueue();
    app = createApp({ db, queue, startTime: new Date(), version: "0.0.0-test" });
  });

  // ─── POST /import ─────────────────────────────────────────────────────────

  it("POST /import with valid Netscape HTML returns 200 with total and importId", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([NETSCAPE_HTML], { type: "text/html" }),
      "bookmarks.html"
    );

    const res = await app.request("/import", { method: "POST", body: formData });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: { importId: string; total: number; warnings: number; progressUrl: string };
    };
    expect(json.data.total).toBe(2);
    expect(typeof json.data.importId).toBe("string");
    expect(json.data.importId.length).toBeGreaterThan(0);
    expect(json.data.progressUrl).toContain(json.data.importId);
  });

  it("POST /import without file field returns 422", async () => {
    const formData = new FormData();
    formData.append("not-a-file", "some text");

    const res = await app.request("/import", { method: "POST", body: formData });
    expect(res.status).toBe(422);
  });

  it("POST /import without multipart content type returns 415", async () => {
    const res = await app.request("/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "data" }),
    });
    expect(res.status).toBe(415);
  });

  // ─── Background processing ────────────────────────────────────────────────

  it("after import + small await, bookmarks are persisted in the DB", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([NETSCAPE_HTML], { type: "text/html" }),
      "bookmarks.html"
    );

    await app.request("/import", { method: "POST", body: formData });

    // Give the background async processor time to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const listRes = await app.request("/bookmarks");
    expect(listRes.status).toBe(200);
    const json = await listRes.json() as { data: unknown[]; pagination: { total: number } };
    expect(json.pagination.total).toBe(2);
  });

  it("imported Netscape bookmarks default pinned and read-later parity flags off", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([NETSCAPE_HTML], { type: "text/html" }),
      "bookmarks.html"
    );

    await app.request("/import", { method: "POST", body: formData });

    // Give the background async processor time to settle.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const listRes = await app.request("/bookmarks");
    expect(listRes.status).toBe(200);
    const json = await listRes.json() as {
      data: Array<{ is_pinned: 0 | 1; read_later: 0 | 1 }>;
    };
    expect(json.data.length).toBe(2);
    expect(json.data.every((bookmark) => bookmark.is_pinned === 0)).toBe(true);
    expect(json.data.every((bookmark) => bookmark.read_later === 0)).toBe(true);
  });

  it("imports Netscape folder hierarchy as categories and assigns bookmark categories", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Docs</H3>
  <DL><p>
    <DT><H3>Runtime</H3>
    <DL><p>
      <DT><A HREF="https://bun.sh/docs" ADD_DATE="1600000002">Bun Docs</A>
    </DL><p>
  </DL><p>
  <DT><H3>Empty Folder</H3>
  <DL><p>
  </DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><H3>Runtime</H3>
    <DL><p>
      <DT><A HREF="https://nodejs.org/en/docs" ADD_DATE="1600000003">Node Docs</A>
    </DL><p>
  </DL><p>
</DL><p>`;
    const formData = new FormData();
    formData.append("file", new Blob([html], { type: "text/html" }), "bookmarks.html");

    const res = await app.request("/import", { method: "POST", body: formData });
    expect(res.status).toBe(200);
    const summary = await res.json() as {
      data: { total: number; folders: number; progressUrl: string };
    };
    expect(summary.data.total).toBe(2);
    expect(summary.data.folders).toBe(5);

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const categories = db
      .query<{ id: string; name: string; parent_id: string | null }, []>(
        "SELECT id, name, parent_id FROM categories ORDER BY name, parent_id"
      )
      .all();
    const docs = categories.find((category) => category.name === "Docs" && category.parent_id === null);
    const work = categories.find((category) => category.name === "Work" && category.parent_id === null);
    const empty = categories.find((category) => category.name === "Empty Folder" && category.parent_id === null);
    expect(docs).toBeDefined();
    expect(work).toBeDefined();
    expect(empty).toBeDefined();

    const docsRuntime = categories.find(
      (category) => category.name === "Runtime" && category.parent_id === docs!.id
    );
    const workRuntime = categories.find(
      (category) => category.name === "Runtime" && category.parent_id === work!.id
    );
    expect(docsRuntime).toBeDefined();
    expect(workRuntime).toBeDefined();
    expect(docsRuntime!.id).not.toBe(workRuntime!.id);

    const bookmarks = db
      .query<{ url: string; category_id: string | null }, []>(
        "SELECT url, category_id FROM bookmarks ORDER BY url"
      )
      .all();
    expect(bookmarks).toContainEqual({
      url: "https://bun.sh/docs",
      category_id: docsRuntime!.id,
    });
    expect(bookmarks).toContainEqual({
      url: "https://nodejs.org/en/docs",
      category_id: workRuntime!.id,
    });
  });

  it("reuses imported category paths on re-import and reports category progress", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Research</H3>
  <DL><p>
    <DT><H3>Databases</H3>
    <DL><p>
      <DT><A HREF="https://sqlite.org/docs.html">SQLite Docs</A>
    </DL><p>
  </DL><p>
</DL><p>`;

    async function runImport(): Promise<string> {
      const formData = new FormData();
      formData.append("file", new Blob([html], { type: "text/html" }), "bookmarks.html");
      const res = await app.request("/import", { method: "POST", body: formData });
      expect(res.status).toBe(200);
      const json = await res.json() as { data: { progressUrl: string } };
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      return json.data.progressUrl;
    }

    const firstProgressUrl = await runImport();
    const firstProgress = await app.request(firstProgressUrl);
    expect(firstProgress.status).toBe(200);
    expect(await firstProgress.text()).toContain('"categoriesCreated":2');

    const secondProgressUrl = await runImport();
    const secondProgress = await app.request(secondProgressUrl);
    expect(secondProgress.status).toBe(200);
    expect(await secondProgress.text()).toContain('"categoriesReused":2');

    const categoryCount = db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM categories")
      .get()?.count ?? 0;
    expect(categoryCount).toBe(2);
  });

  it("caps imported folder categories at the supported three-level depth", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Level One</H3>
  <DL><p>
    <DT><H3>Level Two</H3>
    <DL><p>
      <DT><H3>Level Three</H3>
      <DL><p>
        <DT><H3>Level Four</H3>
        <DL><p>
          <DT><A HREF="https://example.com/deep-bookmark">Deep Bookmark</A>
        </DL><p>
      </DL><p>
    </DL><p>
  </DL><p>
</DL><p>`;
    const formData = new FormData();
    formData.append("file", new Blob([html], { type: "text/html" }), "bookmarks.html");

    const res = await app.request("/import", { method: "POST", body: formData });
    expect(res.status).toBe(200);
    const summary = await res.json() as {
      data: { folders: number; progressUrl: string };
    };
    expect(summary.data.folders).toBe(4);

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const progress = await app.request(summary.data.progressUrl);
    expect(progress.status).toBe(200);
    expect(await progress.text()).toContain('"categoriesCreated":3');

    const categories = db
      .query<{ id: string; name: string; parent_id: string | null }, []>(
        "SELECT id, name, parent_id FROM categories ORDER BY name"
      )
      .all();
    const thirdLevel = categories.find((category) => category.name === "Level Three");
    expect(thirdLevel).toBeDefined();
    expect(categories.some((category) => category.name === "Level Four")).toBe(false);

    const bookmark = db
      .query<{ category_id: string | null }, []>(
        "SELECT category_id FROM bookmarks WHERE url = 'https://example.com/deep-bookmark'"
      )
      .get();
    expect(bookmark?.category_id).toBe(thirdLevel!.id);
  });

  it("caps imported category names at the route-supported length", async () => {
    const longFolderName = "a".repeat(120);
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>${longFolderName}</H3>
  <DL><p>
    <DT><A HREF="https://example.com/long-folder">Long Folder Bookmark</A>
  </DL><p>
</DL><p>`;
    const formData = new FormData();
    formData.append("file", new Blob([html], { type: "text/html" }), "bookmarks.html");

    const res = await app.request("/import", { method: "POST", body: formData });
    expect(res.status).toBe(200);

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const category = db
      .query<{ id: string; name: string }, []>("SELECT id, name FROM categories LIMIT 1")
      .get();
    expect(category).toBeDefined();
    expect(category!.name).toBe("a".repeat(100));

    const bookmark = db
      .query<{ category_id: string | null }, []>(
        "SELECT category_id FROM bookmarks WHERE url = 'https://example.com/long-folder'"
      )
      .get();
    expect(bookmark?.category_id).toBe(category!.id);
  });
});
