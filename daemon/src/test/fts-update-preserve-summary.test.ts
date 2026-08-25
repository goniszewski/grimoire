import { describe, expect, it } from "bun:test";
import { makeTestDb } from "./helpers/db.js";

describe("trg_bookmarks_fts_update (0018)", () => {
  it("does not wipe LLM summary from FTS when a bookmark is pinned", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, description, status)
       VALUES (?, 'https://example.com/pin-fts', 'example.com', 'Title', 'migrateddesc', 'indexed')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, summary, markdown)
       VALUES (?, 'llmsummarytoken', 'body')`,
      [id]
    );
    db.run(`DELETE FROM bookmarks_fts WHERE bookmark_id = ?`, [id]);
    db.run(
      `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
       VALUES (?, 'Title', 'migrateddesc llmsummarytoken', '', 'body')`,
      [id]
    );

    db.run("UPDATE bookmarks SET is_pinned = 1 WHERE id = ?", [id]);

    const fts = db
      .query<{ summary: string | null; title: string | null }, [string]>(
        "SELECT summary, title FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(id);
    expect(fts?.summary).toContain("llmsummarytoken");
    expect(fts?.summary).toContain("migrateddesc");
    expect(fts?.title).toBe("Title");
  });
});
