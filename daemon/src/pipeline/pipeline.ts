/**
 * Content extraction pipeline.
 *
 * Stages:
 *   1. fetch       — download the page HTML
 *   2. extract     — strategy-based content extraction
 *   3. ai_enrich   — LLM summary + tags + category
 *   4. embed       — generate embedding vector (stub; implemented in TASK-008)
 *   5. index       — update FTS5 search index
 *
 * Each stage:
 *   - Updates bookmark.status on success
 *   - Logs the error and re-throws on failure (caller decides retry behaviour)
 *
 * Failure behaviour per task spec:
 *   - Fetch failure   → bookmark stays "saved",  caller logs + retries
 *   - Extract failure → falls back to title only, pipeline continues
 *   - LLM failure     → bookmark usable without enrichment, pipeline continues
 *   - Embed failure   → caller retries
 */

import { Database } from "bun:sqlite";
import { log } from "../logger.js";
import { fetchPage } from "./fetcher.js";
import { extractContent } from "./extractor.js";
import { enrichBookmark } from "../ai/enrichment.js";
import { Config } from "../config.js";
import { BookmarkContentRow } from "../db/types.js";

export interface PipelinePayload {
  bookmarkId: string;
  url: string;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function setStatus(
  db: Database,
  bookmarkId: string,
  status: "saved" | "fetched" | "extracted" | "ai_enriched" | "indexed"
): void {
  db.run("UPDATE bookmarks SET status = ? WHERE id = ?", [status, bookmarkId]);
}

function upsertContent(
  db: Database,
  bookmarkId: string,
  data: Partial<Omit<BookmarkContentRow, "bookmark_id" | "extracted_at">>
): void {
  db.run(
    `INSERT INTO bookmark_content
       (bookmark_id, raw_html, markdown, summary, author, published_at, word_count, language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(bookmark_id) DO UPDATE SET
       raw_html     = excluded.raw_html,
       markdown     = excluded.markdown,
       summary      = excluded.summary,
       author       = excluded.author,
       published_at = excluded.published_at,
       word_count   = excluded.word_count,
       language     = excluded.language,
       extracted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
    [
      bookmarkId,
      data.raw_html ?? null,
      data.markdown ?? null,
      data.summary ?? null,
      data.author ?? null,
      data.published_at ?? null,
      data.word_count ?? null,
      data.language ?? null,
    ]
  );
}

function updateFts(
  db: Database,
  bookmarkId: string,
  title: string,
  content: string,
  tags: string
): void {
  // The FTS triggers handle INSERT/UPDATE on bookmarks, but content comes
  // from bookmark_content. We manually sync the content column here.
  db.run(
    `DELETE FROM bookmarks_fts WHERE bookmark_id = ?`,
    [bookmarkId]
  );
  db.run(
    `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
     VALUES (?, ?, '', ?, ?)`,
    [bookmarkId, title, tags, content]
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function runPipeline(
  db: Database,
  payload: PipelinePayload
): Promise<void> {
  const { bookmarkId, url } = payload;

  // Fetch current bookmark for fallback title
  const row = db
    .query<{ title: string | null }, [string]>(
      "SELECT title FROM bookmarks WHERE id = ?"
    )
    .get(bookmarkId);
  const existingTitle = row?.title ?? null;

  // ── Stage 1: fetch ────────────────────────────────────────────────────────
  log.info("Pipeline: fetch", { bookmarkId, url });
  const fetched = await fetchPage(url); // throws → stays "saved", caller retries
  setStatus(db, bookmarkId, "fetched");
  log.info("Pipeline: fetch done", { bookmarkId, finalUrl: fetched.finalUrl });

  // ── Stage 2: extract ─────────────────────────────────────────────────────
  log.info("Pipeline: extract", { bookmarkId });
  let extracted;
  try {
    extracted = await extractContent(url, fetched);
  } catch (err) {
    log.warn("Pipeline: extraction failed, storing title only", {
      bookmarkId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Graceful degradation: store minimal content so bookmark is still usable
    upsertContent(db, bookmarkId, {
      raw_html: fetched.html,
      markdown: existingTitle ?? url,
    });
    setStatus(db, bookmarkId, "extracted");
    return; // skip remaining stages
  }

  // Persist extraction results atomically.
  const title = extracted.title ?? existingTitle ?? url;
  db.transaction(() => {
    if (extracted.title && extracted.title !== existingTitle) {
      db.run("UPDATE bookmarks SET title = ? WHERE id = ?", [extracted.title, bookmarkId]);
    }
    upsertContent(db, bookmarkId, {
      raw_html: extracted.rawHtml,
      markdown: extracted.markdown,
      author: extracted.author,
      published_at: extracted.publishedAt,
      word_count: extracted.wordCount,
      language: extracted.language,
    });
    setStatus(db, bookmarkId, "extracted");
  })();
  log.info("Pipeline: extract done", { bookmarkId, wordCount: extracted.wordCount });

  // ── Stage 3: ai_enrich ────────────────────────────────────────────────────
  if (Config.LLM_API_KEY) {
    log.info("Pipeline: ai_enrich", { bookmarkId });
    try {
      await enrichBookmark(db, {
        baseUrl: Config.LLM_BASE_URL,
        apiKey: Config.LLM_API_KEY,
        model: Config.LLM_MODEL,
      }, {
        bookmarkId,
        title,
        content: extracted.markdown ?? "",
      });
      log.info("Pipeline: ai_enrich done", { bookmarkId });
    } catch (err) {
      log.warn("Pipeline: ai_enrich failed, continuing without enrichment", {
        bookmarkId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Non-fatal: bookmark is fully usable without LLM enrichment
    }
  } else {
    log.info("Pipeline: ai_enrich skipped (LLM_API_KEY not set)", { bookmarkId });
  }

  // ── Stage 4: embed (stub) ─────────────────────────────────────────────────
  // Full implementation in TASK-008.

  // ── Stage 5: index ────────────────────────────────────────────────────────
  log.info("Pipeline: index", { bookmarkId });
  try {
    const tagsRow = db
      .query<{ tags: string }, [string]>(
        `SELECT GROUP_CONCAT(t.name, ' ') AS tags
         FROM tags t
         JOIN bookmark_tags bt ON bt.tag_id = t.id
         WHERE bt.bookmark_id = ?`
      )
      .get(bookmarkId);
    const tags = tagsRow?.tags ?? "";
    db.transaction(() => {
      // setStatus fires trg_bookmarks_fts_update which resets content/tags to ''.
      // updateFts must run AFTER (inside the same transaction) to overwrite that
      // empty row with real content before the transaction commits.
      setStatus(db, bookmarkId, "indexed");
      updateFts(db, bookmarkId, title, extracted.markdown ?? "", tags);
    })();
    log.info("Pipeline: index done", { bookmarkId });
  } catch (err) {
    log.warn("Pipeline: FTS index update failed", {
      bookmarkId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Non-fatal: bookmark is still usable; FTS will pick it up on next rebuild
  }
}
