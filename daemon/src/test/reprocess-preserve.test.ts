import { describe, expect, it } from "bun:test";
import { makeTestDb } from "./helpers/db.js";
import { shouldPreserveExistingOnReprocess } from "../pipeline/reprocess-preserve.js";

describe("shouldPreserveExistingOnReprocess", () => {
  it("preserves description-only migrated bookmarks on default Retry", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, description, status)
       VALUES (?, 'https://example.com/d', 'example.com', 'T', 'Migrated description', 'saved')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_provenance (bookmark_id, source) VALUES (?, 'legacy-v05')`,
      [id]
    );
    expect(shouldPreserveExistingOnReprocess(db, id, false)).toBe(true);
    expect(shouldPreserveExistingOnReprocess(db, id, undefined)).toBe(true);
  });

  it("does not preserve when replaceAiFields is true", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, description, status)
       VALUES (?, 'https://example.com/d', 'example.com', 'T', 'Migrated description', 'saved')`,
      [id]
    );
    expect(shouldPreserveExistingOnReprocess(db, id, true)).toBe(false);
  });

  it("preserves legacy:// media even without description/content", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, status)
       VALUES (?, 'https://example.com/m', 'example.com', 'T', 'saved')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_media
         (id, bookmark_id, kind, source_url, cache_path, media_type, size_bytes, alt, display_order)
       VALUES (?, ?, 'favicon', 'legacy://icon', 'media-cache/x.ico', 'image/x-icon', 16, NULL, 0)`,
      [crypto.randomUUID(), id]
    );
    expect(shouldPreserveExistingOnReprocess(db, id, false)).toBe(true);
  });

  it("preserves author/published_at-only migrated rows on default Retry", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, status)
       VALUES (?, 'https://example.com/a', 'example.com', 'T', 'saved')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, author, published_at)
       VALUES (?, 'Ada Lovelace', '2024-01-15')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_provenance (bookmark_id, source) VALUES (?, 'legacy-v05')`,
      [id]
    );
    expect(shouldPreserveExistingOnReprocess(db, id, false)).toBe(true);
    expect(shouldPreserveExistingOnReprocess(db, id, true)).toBe(false);
  });

  it("does not preserve content produced by a normal live pipeline run", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, description, status)
       VALUES (?, 'https://example.com/live', 'example.com', 'T', 'Live description', 'indexed')`,
      [id]
    );
    db.run(
      `INSERT INTO bookmark_content (bookmark_id, raw_html, markdown)
       VALUES (?, '<p>live</p>', 'live markdown')`,
      [id]
    );
    expect(shouldPreserveExistingOnReprocess(db, id, false)).toBe(false);
  });

  it("returns false for empty bookmarks", () => {
    const db = makeTestDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO bookmarks (id, url, domain, title, status)
       VALUES (?, 'https://example.com/e', 'example.com', 'T', 'saved')`,
      [id]
    );
    expect(shouldPreserveExistingOnReprocess(db, id, false)).toBe(false);
  });
});
