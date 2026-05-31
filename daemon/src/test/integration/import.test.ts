import { describe, it, expect, beforeEach } from "bun:test";
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

  beforeEach(() => {
    const db = makeTestDb();
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
});
