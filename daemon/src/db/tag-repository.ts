import { Database } from "bun:sqlite";
import { TagRow } from "./types.js";

// ─── Shapes ───────────────────────────────────────────────────────────────────

export interface TagWithCount extends TagRow {
  bookmark_count: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class TagRepository {
  constructor(private db: Database) {}

  /** List all tags with bookmark counts, sorted by name. */
  list(): TagWithCount[] {
    return this.db
      .query<TagWithCount, []>(
        `SELECT t.*,
                COUNT(b.id) AS bookmark_count
         FROM tags t
         LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
         LEFT JOIN bookmarks b ON b.id = bt.bookmark_id AND b.is_archived = 0 AND b.is_trashed = 0
         GROUP BY t.id
         ORDER BY t.name`
      )
      .all();
  }

  findById(id: string): TagRow | null {
    return (
      this.db
        .query<TagRow, [string]>("SELECT * FROM tags WHERE id = ?")
        .get(id) ?? null
    );
  }

  findByName(name: string): TagRow | null {
    return (
      this.db
        .query<TagRow, [string]>(
          "SELECT * FROM tags WHERE name = ? COLLATE NOCASE"
        )
        .get(name) ?? null
    );
  }

  /** Upsert a tag by name (lower-cased). Returns the row. Description only applies to newly created tags. */
  upsert(name: string, description?: string | null): TagRow {
    const normalised = name.toLowerCase().trim();
    this.db.run("INSERT OR IGNORE INTO tags (name, description) VALUES (?, ?)", [
      normalised,
      description ?? null,
    ]);
    const row = this.findByName(normalised);
    if (!row) throw new Error(`Failed to upsert tag: ${name}`);
    return row;
  }

  /** Rename a tag. Bookmark associations stay attached by tag ID. */
  rename(id: string, name: string): TagRow | null {
    const normalised = name.toLowerCase().trim();
    return this.db.transaction(() => {
      const row =
        this.db
          .query<TagRow, [string, string]>("UPDATE tags SET name = ? WHERE id = ? RETURNING *")
          .get(normalised, id) ?? null;
      if (!row) return null;
      this.refreshFtsTagsForTag(id);
      return row;
    })();
  }

  /** Update a tag's name and/or description. Omitted fields are left unchanged. */
  update(id: string, patch: { name?: string; description?: string | null }): TagRow | null {
    return this.db.transaction(() => {
      const sets: string[] = [];
      const params: (string | null)[] = [];
      if (patch.name !== undefined) {
        sets.push("name = ?");
        params.push(patch.name.toLowerCase().trim());
      }
      if (patch.description !== undefined) {
        sets.push("description = ?");
        params.push(patch.description);
      }
      if (sets.length === 0) return this.findById(id);
      const row =
        this.db
          .query<TagRow, (string | null)[]>(`UPDATE tags SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
          .get(...params, id) ?? null;
      if (!row) return null;
      if (patch.name !== undefined) this.refreshFtsTagsForTag(id);
      return row;
    })();
  }

  /**
   * Delete a tag and detach it from all bookmarks.
   * The ON DELETE CASCADE on bookmark_tags handles the cleanup.
   */
  delete(id: string): boolean {
    const info = this.db.run("DELETE FROM tags WHERE id = ?", [id]);
    return info.changes > 0;
  }

  /** Attach a tag to a bookmark (idempotent). */
  attachToBookmark(bookmarkId: string, tagId: string): void {
    this.db.run(
      "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      [bookmarkId, tagId]
    );
  }

  /** Detach a tag from a bookmark. */
  detachFromBookmark(bookmarkId: string, tagId: string): boolean {
    const info = this.db.run(
      "DELETE FROM bookmark_tags WHERE bookmark_id = ? AND tag_id = ?",
      [bookmarkId, tagId]
    );
    return info.changes > 0;
  }

  private refreshFtsTagsForTag(tagId: string): void {
    this.db.run(
      `UPDATE bookmarks_fts
       SET tags = (
         SELECT COALESCE(GROUP_CONCAT(t.name, ' '), '')
         FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = bookmarks_fts.bookmark_id
       )
       WHERE bookmark_id IN (
         SELECT bookmark_id FROM bookmark_tags WHERE tag_id = ?
       )`,
      [tagId]
    );
  }
}
