import { Database } from "bun:sqlite";
import { BookmarkRow, BookmarkContentRow, TagRow, JobRow } from "./types.js";

// ─── Query result shapes ──────────────────────────────────────────────────────

export interface BookmarkWithTags extends BookmarkRow {
  tags: string[]; // tag names
}

export interface BookmarkWithContent extends BookmarkWithTags {
  content: BookmarkContentRow | null;
}

export interface ListBookmarksOptions {
  limit: number;
  offset: number;
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  /** When true, return only archived (non-trashed) bookmarks instead of active ones. */
  archived?: boolean;
}

export interface ExportBookmarkRow {
  id: string;
  url: string;
  title: string | null;
  summary: string | null;
  tags: string[];
  category: string | null;
  domain: string;
  created_at: string;
}

export interface FilterOptions {
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
}

export interface ListResult {
  items: BookmarkWithTags[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class BookmarkRepository {
  constructor(private db: Database) {}

  /** Create a new bookmark record. Returns the inserted row. */
  create(url: string, title?: string): BookmarkRow {
    const domain = new URL(url).hostname;

    const row = this.db
      .query<BookmarkRow, [string, string, string | null]>(
        `INSERT INTO bookmarks (url, domain, title)
         VALUES (?, ?, ?)
         RETURNING *`
      )
      .get(url, domain, title ?? null);

    if (!row) throw new Error("Failed to insert bookmark");
    return row;
  }

  /** Find bookmark by ID (without content). */
  findById(id: string): BookmarkWithTags | null {
    const bookmark = this.db
      .query<BookmarkRow, [string]>("SELECT * FROM bookmarks WHERE id = ?")
      .get(id);
    if (!bookmark) return null;
    return { ...bookmark, tags: this.getTagNames(id) };
  }

  /** Find bookmark by URL. */
  findByUrl(url: string): BookmarkRow | null {
    return (
      this.db
        .query<BookmarkRow, [string]>("SELECT * FROM bookmarks WHERE url = ?")
        .get(url) ?? null
    );
  }

  /** Find bookmark with full content. */
  findByIdWithContent(id: string): BookmarkWithContent | null {
    const bookmark = this.findById(id);
    if (!bookmark) return null;

    const content =
      this.db
        .query<BookmarkContentRow, [string]>(
          "SELECT * FROM bookmark_content WHERE bookmark_id = ?"
        )
        .get(id) ?? null;

    return { ...bookmark, content };
  }

  /** Paginated list with optional filters. */
  list(opts: ListBookmarksOptions): ListResult {
    // Always exclude trashed bookmarks; archived flag controls which archived state to show
    const conditions: string[] = [
      "b.is_trashed = 0",
      opts.archived ? "b.is_archived = 1" : "b.is_archived = 0",
    ];
    const params: (string | number)[] = [];

    if (opts.tag) {
      conditions.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ? COLLATE NOCASE)`
      );
      params.push(opts.tag);
    }
    if (opts.domain) {
      conditions.push("b.domain = ?");
      params.push(opts.domain);
    }
    if (opts.category) {
      conditions.push(
        "b.category_id = (SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1)"
      );
      params.push(opts.category);
    }
    if (opts.date_from) {
      conditions.push("b.created_at >= ?");
      params.push(opts.date_from);
    }
    if (opts.date_to) {
      conditions.push("b.created_at <= ?");
      params.push(opts.date_to.length === 10 ? `${opts.date_to}T23:59:59Z` : opts.date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total =
      this.db
        .query<{ count: number }, (string | number)[]>(
          `SELECT COUNT(*) AS count FROM bookmarks b ${where}`
        )
        .get(...params)?.count ?? 0;

    const rows = this.db
      .query<BookmarkRow, (string | number)[]>(
        `SELECT b.* FROM bookmarks b ${where}
         ORDER BY b.is_pinned DESC, b.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, opts.limit, opts.offset);

    // Fetch all tags for this page in a single query to avoid N+1
    const items: BookmarkWithTags[] = rows.map((r) => ({ ...r, tags: [] }));
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const tagRows = this.db
        .query<{ bookmark_id: string; name: string }, string[]>(
          `SELECT bt.bookmark_id, t.name FROM tags t
           JOIN bookmark_tags bt ON bt.tag_id = t.id
           WHERE bt.bookmark_id IN (${placeholders})
           ORDER BY t.name`
        )
        .all(...ids);
      const tagMap = new Map<string, string[]>();
      for (const tr of tagRows) {
        const list = tagMap.get(tr.bookmark_id) ?? [];
        list.push(tr.name);
        tagMap.set(tr.bookmark_id, list);
      }
      for (const item of items) {
        item.tags = tagMap.get(item.id) ?? [];
      }
    }

    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  /** Export all active bookmarks (not archived, not trashed) with optional filters. */
  exportAll(filters: FilterOptions = {}): ExportBookmarkRow[] {
    const conditions: string[] = ["b.is_archived = 0", "b.is_trashed = 0"];
    const params: (string | number)[] = [];

    if (filters.tag) {
      conditions.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ? COLLATE NOCASE)`
      );
      params.push(filters.tag);
    }
    if (filters.domain) {
      conditions.push("b.domain = ?");
      params.push(filters.domain);
    }
    if (filters.category) {
      conditions.push(
        "b.category_id = (SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1)"
      );
      params.push(filters.category);
    }
    if (filters.date_from) {
      conditions.push("b.created_at >= ?");
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push("b.created_at <= ?");
      params.push(filters.date_to.length === 10 ? `${filters.date_to}T23:59:59Z` : filters.date_to);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const rows = this.db
      .query<
        BookmarkRow & { category_name: string | null; summary: string | null },
        (string | number)[]
      >(
        `SELECT b.*, c.name AS category_name,
                (SELECT bc.summary FROM bookmark_content bc WHERE bc.bookmark_id = b.id) AS summary
         FROM bookmarks b
         LEFT JOIN categories c ON c.id = b.category_id
         ${where}
         ORDER BY b.created_at DESC`
      )
      .all(...params);

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const tagRows = this.db
      .query<{ bookmark_id: string; name: string }, string[]>(
        `SELECT bt.bookmark_id, t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id IN (${placeholders})
         ORDER BY t.name`
      )
      .all(...ids);

    const tagMap = new Map<string, string[]>();
    for (const tr of tagRows) {
      const list = tagMap.get(tr.bookmark_id) ?? [];
      list.push(tr.name);
      tagMap.set(tr.bookmark_id, list);
    }

    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      summary: r.summary,
      tags: tagMap.get(r.id) ?? [],
      category: r.category_name,
      domain: r.domain,
      created_at: r.created_at,
    }));
  }

  /** Partial update: title, tags, category_id, is_pinned, is_archived, read_at. */
  update(
    id: string,
    patch: {
      title?: string | null;
      category_id?: string | null;
      tags?: string[];
      is_pinned?: 0 | 1;
      is_archived?: 0 | 1;
      read_at?: string | null;
    }
  ): BookmarkWithTags | null {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if ("title" in patch) {
      sets.push("title = ?");
      params.push(patch.title ?? null);
    }
    if ("category_id" in patch) {
      sets.push("category_id = ?");
      params.push(patch.category_id ?? null);
    }
    if ("is_pinned" in patch) {
      sets.push("is_pinned = ?");
      params.push(patch.is_pinned!);
    }
    if ("is_archived" in patch) {
      sets.push("is_archived = ?");
      params.push(patch.is_archived!);
    }
    if ("read_at" in patch) {
      sets.push("read_at = ?");
      params.push(patch.read_at ?? null);
    }

    this.db.transaction(() => {
      if (sets.length) {
        this.db
          .query(`UPDATE bookmarks SET ${sets.join(", ")} WHERE id = ?`)
          .run(...params, id);
      }

      if (patch.tags !== undefined) {
        this.setTags(id, patch.tags!);
      }
    })();

    return this.findById(id);
  }

  /** Soft delete: mark as trashed (hidden from all views, including archive). */
  softDelete(id: string): boolean {
    const info = this.db.run(
      "UPDATE bookmarks SET is_trashed = 1, trashed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ? AND is_trashed = 0",
      [id]
    );
    return info.changes > 0;
  }

  /** Restore a trashed bookmark back to the active library. */
  restore(id: string): boolean {
    const info = this.db.run(
      "UPDATE bookmarks SET is_trashed = 0, trashed_at = NULL WHERE id = ? AND is_trashed = 1",
      [id]
    );
    return info.changes > 0;
  }

  /** Hard-delete a trashed bookmark immediately. Only operates on bookmarks already in trash. */
  permanentDelete(id: string): boolean {
    const info = this.db.run("DELETE FROM bookmarks WHERE id = ? AND is_trashed = 1", [id]);
    return info.changes > 0;
  }

  /** List trashed bookmarks, ordered by trashed_at desc. */
  listTrashed(): BookmarkWithTags[] {
    const rows = this.db
      .query<BookmarkRow, []>(
        "SELECT * FROM bookmarks WHERE is_trashed = 1 ORDER BY trashed_at DESC, created_at DESC"
      )
      .all();

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const tagRows = this.db
      .query<{ bookmark_id: string; name: string }, string[]>(
        `SELECT bt.bookmark_id, t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id IN (${placeholders})
         ORDER BY t.name`
      )
      .all(...ids);

    const tagMap = new Map<string, string[]>();
    for (const tr of tagRows) {
      const list = tagMap.get(tr.bookmark_id) ?? [];
      list.push(tr.name);
      tagMap.set(tr.bookmark_id, list);
    }

    return rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
  }

  /** Hard-delete all trashed bookmarks older than the given number of days. Returns count deleted. */
  purgeExpired(days = 30): number {
    const modifier = `-${days} days`;
    const info = this.db.run(
      `DELETE FROM bookmarks
       WHERE is_trashed = 1
         AND trashed_at IS NOT NULL
         AND trashed_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)`,
      [modifier]
    );
    return info.changes;
  }

  /** Upsert a tag by name (case-insensitive) and link it to a bookmark. */
  addTag(bookmarkId: string, tagName: string): void {
    const normalised = tagName.toLowerCase();
    // INSERT OR IGNORE ensures we never duplicate; RETURNING gives us the id
    // whether the row is new or already existed (SELECT fallback handles the
    // case where INSERT was a no-op and nothing is returned).
    const inserted = this.db
      .query<TagRow, [string]>(
        `INSERT OR IGNORE INTO tags (name) VALUES (?) RETURNING *`
      )
      .get(normalised);
    const tag =
      inserted ??
      this.db
        .query<TagRow, [string]>("SELECT * FROM tags WHERE name = ? COLLATE NOCASE")
        .get(normalised);
    if (!tag) return;
    this.db.run(
      `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`,
      [bookmarkId, tag.id]
    );
  }

  /** Replace all tags for a bookmark. Runs in a transaction. */
  setTags(bookmarkId: string, tagNames: string[]): void {
    this.db.transaction(() => {
      this.db
        .query("DELETE FROM bookmark_tags WHERE bookmark_id = ?")
        .run(bookmarkId);
      for (const name of tagNames) {
        this.addTag(bookmarkId, name);
      }
    })();
  }

  /** Get pipeline job status for a bookmark (most recent job). */
  getPipelineStatus(bookmarkId: string): JobRow | null {
    return (
      this.db
        .query<JobRow, [string]>(
          `SELECT * FROM jobs WHERE json_extract(payload, '$.bookmarkId') = ?
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(bookmarkId) ?? null
    );
  }

  /** List all domains with bookmark counts, ordered by count desc. */
  listDomains(): { domain: string; count: number }[] {
    return this.db
      .query<{ domain: string; count: number }, []>(
        `SELECT domain, COUNT(*) AS count
         FROM bookmarks
         WHERE is_archived = 0 AND is_trashed = 0
         GROUP BY domain
         ORDER BY count DESC, domain ASC`
      )
      .all();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private getTagNames(bookmarkId: string): string[] {
    return this.db
      .query<{ name: string }, [string]>(
        `SELECT t.name FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?
         ORDER BY t.name`
      )
      .all(bookmarkId)
      .map((r) => r.name);
  }
}
