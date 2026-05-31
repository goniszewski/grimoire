import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { makeTestDb } from "./helpers/db.js";

describe("BookmarkRepository", () => {
  let db: Database;
  let repo: BookmarkRepository;

  beforeEach(() => {
    db = makeTestDb();
    repo = new BookmarkRepository(db);
  });

  // ─── Create ──────────────────────────────────────────────────────────────

  it("creates a bookmark with correct fields", () => {
    const bm = repo.create("https://example.com", "Example");
    expect(bm.url).toBe("https://example.com");
    expect(bm.domain).toBe("example.com");
    expect(bm.title).toBe("Example");
    expect(bm.is_trashed).toBe(0);
    expect(bm.is_archived).toBe(0);
    expect(bm.is_pinned).toBe(0);
    expect(bm.read_later).toBe(0);
    expect(bm.id).toBeString();
  });

  it("creates a bookmark without a title", () => {
    const bm = repo.create("https://no-title.com");
    expect(bm.title).toBeNull();
  });

  // ─── findById ────────────────────────────────────────────────────────────

  it("findById returns the bookmark", () => {
    const created = repo.create("https://example.com", "Test");
    const found = repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("findById returns null for unknown id", () => {
    expect(repo.findById("nonexistent")).toBeNull();
  });

  it("findById excludes trashed bookmarks", () => {
    const bm = repo.create("https://example.com", "Test");
    repo.softDelete(bm.id);
    expect(repo.findById(bm.id)).toBeNull();
  });

  // ─── Update ──────────────────────────────────────────────────────────────

  it("updates title", () => {
    const bm = repo.create("https://example.com", "Old");
    const updated = repo.update(bm.id, { title: "New Title" });
    expect(updated!.title).toBe("New Title");
  });

  it("updates notes", () => {
    const bm = repo.create("https://example.com");
    const updated = repo.update(bm.id, { notes: "My note" });
    expect(updated!.notes).toBe("My note");
  });

  it("clears notes when set to null", () => {
    const bm = repo.create("https://example.com");
    repo.update(bm.id, { notes: "Some note" });
    const cleared = repo.update(bm.id, { notes: null });
    expect(cleared!.notes).toBeNull();
  });

  it("updates is_pinned", () => {
    const bm = repo.create("https://example.com");
    const pinned = repo.update(bm.id, { is_pinned: 1 });
    expect(pinned!.is_pinned).toBe(1);
    const unpinned = repo.update(bm.id, { is_pinned: 0 });
    expect(unpinned!.is_pinned).toBe(0);
  });

  it("updates read_later separately from pinned", () => {
    const bm = repo.create("https://example.com");
    const readLater = repo.update(bm.id, { read_later: 1 });
    expect(readLater!.read_later).toBe(1);
    expect(readLater!.is_pinned).toBe(0);

    const pinned = repo.update(bm.id, { is_pinned: 1 });
    expect(pinned!.is_pinned).toBe(1);
    expect(pinned!.read_later).toBe(1);

    const cleared = repo.update(bm.id, { read_later: 0 });
    expect(cleared!.read_later).toBe(0);
    expect(cleared!.is_pinned).toBe(1);
  });

  it("updates is_archived", () => {
    const bm = repo.create("https://example.com");
    const archived = repo.update(bm.id, { is_archived: 1 });
    expect(archived!.is_archived).toBe(1);
  });

  it("updates read_at", () => {
    const bm = repo.create("https://example.com");
    const ts = "2026-01-01T00:00:00Z";
    const read = repo.update(bm.id, { read_at: ts });
    expect(read!.read_at).toBe(ts);
    const unread = repo.update(bm.id, { read_at: null });
    expect(unread!.read_at).toBeNull();
  });

  it("updates category_id", () => {
    const cat = db
      .query<{ id: string }, [string]>("INSERT INTO categories (name) VALUES (?) RETURNING id")
      .get("Dev")!;
    const bm = repo.create("https://example.com");
    const updated = repo.update(bm.id, { category_id: cat.id });
    expect(updated!.category_id).toBe(cat.id);
  });

  // ─── Tags ─────────────────────────────────────────────────────────────────

  it("adds and retrieves tags", () => {
    const bm = repo.create("https://example.com");
    repo.addTag(bm.id, "TypeScript");
    repo.addTag(bm.id, "React");
    const found = repo.findById(bm.id);
    expect(found!.tags).toContain("typescript");
    expect(found!.tags).toContain("react");
  });

  it("replaces tags via setTags (simulates tag removal)", () => {
    const bm = repo.create("https://example.com");
    repo.addTag(bm.id, "alpha");
    repo.addTag(bm.id, "beta");
    // setTags replaces all tags; removing "alpha" by keeping only "beta"
    repo.setTags(bm.id, ["beta"]);
    const found = repo.findById(bm.id);
    expect(found!.tags).not.toContain("alpha");
    expect(found!.tags).toContain("beta");
  });

  it("update with tags replaces existing tags", () => {
    const bm = repo.create("https://example.com");
    repo.addTag(bm.id, "old");
    const updated = repo.update(bm.id, { tags: ["new1", "new2"] });
    expect(updated!.tags).toContain("new1");
    expect(updated!.tags).toContain("new2");
    expect(updated!.tags).not.toContain("old");
  });

  // ─── Trash / Soft-delete ─────────────────────────────────────────────────

  it("softDelete sets is_trashed and trashed_at", () => {
    const bm = repo.create("https://example.com");
    expect(repo.softDelete(bm.id)).toBe(true);
    const row = db
      .query<{ is_trashed: number; trashed_at: string | null }, [string]>(
        "SELECT is_trashed, trashed_at FROM bookmarks WHERE id = ?"
      )
      .get(bm.id);
    expect(row!.is_trashed).toBe(1);
    expect(row!.trashed_at).not.toBeNull();
  });

  it("softDelete returns false for nonexistent bookmark", () => {
    expect(repo.softDelete("nonexistent")).toBe(false);
  });

  it("softDelete is idempotent — second call returns false", () => {
    const bm = repo.create("https://example.com");
    repo.softDelete(bm.id);
    expect(repo.softDelete(bm.id)).toBe(false);
  });

  it("list does not return trashed bookmarks", () => {
    const bm = repo.create("https://example.com");
    repo.softDelete(bm.id);
    const { items } = repo.list({ limit: 100, offset: 0 });
    expect(items.map((b) => b.id)).not.toContain(bm.id);
  });

  it("restore clears is_trashed and trashed_at, bookmark visible again", () => {
    const bm = repo.create("https://example.com");
    repo.softDelete(bm.id);
    expect(repo.restore(bm.id)).toBe(true);
    const found = repo.findById(bm.id);
    expect(found).not.toBeNull();
    expect(found!.is_trashed).toBe(0);
  });

  it("restore returns false for a non-trashed bookmark", () => {
    const bm = repo.create("https://example.com");
    expect(repo.restore(bm.id)).toBe(false);
  });

  it("listTrashed returns only trashed bookmarks", () => {
    const a = repo.create("https://a.com");
    const b = repo.create("https://b.com");
    repo.softDelete(a.id);
    const trashed = repo.listTrashed();
    expect(trashed.map((t) => t.id)).toContain(a.id);
    expect(trashed.map((t) => t.id)).not.toContain(b.id);
  });

  // ─── Permanent delete ─────────────────────────────────────────────────────

  it("permanentDelete removes a trashed bookmark from the DB", () => {
    const bm = repo.create("https://example.com");
    repo.softDelete(bm.id);
    expect(repo.permanentDelete(bm.id)).toBe(true);
    const row = db
      .query<{ id: string }, [string]>("SELECT id FROM bookmarks WHERE id = ?")
      .get(bm.id);
    expect(row).toBeNull();
  });

  it("permanentDelete returns false for a non-trashed bookmark", () => {
    const bm = repo.create("https://example.com");
    expect(repo.permanentDelete(bm.id)).toBe(false);
  });

  // ─── purgeExpired ─────────────────────────────────────────────────────────

  it("purgeExpired hard-deletes bookmarks trashed more than N days ago", () => {
    const bm = repo.create("https://old.com");
    db.run(
      "UPDATE bookmarks SET is_trashed = 1, trashed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-31 days') WHERE id = ?",
      [bm.id]
    );
    // purgeExpired returns db.changes which may include trigger-induced side-effects;
    // assert it is >= 1 (at least one bookmark row was deleted) and confirm the row is gone.
    expect(repo.purgeExpired(30)).toBeGreaterThan(0);
    expect(db.query<{ id: string }, [string]>("SELECT id FROM bookmarks WHERE id = ?").get(bm.id)).toBeNull();
  });

  it("purgeExpired keeps bookmarks trashed fewer than N days ago", () => {
    const bm = repo.create("https://recent.com");
    db.run(
      "UPDATE bookmarks SET is_trashed = 1, trashed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-5 days') WHERE id = ?",
      [bm.id]
    );
    expect(repo.purgeExpired(30)).toBe(0);
    expect(db.query<{ id: string }, [string]>("SELECT id FROM bookmarks WHERE id = ?").get(bm.id)).not.toBeNull();
  });

  it("purgeExpired skips rows with null trashed_at", () => {
    const bm = repo.create("https://example.com");
    db.run("UPDATE bookmarks SET is_trashed = 1 WHERE id = ?", [bm.id]);
    expect(repo.purgeExpired(30)).toBe(0);
  });

  // ─── FTS sync ─────────────────────────────────────────────────────────────

  it("creates an FTS row when a bookmark is created", () => {
    const bm = repo.create("https://fts-create.com", "FTS Test Bookmark");
    const ftsRow = db
      .query<{ rowid: number }, [string]>(
        "SELECT rowid FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(bm.id);
    expect(ftsRow).not.toBeNull();
  });

  it("updates FTS title when bookmark title is updated", () => {
    const bm = repo.create("https://fts-update.com", "Old Title");
    repo.update(bm.id, { title: "New Title" });
    const ftsRow = db
      .query<{ title: string }, [string]>(
        "SELECT title FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(bm.id);
    expect(ftsRow!.title).toBe("New Title");
  });

  it("removes FTS row when bookmark is permanently deleted", () => {
    const bm = repo.create("https://fts-delete.com", "Test");
    repo.softDelete(bm.id);
    repo.permanentDelete(bm.id);
    const ftsRow = db
      .query<{ rowid: number }, [string]>(
        "SELECT rowid FROM bookmarks_fts WHERE bookmark_id = ?"
      )
      .get(bm.id);
    expect(ftsRow).toBeNull();
  });

  // ─── Cascade ──────────────────────────────────────────────────────────────

  it("permanently deleting a bookmark removes its tag junctions", () => {
    const bm = repo.create("https://tag-cascade.com");
    repo.addTag(bm.id, "keep-me");
    repo.softDelete(bm.id);
    repo.permanentDelete(bm.id);
    const junctions = db
      .query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM bookmark_tags WHERE bookmark_id = ?"
      )
      .get(bm.id);
    expect(junctions!.count).toBe(0);
  });
});
