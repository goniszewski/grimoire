import { describe, expect, it } from "bun:test";
import { makeTestDb } from "./helpers/db.js";

describe("trg_bookmark_content_fts (0019)", () => {
  it("preserves bookmarks.description in FTS when content is inserted with null summary", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, description, status)
       VALUES (?, 'https://example.com/c', 'example.com', 'Title', 'migrateddesctoken', 'saved')`,
      [id]
    );
    // Insert trigger on bookmarks already seeded FTS with description; wipe summary
    // to simulate a stale row, then insert content with null summary.
    db.run(
      `UPDATE bookmarks_fts SET summary = 'migrateddesctoken', content = '' WHERE bookmark_id = ?`,
      [id]
    );

    db.run(
      `INSERT INTO bookmark_content (bookmark_id, markdown, summary)
       VALUES (?, 'title stub', NULL)`,
      [id]
    );

    const fts = db
      .query<{ summary: string | null; content: string | null }, [string]>(
        "SELECT summary, content FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(id);
    expect(fts?.summary).toContain("migrateddesctoken");
    expect(fts?.content).toBe("title stub");
  });

  it("concatenates description and non-blank content summary", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, description, status)
       VALUES (?, 'https://example.com/c2', 'example.com', 'Title', 'desctoken', 'saved')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, markdown, summary)
       VALUES (?, 'body', 'summarytoken')`,
      [id]
    );
    const fts = db
      .query<{ summary: string | null }, [string]>(
        "SELECT summary FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(id);
    expect(fts?.summary).toContain("desctoken");
    expect(fts?.summary).toContain("summarytoken");
  });
});
