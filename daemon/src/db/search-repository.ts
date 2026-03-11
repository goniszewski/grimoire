import { Database } from "bun:sqlite";
import { BookmarkRow } from "./types.js";
import { BookmarkWithTags } from "./bookmark-repository.js";

// ─── Query option types ───────────────────────────────────────────────────────

export interface SearchOptions {
  q?: string;
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
}

export interface SearchResultItem extends BookmarkWithTags {
  snippet: string | null; // highlighted excerpt from title/summary/content
  rank: number | null;    // BM25 score (negative; lower = more relevant)
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class SearchRepository {
  constructor(private db: Database) {}

  search(opts: SearchOptions): SearchResult {
    const { q, tag, domain, category, date_from, date_to, limit, offset } = opts;
    const hasQuery = typeof q === "string" && q.trim().length > 0;

    // ── Build bookmark filter conditions ──────────────────────────────────────
    const conditions: string[] = ["b.is_archived = 0"];
    const filterParams: (string | number)[] = [];

    if (tag) {
      conditions.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ? COLLATE NOCASE)`
      );
      filterParams.push(tag);
    }
    if (domain) {
      conditions.push("b.domain = ?");
      filterParams.push(domain);
    }
    if (category) {
      conditions.push(
        "b.category_id = (SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1)"
      );
      filterParams.push(category);
    }
    if (date_from) {
      conditions.push("b.created_at >= ?");
      filterParams.push(date_from);
    }
    if (date_to) {
      conditions.push("b.created_at <= ?");
      filterParams.push(date_to);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    if (!hasQuery) {
      // ── Empty query: return all bookmarks sorted by date ──────────────────
      const total =
        this.db
          .query<{ count: number }, (string | number)[]>(
            `SELECT COUNT(*) AS count FROM bookmarks b ${where}`
          )
          .get(...filterParams)?.count ?? 0;

      const rows = this.db
        .query<BookmarkRow, (string | number)[]>(
          `SELECT b.* FROM bookmarks b ${where}
           ORDER BY b.created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(...filterParams, limit, offset);

      const items = this.attachTagsAndSnippet(rows, null);
      return { items, total, limit, offset };
    }

    // ── FTS5 query ────────────────────────────────────────────────────────────
    // FTS5 snippet() args: table, column_index (1=title), highlight start/end, ellipsis, num_tokens
    // column weights: title=10, summary=5, tags=5, content=1 (via bm25() column weights)
    const total =
      this.db
        .query<{ count: number }, (string | number)[]>(
          `SELECT COUNT(*) AS count
           FROM bookmarks_fts fts
           JOIN bookmarks b ON b.id = fts.bookmark_id
           ${where}
             AND fts.bookmarks_fts MATCH ?`
        )
        .get(...filterParams, q!.trim())?.count ?? 0;

    interface FtsRow extends BookmarkRow {
      snippet: string;
      rank: number;
    }

    const rows = this.db
      .query<FtsRow, (string | number)[]>(
        `SELECT b.*,
                snippet(bookmarks_fts, 1, '<mark>', '</mark>', '…', 16) AS snippet,
                bm25(bookmarks_fts, 10, 5, 5, 1) AS rank
         FROM bookmarks_fts fts
         JOIN bookmarks b ON b.id = fts.bookmark_id
         ${where}
           AND fts.bookmarks_fts MATCH ?
         ORDER BY rank
         LIMIT ? OFFSET ?`
      )
      .all(...filterParams, q!.trim(), limit, offset);

    const items = this.attachTagsAndSnippet(
      rows.map((r) => ({ ...r })),
      rows
    );
    return { items, total, limit, offset };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private attachTagsAndSnippet(
    rows: BookmarkRow[],
    ftsRows: Array<{ id: string; snippet: string; rank: number }> | null
  ): SearchResultItem[] {
    const items: SearchResultItem[] = rows.map((r) => ({
      ...r,
      tags: [],
      snippet: null,
      rank: null,
    }));

    if (ftsRows) {
      const snippetMap = new Map(ftsRows.map((r) => [r.id, { snippet: r.snippet, rank: r.rank }]));
      for (const item of items) {
        const s = snippetMap.get(item.id);
        if (s) {
          item.snippet = s.snippet;
          item.rank = s.rank;
        }
      }
    }

    if (rows.length === 0) return items;

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

    return items;
  }
}
