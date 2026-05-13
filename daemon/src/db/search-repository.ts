import { Database } from "bun:sqlite";
import { BookmarkRow } from "./types.js";
import { BookmarkWithTags } from "./bookmark-repository.js";
import { EmbeddingRepository } from "./embedding-repository.js";
import { getEmbedding, cosineSimilarity, EmbeddingConfig } from "../ai/embeddings.js";

// ─── Query option types ───────────────────────────────────────────────────────

export type SearchMode = "keyword" | "semantic" | "hybrid";

export interface SearchOptions {
  q?: string;
  mode?: SearchMode;
  tag?: string;
  domain?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  limit: number;
  offset: number;
  /** Required for semantic/hybrid modes. */
  embeddingConfig?: EmbeddingConfig;
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

// ─── FTS5 query sanitisation ──────────────────────────────────────────────────

/**
 * Escape a raw user query string so it is safe to pass to the FTS5 MATCH
 * operator as a parameterised value.
 *
 * FTS5 treats a handful of characters as query operators when they appear in
 * certain positions. Rather than trying to replicate the full FTS5 grammar we
 * take a conservative approach:
 *   1. Strip control characters that have no meaning in a search term.
 *   2. Split on whitespace and wrap each token individually in double-quotes,
 *      escaping any embedded double-quotes by doubling them.
 *
 * Quoting per-token (rather than the whole string as a phrase) means that
 * multi-word queries like "typescript react" match documents containing both
 * words anywhere — not just as an adjacent phrase — while still preventing
 * FTS5 operator injection.
 *
 * Example:  hello "world" OR NOT foo
 *  tokens:  ["hello", '"world"', 'OR', 'NOT', 'foo']
 *  output:  "hello" """world""" "OR" "NOT" "foo"
 *
 * For more expressive power (operators, prefix search, etc.) callers can
 * switch to an "advanced" mode where the input is trusted — but that requires
 * explicit opt-in rather than being the default for arbitrary user text.
 */
function sanitizeFtsQuery(raw: string): string {
  const stripped = Array.from(raw, (char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f ? " " : char;
  }).join("").trim();
  if (!stripped) return '""';
  // Quote each whitespace-separated token individually so multi-word queries
  // match documents containing all tokens (AND semantics) rather than requiring
  // an exact phrase.
  return stripped
    .split(/\s+/)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" ");
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class SearchRepository {
  private embRepo: EmbeddingRepository;

  constructor(private db: Database) {
    this.embRepo = new EmbeddingRepository(db);
  }

  async search(opts: SearchOptions): Promise<SearchResult> {
    const mode = opts.mode ?? "keyword";
    if ((mode === "semantic" || mode === "hybrid") && opts.embeddingConfig && opts.q?.trim()) {
      return mode === "hybrid"
        ? this.hybridSearch(opts)
        : this.semanticSearch(opts);
    }
    return this.keywordSearch(opts);
  }

  // ─── Keyword (FTS5) search — synchronous ──────────────────────────────────

  keywordSearch(opts: SearchOptions): SearchResult {
    const { q, tag, domain, category, date_from, date_to, limit, offset } = opts;
    const hasQuery = typeof q === "string" && q.trim().length > 0;

    // ── Build bookmark filter conditions ──────────────────────────────────────
    const conditions: string[] = ["b.is_archived = 0", "b.is_trashed = 0"];
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
      // Normalize date-only strings to end-of-day to include all bookmarks on that day,
      // consistent with BookmarkRepository.list() behaviour.
      filterParams.push(date_to.length === 10 ? `${date_to}T23:59:59Z` : date_to);
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
    const ftsQuery = sanitizeFtsQuery(q!);

    const total =
      this.db
        .query<{ count: number }, (string | number)[]>(
          `SELECT COUNT(*) AS count
           FROM bookmarks_fts fts
           JOIN bookmarks b ON b.id = fts.bookmark_id
           ${where}
             AND fts.bookmarks_fts MATCH ?`
        )
        .get(...filterParams, ftsQuery)?.count ?? 0;

    interface FtsRow extends BookmarkRow {
      snippet: string;
      rank: number;
    }

    const rows = this.db
      .query<FtsRow, (string | number)[]>(
        `SELECT b.*,
                snippet(bookmarks_fts, 1, '[[HL]]', '[[/HL]]', '…', 16) AS snippet,
                bm25(bookmarks_fts, 10, 5, 5, 1) AS rank
         FROM bookmarks_fts fts
         JOIN bookmarks b ON b.id = fts.bookmark_id
         ${where}
           AND fts.bookmarks_fts MATCH ?
         ORDER BY rank
         LIMIT ? OFFSET ?`
      )
      .all(...filterParams, ftsQuery, limit, offset);

    const items = this.attachTagsAndSnippet(
      rows.map((r) => ({ ...r })),
      rows
    );
    return { items, total, limit, offset };
  }

  // ─── Semantic (vector) search ─────────────────────────────────────────────

  private async semanticSearch(opts: SearchOptions): Promise<SearchResult> {
    const { q, limit, offset, embeddingConfig } = opts;
    const queryVec = await getEmbedding(embeddingConfig!, q!.trim()); // plain text; sanitization only needed for FTS5 MATCH

    const allEmbeddings = this.embRepo.getAllForModel(embeddingConfig!.model);
    if (allEmbeddings.length === 0) return { items: [], total: 0, limit, offset };

    // Build filter set (archived bookmarks excluded)
    const allowedIds = this.getFilteredBookmarkIds(opts);

    const scored = allEmbeddings
      .filter((e) => allowedIds.has(e.bookmarkId))
      .map((e) => ({ id: e.bookmarkId, score: cosineSimilarity(queryVec, e.vector) }))
      .sort((a, b) => b.score - a.score);

    const total = scored.length;
    const page = scored.slice(offset, offset + limit);

    const bookmarkRows = this.fetchBookmarksByIds(page.map((s) => s.id));
    const scoreMap = new Map(page.map((s) => [s.id, s.score]));
    // Preserve ranking order from scored results
    const orderedRows = page.map((s) => bookmarkRows.get(s.id)).filter(Boolean) as BookmarkRow[];

    const items = this.attachTagsAndSnippet(orderedRows, null).map((item) => ({
      ...item,
      rank: scoreMap.get(item.id) ?? null,
    }));

    return { items, total, limit, offset };
  }

  // ─── Hybrid search (FTS + vector + recency) ───────────────────────────────

  private async hybridSearch(opts: SearchOptions): Promise<SearchResult> {
    const { q, limit, offset, embeddingConfig } = opts;

    // Run FTS and embedding in parallel
    const [ftsResult, queryVec] = await Promise.all([
      Promise.resolve(this.keywordSearch({ ...opts, limit: 200, offset: 0 })),
      getEmbedding(embeddingConfig!, q!.trim()),
    ]);

    const allEmbeddings = this.embRepo.getAllForModel(embeddingConfig!.model);
    const embMap = new Map(allEmbeddings.map((e) => [e.bookmarkId, e.vector]));

    const allowedIds = this.getFilteredBookmarkIds(opts);
    const allBookmarkIds = new Set([
      ...ftsResult.items.map((i) => i.id),
      // Include embedding-only results that passed the filter
      ...allEmbeddings.filter((e) => allowedIds.has(e.bookmarkId)).map((e) => e.bookmarkId),
    ]);

    // BM25 scores from FTS (normalise: BM25 is negative, lower = better)
    const ftsScores = new Map<string, number>();
    if (ftsResult.items.length > 0) {
      const minRank = Math.min(...ftsResult.items.map((i) => i.rank ?? 0));
      const maxRank = Math.max(...ftsResult.items.map((i) => i.rank ?? 0));
      const range = maxRank - minRank || 1;
      for (const item of ftsResult.items) {
        // Normalise to 0-1, invert (lower BM25 rank = more relevant)
        ftsScores.set(item.id, 1 - ((item.rank ?? minRank) - minRank) / range);
      }
    }

    // Recency score: exponential decay over 365 days
    const now = Date.now();
    const bookmarkDates = this.getBookmarkDates(Array.from(allBookmarkIds));

    const scored: Array<{ id: string; hybridScore: number }> = [];
    for (const id of allBookmarkIds) {
      const keywordScore = ftsScores.get(id) ?? 0;
      const vec = embMap.get(id);
      const vectorScore = vec ? Math.max(0, cosineSimilarity(queryVec, vec)) : 0;
      const createdAt = bookmarkDates.get(id) ?? now;
      const ageMs = now - createdAt;
      const ageDays = ageMs / 86_400_000;
      const recencyScore = Math.exp(-ageDays / 365);

      const hybridScore = keywordScore * 0.6 + vectorScore * 0.3 + recencyScore * 0.1;
      scored.push({ id, hybridScore });
    }

    scored.sort((a, b) => b.hybridScore - a.hybridScore);

    const total = scored.length;
    const page = scored.slice(offset, offset + limit);

    const bookmarkRows = this.fetchBookmarksByIds(page.map((s) => s.id));
    const scoreMap = new Map(page.map((s) => [s.id, s.hybridScore]));
    const orderedRows = page.map((s) => bookmarkRows.get(s.id)).filter(Boolean) as BookmarkRow[];

    const items = this.attachTagsAndSnippet(orderedRows, null).map((item) => ({
      ...item,
      rank: scoreMap.get(item.id) ?? null,
    }));

    return { items, total, limit, offset };
  }

  // ─── Related bookmarks ────────────────────────────────────────────────────

  /**
   * Find bookmarks semantically similar to a given bookmark.
   * Requires the bookmark to have an embedding stored.
   */
  findRelated(
    bookmarkId: string,
    model: string,
    limit = 10
  ): BookmarkWithTags[] {
    const source = this.embRepo.getByBookmarkId(bookmarkId);
    if (!source || source.model !== model) return [];

    const all = this.embRepo.getAllForModel(model);
    const scored = all
      .filter((e) => e.bookmarkId !== bookmarkId)
      .map((e) => ({ id: e.bookmarkId, score: cosineSimilarity(source.vector, e.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const bookmarkRows = this.fetchBookmarksByIds(scored.map((s) => s.id));
    const results: BookmarkWithTags[] = [];

    for (const s of scored) {
      const bm = bookmarkRows.get(s.id);
      if (bm) results.push({ ...bm, tags: [] });
    }

    // Attach tags in bulk
    if (results.length > 0) {
      const ids = results.map((r) => r.id);
      const placeholders = ids.map(() => "?").join(",");
      const tagRows = this.db
        .query<{ bookmark_id: string; name: string }, string[]>(
          `SELECT bt.bookmark_id, t.name FROM tags t
           JOIN bookmark_tags bt ON bt.tag_id = t.id
           WHERE bt.bookmark_id IN (${placeholders}) ORDER BY t.name`
        )
        .all(...ids);
      const tagMap = new Map<string, string[]>();
      for (const tr of tagRows) {
        const list = tagMap.get(tr.bookmark_id) ?? [];
        list.push(tr.name);
        tagMap.set(tr.bookmark_id, list);
      }
      for (const item of results) {
        item.tags = tagMap.get(item.id) ?? [];
      }
    }

    return results;
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

  /** Return a Set of bookmark IDs that pass the structural filters (not archived, tag, domain, etc). */
  private getFilteredBookmarkIds(opts: SearchOptions): Set<string> {
    const conditions: string[] = ["b.is_archived = 0", "b.is_trashed = 0"];
    const params: (string | number)[] = [];

    if (opts.tag) {
      conditions.push(
        `b.id IN (SELECT bt.bookmark_id FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.name = ? COLLATE NOCASE)`
      );
      params.push(opts.tag);
    }
    if (opts.domain) { conditions.push("b.domain = ?"); params.push(opts.domain); }
    if (opts.category) {
      conditions.push("b.category_id = (SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1)");
      params.push(opts.category);
    }
    if (opts.date_from) { conditions.push("b.created_at >= ?"); params.push(opts.date_from); }
    if (opts.date_to)   { conditions.push("b.created_at <= ?"); params.push(opts.date_to.length === 10 ? `${opts.date_to}T23:59:59Z` : opts.date_to); }

    const rows = this.db
      .query<{ id: string }, (string | number)[]>(
        `SELECT b.id FROM bookmarks b WHERE ${conditions.join(" AND ")}`
      )
      .all(...params);

    return new Set(rows.map((r) => r.id));
  }

  /** Fetch BookmarkRow by IDs as a Map for O(1) lookup. */
  private fetchBookmarksByIds(ids: string[]): Map<string, BookmarkRow> {
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .query<BookmarkRow, string[]>(
        `SELECT * FROM bookmarks WHERE id IN (${placeholders})`
      )
      .all(...ids);
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Get created_at timestamps for a set of bookmark IDs (for recency scoring). */
  private getBookmarkDates(ids: string[]): Map<string, number> {
    if (ids.length === 0) return new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db
      .query<{ id: string; created_at: string }, string[]>(
        `SELECT id, created_at FROM bookmarks WHERE id IN (${placeholders})`
      )
      .all(...ids);
    return new Map(rows.map((r) => [r.id, new Date(r.created_at).getTime()]));
  }
}
