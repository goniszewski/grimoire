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

  /** Upsert a tag by name (lower-cased). Returns the row. */
  upsert(name: string): TagRow {
    const normalised = name.toLowerCase().trim();
    this.db.run("INSERT OR IGNORE INTO tags (name) VALUES (?)", [normalised]);
    const row = this.findByName(normalised);
    if (!row) throw new Error(`Failed to upsert tag: ${name}`);
    return row;
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
}
