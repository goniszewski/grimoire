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

function formWithHtml(html: string, extraFields: Record<string, string> = {}): FormData {
  const formData = new FormData();
  formData.append("file", new Blob([html], { type: "text/html" }), "bookmarks.html");
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value);
  }
  return formData;
}

async function createBookmark(app: ReturnType<typeof createApp>, url: string, title: string): Promise<string> {
  const res = await app.request("/bookmarks", {
    method: "POST",
    body: JSON.stringify({ url, title }),
  });
  expect(res.status).toBe(201);
  const json = await res.json() as { data: { id: string } };
  return json.data.id;
}

function bookmarkByUrl<T extends Record<string, unknown>>(
  db: Database,
  url: string,
  fields = "*"
): T | null {
  return db
    .query<T, [string]>(`SELECT ${fields} FROM bookmarks WHERE url = ?`)
    .get(url) ?? null;
}

function tagNamesForBookmark(db: Database, bookmarkId: string): string[] {
  return db
    .query<{ name: string }, [string]>(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name`
    )
    .all(bookmarkId)
    .map((tag) => tag.name);
}

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
    const formData = formWithHtml(NETSCAPE_HTML);

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
    const formData = formWithHtml(NETSCAPE_HTML);

    await app.request("/import", { method: "POST", body: formData });

    // Give the background async processor time to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const listRes = await app.request("/bookmarks");
    expect(listRes.status).toBe(200);
    const json = await listRes.json() as { data: unknown[]; pagination: { total: number } };
    expect(json.pagination.total).toBe(2);
  });

  it("imported Netscape bookmarks default pinned and read-later parity flags off", async () => {
    const formData = formWithHtml(NETSCAPE_HTML);

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

  it("POST /import/preview classifies new, duplicate, invalid, and private rows without mutating data", async () => {
    const activeId = await createBookmark(app, "https://active.example.com", "Active");
    const archivedId = await createBookmark(app, "https://archived.example.com", "Archived");
    const trashedId = await createBookmark(app, "https://trashed.example.com", "Trashed");
    await app.request(`/bookmarks/${archivedId}`, {
      method: "PUT",
      body: JSON.stringify({ is_archived: 1 }),
    });
    await app.request(`/bookmarks/${trashedId}`, { method: "DELETE" });

    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Research</H3>
  <DL><p>
    <DT><A HREF="https://new.example.com" TAGS="fresh,review">New Row</A>
    <DT><A HREF="https://active.example.com" TAGS="incoming">Active Duplicate</A>
    <DT><A HREF="https://archived.example.com" TAGS="incoming">Archived Duplicate</A>
    <DT><A HREF="https://trashed.example.com" TAGS="incoming">Trashed Duplicate</A>
    <DT><A HREF="notaurl">Broken Row</A>
    <DT><A HREF="http://127.0.0.1/admin">Private Row</A>
  </DL><p>
</DL><p>`;

    const res = await app.request("/import/preview", {
      method: "POST",
      body: formWithHtml(html),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        duplicatePolicy: { active: string; archived: string; trashed: string };
        summary: {
          totalRows: number;
          new: number;
          activeDuplicates: number;
          archivedDuplicates: number;
          trashedDuplicates: number;
          invalidUrls: number;
          privateUrls: number;
          skipped: number;
        };
        folders: string[][];
        tags: string[];
        rows: Array<{
          classification: string;
          url: string | null;
          title: string;
          existingBookmarkId: string | null;
        }>;
      };
    };
    expect(json.data.duplicatePolicy).toEqual({
      active: "skip",
      archived: "skip",
      trashed: "skip",
    });
    expect(json.data.summary).toMatchObject({
      totalRows: 6,
      new: 1,
      activeDuplicates: 1,
      archivedDuplicates: 1,
      trashedDuplicates: 1,
      invalidUrls: 1,
      privateUrls: 1,
      skipped: 5,
    });
    expect(json.data.folders).toEqual([["Research"]]);
    expect(json.data.tags).toEqual(["fresh", "incoming", "review"]);
    expect(json.data.rows.map((row) => row.classification)).toEqual([
      "new",
      "active_duplicate",
      "archived_duplicate",
      "trashed_duplicate",
      "invalid_url",
      "private_url",
    ]);
    expect(json.data.rows[1]).toMatchObject({
      url: "https://active.example.com",
      existingBookmarkId: activeId,
    });

    const bookmarkCount = db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM bookmarks")
      .get()?.count ?? 0;
    expect(bookmarkCount).toBe(3);
  });

  it("POST /import/preview includes normalized folder and tag remapping decisions", async () => {
    const existingCategory = db
      .query<{ id: string }, []>("INSERT INTO categories (name) VALUES ('Existing Research') RETURNING id")
      .get();
    const existingTag = db
      .query<{ id: string }, []>("INSERT INTO tags (name) VALUES ('curated') RETURNING id")
      .get();
    expect(existingCategory).toBeDefined();
    expect(existingTag).toBeDefined();

    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Research</H3>
  <DL><p>
    <DT><A HREF="https://remap.example.com" TAGS="AI,Legacy,SkipMe">Remap Row</A>
    <DT><H3>AI</H3>
    <DL><p>
      <DT><A HREF="https://nested-remap.example.com" TAGS="AI">Nested Remap Row</A>
    </DL><p>
  </DL><p>
</DL><p>`;

    const res = await app.request("/import/preview", {
      method: "POST",
      body: formWithHtml(html, {
        remapping: JSON.stringify({
          folders: [
            {
              sourcePath: ["Research"],
              action: "existing",
              categoryId: existingCategory!.id,
            },
          ],
          tags: [
            { sourceTag: "ai", action: "renamed", targetName: "machine-learning" },
            { sourceTag: "legacy", action: "existing", tagId: existingTag!.id },
            { sourceTag: "skipme", action: "skipped" },
          ],
        }),
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        remapping: {
          folders: Array<{
            sourcePath: string[];
            action: string;
            targetCategoryId: string | null;
            targetPath: string[];
            status: string;
          }>;
          tags: Array<{
            sourceTag: string;
            action: string;
            targetTagId: string | null;
            targetName: string | null;
            status: string;
          }>;
        };
        rows: Array<{
          targetCategoryId: string | null;
          targetCategoryPath: string[];
          targetTags: string[];
        }>;
      };
    };

    expect(json.data.remapping.folders).toEqual([
      {
        sourcePath: ["Research"],
        action: "existing",
        targetCategoryId: existingCategory!.id,
        targetPath: ["Existing Research"],
        status: "existing",
      },
      {
        sourcePath: ["Research", "AI"],
        action: "create",
        targetCategoryId: null,
        targetPath: ["Existing Research", "AI"],
        status: "new",
      },
    ]);
    expect(json.data.remapping.tags).toContainEqual({
      sourceTag: "ai",
      action: "renamed",
      targetTagId: null,
      targetName: "machine-learning",
      status: "new",
    });
    expect(json.data.remapping.tags).toContainEqual({
      sourceTag: "legacy",
      action: "existing",
      targetTagId: existingTag!.id,
      targetName: "curated",
      status: "existing",
    });
    expect(json.data.remapping.tags).toContainEqual({
      sourceTag: "skipme",
      action: "skipped",
      targetTagId: null,
      targetName: null,
      status: "skipped",
    });
    expect(json.data.rows[0]).toMatchObject({
      targetCategoryId: existingCategory!.id,
      targetCategoryPath: ["Existing Research"],
      targetTags: ["curated", "machine-learning"],
    });
    expect(json.data.rows[1]).toMatchObject({
      targetCategoryId: null,
      targetCategoryPath: ["Existing Research", "AI"],
      targetTags: ["machine-learning"],
    });
  });

  it("POST /import applies category and tag remapping together with duplicate policy", async () => {
    const existingBookmarkId = await createBookmark(app, "https://merge.example.com", "Existing");
    await app.request(`/bookmarks/${existingBookmarkId}`, {
      method: "PUT",
      body: JSON.stringify({ tags: ["prior"], notes: "Existing note" }),
    });
    const existingCategory = db
      .query<{ id: string }, []>("INSERT INTO categories (name) VALUES ('Existing Research') RETURNING id")
      .get();
    const curatedTag = db
      .query<{ id: string }, []>("INSERT INTO tags (name) VALUES ('curated') RETURNING id")
      .get();
    expect(existingCategory).toBeDefined();
    expect(curatedTag).toBeDefined();

    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Research</H3>
  <DL><p>
    <DT><A HREF="https://merge.example.com" TAGS="AI,SkipMe" DESCRIPTION="Imported note">Merge Row</A>
    <DT><H3>AI</H3>
    <DL><p>
      <DT><A HREF="https://created-child.example.com" TAGS="AI">Created Child Row</A>
    </DL><p>
  </DL><p>
  <DT><H3>Incoming Folder</H3>
  <DL><p>
    <DT><A HREF="https://created.example.com" TAGS="Legacy,Docs">Created Row</A>
  </DL><p>
</DL><p>`;

    const res = await app.request("/import", {
      method: "POST",
      body: formWithHtml(html, {
        duplicatePolicy: JSON.stringify({ active: "merge" }),
        remapping: JSON.stringify({
          folders: [
            {
              sourcePath: ["Research"],
              action: "existing",
              categoryId: existingCategory!.id,
            },
            {
              sourcePath: ["Incoming Folder"],
              action: "create",
              targetPath: ["Imported", "Docs"],
            },
          ],
          tags: [
            { sourceTag: "ai", action: "renamed", targetName: "machine-learning" },
            { sourceTag: "skipme", action: "skipped" },
            { sourceTag: "legacy", action: "existing", tagId: curatedTag!.id },
          ],
        }),
      }),
    });

    expect(res.status).toBe(200);
    const summary = await res.json() as {
      data: {
        progressUrl: string;
        remapping: {
          folders: Array<{
            sourcePath: string[];
            action: string;
            targetCategoryId: string | null;
            targetPath: string[];
            status: string;
          }>;
          tags: Array<{ sourceTag: string; targetName: string | null; status: string }>;
        };
      };
    };
    expect(summary.data.remapping.folders).toContainEqual({
      sourcePath: ["Incoming Folder"],
      action: "create",
      targetCategoryId: null,
      targetPath: ["Imported", "Docs"],
      status: "new",
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const progress = await app.request(summary.data.progressUrl);
    expect(progress.status).toBe(200);
    const progressText = await progress.text();
    expect(progressText).toContain('"queued":2');
    expect(progressText).toContain('"merged":1');

    const merged = bookmarkByUrl<{ id: string; category_id: string | null; notes: string | null }>(
      db,
      "https://merge.example.com",
      "id, category_id, notes"
    );
    expect(merged).toMatchObject({
      id: existingBookmarkId,
      category_id: existingCategory!.id,
      notes: "Existing note\n\nImported note",
    });
    expect(tagNamesForBookmark(db, existingBookmarkId)).toEqual(["machine-learning", "prior"]);

    const inheritedChildCategory = db
      .query<{ id: string; parent_id: string | null }, [string]>(
        "SELECT id, parent_id FROM categories WHERE name = 'AI' AND parent_id = ?"
      )
      .get(existingCategory!.id);
    expect(inheritedChildCategory?.parent_id).toBe(existingCategory!.id);

    const inheritedChild = bookmarkByUrl<{ id: string; category_id: string | null }>(
      db,
      "https://created-child.example.com",
      "id, category_id"
    );
    expect(inheritedChild?.category_id).toBe(inheritedChildCategory!.id);
    expect(tagNamesForBookmark(db, inheritedChild!.id)).toEqual(["machine-learning"]);

    const importedDocs = db
      .query<{ id: string; parent_id: string | null }, []>(
        "SELECT id, parent_id FROM categories WHERE name = 'Docs'"
      )
      .get();
    const importedRoot = db
      .query<{ id: string }, []>("SELECT id FROM categories WHERE name = 'Imported'")
      .get();
    expect(importedRoot).toBeDefined();
    expect(importedDocs?.parent_id).toBe(importedRoot!.id);

    const created = bookmarkByUrl<{ id: string; category_id: string | null }>(
      db,
      "https://created.example.com",
      "id, category_id"
    );
    expect(created?.category_id).toBe(importedDocs!.id);
    expect(tagNamesForBookmark(db, created!.id)).toEqual(["curated", "docs"]);
  });

  it("POST /import/preview rejects conflicting tag remapping targets", async () => {
    db.query("INSERT INTO tags (name) VALUES ('existing')").run();
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://conflict.example.com" TAGS="incoming">Conflict Row</A>
</DL><p>`;

    const res = await app.request("/import/preview", {
      method: "POST",
      body: formWithHtml(html, {
        remapping: JSON.stringify({
          tags: [{ sourceTag: "incoming", action: "new", targetName: "existing" }],
        }),
      }),
    });

    expect(res.status).toBe(422);
    const json = await res.json() as { detail?: string };
    expect(json.detail).toContain("already exists");
  });

  it("POST /import/preview rejects invalid explicit tag remapping targets", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://invalid-tag-remap.example.com" TAGS="incoming">Invalid Tag Remap Row</A>
</DL><p>`;

    const res = await app.request("/import/preview", {
      method: "POST",
      body: formWithHtml(html, {
        remapping: JSON.stringify({
          tags: [{ sourceTag: "incoming", action: "renamed", targetName: "Machine Learning" }],
        }),
      }),
    });

    expect(res.status).toBe(422);
    const json = await res.json() as { detail?: string };
    expect(json.detail).toContain("single hyphens");
  });

  it("POST /import/preview treats repeated new source URLs as duplicates", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://source-duplicate.example.com" TAGS="first">First Source Row</A>
  <DT><A HREF="https://source-duplicate.example.com" TAGS="second">Second Source Row</A>
</DL><p>`;

    const res = await app.request("/import/preview", {
      method: "POST",
      body: formWithHtml(html),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as {
      data: {
        summary: {
          totalRows: number;
          new: number;
          activeDuplicates: number;
          created: number;
          skipped: number;
        };
        rows: Array<{ classification: string; action: string; existingBookmarkId: string | null }>;
      };
    };
    expect(json.data.summary).toMatchObject({
      totalRows: 2,
      new: 1,
      activeDuplicates: 1,
      created: 1,
      skipped: 1,
    });
    expect(json.data.rows).toMatchObject([
      { classification: "new", action: "create", existingBookmarkId: null },
      { classification: "active_duplicate", action: "skip", existingBookmarkId: null },
    ]);
  });

  it("POST /import handles repeated source URLs without unique constraint failures", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://source-duplicate.example.com/default" TAGS="first">First Source Row</A>
  <DT><A HREF="https://source-duplicate.example.com/default" TAGS="second">Second Source Row</A>
</DL><p>`;

    const res = await app.request("/import", {
      method: "POST",
      body: formWithHtml(html),
    });
    expect(res.status).toBe(200);
    const summary = await res.json() as { data: { progressUrl: string } };

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const progress = await app.request(summary.data.progressUrl);
    expect(progress.status).toBe(200);
    const progressText = await progress.text();
    expect(progressText).toContain('"queued":1');
    expect(progressText).toContain('"skipped":1');
    expect(progressText).toContain('"error":null');

    const rowsForUrl = db
      .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM bookmarks WHERE url = ?")
      .get("https://source-duplicate.example.com/default")?.count ?? 0;
    expect(rowsForUrl).toBe(1);
  });

  it("POST /import can merge repeated source URLs into the first created bookmark", async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://source-duplicate.example.com/merge" TAGS="first">First Source Row</A>
  <DD>First imported note
  <DT><A HREF="https://source-duplicate.example.com/merge" TAGS="second">Second Source Row</A>
  <DD>Second imported note
</DL><p>`;

    const res = await app.request("/import", {
      method: "POST",
      body: formWithHtml(html, {
        duplicatePolicy: JSON.stringify({ active: "merge" }),
      }),
    });
    expect(res.status).toBe(200);
    const summary = await res.json() as { data: { progressUrl: string } };

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const progress = await app.request(summary.data.progressUrl);
    expect(progress.status).toBe(200);
    const progressText = await progress.text();
    expect(progressText).toContain('"queued":1');
    expect(progressText).toContain('"merged":1');
    expect(progressText).toContain('"error":null');

    const bookmark = bookmarkByUrl<{ id: string; notes: string | null }>(
      db,
      "https://source-duplicate.example.com/merge",
      "id, notes"
    );
    expect(bookmark?.notes).toBe("First imported note\n\nSecond imported note");

    const tags = db
      .query<{ name: string }, [string]>(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?
         ORDER BY t.name`
      )
      .all(bookmark?.id ?? "")
      .map((tag) => tag.name);
    expect(tags).toEqual(["first", "second"]);
  });

  it("POST /import merges active duplicates when active duplicate policy is merge", async () => {
    const existingId = await createBookmark(app, "https://active.example.com/merge", "Existing");
    await app.request(`/bookmarks/${existingId}`, {
      method: "PUT",
      body: JSON.stringify({ tags: ["existing"], notes: "Existing note" }),
    });

    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Imported Folder</H3>
  <DL><p>
    <DT><A HREF="https://active.example.com/merge" TAGS="incoming,existing" DESCRIPTION="Imported note">Imported Active Duplicate</A>
  </DL><p>
</DL><p>`;

    const res = await app.request("/import", {
      method: "POST",
      body: formWithHtml(html, {
        duplicatePolicy: JSON.stringify({ active: "merge" }),
      }),
    });
    expect(res.status).toBe(200);
    const summary = await res.json() as { data: { progressUrl: string } };

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const progress = await app.request(summary.data.progressUrl);
    expect(progress.status).toBe(200);
    expect(await progress.text()).toContain('"merged":1');

    const rowsForUrl = db
      .query<{ count: number }, [string]>("SELECT COUNT(*) AS count FROM bookmarks WHERE url = ?")
      .get("https://active.example.com/merge")?.count ?? 0;
    expect(rowsForUrl).toBe(1);

    const bookmark = bookmarkByUrl<{ id: string; category_id: string | null; notes: string | null }>(
      db,
      "https://active.example.com/merge",
      "id, category_id, notes"
    );
    expect(bookmark?.id).toBe(existingId);
    expect(bookmark?.notes).toBe("Existing note\n\nImported note");
    const tags = db
      .query<{ name: string }, [string]>(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?
         ORDER BY t.name`
      )
      .all(existingId)
      .map((tag) => tag.name);
    expect(tags).toEqual(["existing", "incoming"]);

    const category = db
      .query<{ name: string }, [string | null]>("SELECT name FROM categories WHERE id = ?")
      .get(bookmark?.category_id ?? null);
    expect(category?.name).toBe("Imported Folder");
  });

  it("POST /import restores and merges archived and trashed duplicates when selected", async () => {
    const archivedId = await createBookmark(app, "https://archived.example.com/restore", "Archived");
    const trashedId = await createBookmark(app, "https://trashed.example.com/restore", "Trashed");
    await app.request(`/bookmarks/${archivedId}`, {
      method: "PUT",
      body: JSON.stringify({ is_archived: 1, tags: ["archived-old"] }),
    });
    await app.request(`/bookmarks/${trashedId}`, {
      method: "PUT",
      body: JSON.stringify({ tags: ["trashed-old"] }),
    });
    await app.request(`/bookmarks/${trashedId}`, { method: "DELETE" });

    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><A HREF="https://archived.example.com/restore" TAGS="archived-new">Archived Import</A>
  <DT><A HREF="https://trashed.example.com/restore" TAGS="trashed-new">Trashed Import</A>
</DL><p>`;

    const res = await app.request("/import", {
      method: "POST",
      body: formWithHtml(html, {
        duplicatePolicy: JSON.stringify({
          archived: "restore_merge",
          trashed: "restore_merge",
        }),
      }),
    });
    expect(res.status).toBe(200);
    const summary = await res.json() as { data: { progressUrl: string } };

    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const progress = await app.request(summary.data.progressUrl);
    expect(progress.status).toBe(200);
    expect(await progress.text()).toContain('"restored":2');

    const archived = bookmarkByUrl<{
      id: string;
      is_archived: 0 | 1;
      is_trashed: 0 | 1;
      trashed_at: string | null;
    }>(db, "https://archived.example.com/restore", "id, is_archived, is_trashed, trashed_at");
    const trashed = bookmarkByUrl<{
      id: string;
      is_archived: 0 | 1;
      is_trashed: 0 | 1;
      trashed_at: string | null;
    }>(db, "https://trashed.example.com/restore", "id, is_archived, is_trashed, trashed_at");
    expect(archived).toMatchObject({ id: archivedId, is_archived: 0, is_trashed: 0, trashed_at: null });
    expect(trashed).toMatchObject({ id: trashedId, is_archived: 0, is_trashed: 0, trashed_at: null });

    const tags = db
      .query<{ bookmark_id: string; name: string }, [string, string]>(
        `SELECT bt.bookmark_id, t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id IN (?, ?)
         ORDER BY bt.bookmark_id, t.name`
      )
      .all(archivedId, trashedId);
    expect(tags).toContainEqual({ bookmark_id: archivedId, name: "archived-new" });
    expect(tags).toContainEqual({ bookmark_id: archivedId, name: "archived-old" });
    expect(tags).toContainEqual({ bookmark_id: trashedId, name: "trashed-new" });
    expect(tags).toContainEqual({ bookmark_id: trashedId, name: "trashed-old" });
  });
});
