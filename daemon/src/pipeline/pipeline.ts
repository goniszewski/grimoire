/**
 * Content extraction pipeline.
 *
 * Stages:
 *   1. fetch       — download the page HTML
 *   2. extract     — strategy-based content extraction
 *   3. ai_enrich   — LLM summary + tags + category
 *   4. embed       — generate embedding vector (skipped when embeddings are not configured)
 *   5. index       — update FTS5 search index
 *
 * Failure behavior:
 *   - Fetch failure   -> throws; durable queue retries and bookmark stays "saved"
 *   - Extract failure -> stores minimal content and skips remaining stages
 *   - LLM failure     -> bookmark remains usable without AI enrichment
 *   - Embed failure   -> bookmark remains indexed without a semantic vector
 *   - Index failure   -> throws; durable queue retries
 */

import { Database } from "bun:sqlite";
import { log } from "../logger.js";
import { Config } from "../config.js";
import { fetchPage } from "./fetcher.js";
import { extractContent } from "./extractor.js";
import { enrichBookmark } from "../ai/enrichment.js";
import { getEmbedding, buildEmbedInput } from "../ai/embeddings.js";
import { EmbeddingRepository } from "../db/embedding-repository.js";
import { BookmarkContentRow } from "../db/types.js";
import { resolveRuntimeSettings } from "../runtime-settings.js";
import {
  clearPipelineFailure,
  errorMessage,
  recordPipelineFailure,
} from "./failures.js";
import {
  cacheBookmarkMedia,
  extractBookmarkMediaCandidates,
} from "../media/bookmark-media.js";

export interface PipelinePayload {
  bookmarkId: string;
  url: string;
}

export interface PipelineOptions {
  replaceAiFields?: boolean;
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
  // Read the current summary from bookmark_content (may have been written by ai_enrich stage).
  const summaryRow = db
    .query<{ summary: string | null }, [string]>(
      "SELECT summary FROM bookmark_content WHERE bookmark_id = ?"
    )
    .get(bookmarkId);
  const summary = summaryRow?.summary ?? "";

  // The FTS triggers handle INSERT/UPDATE on bookmarks, but content/summary come
  // from bookmark_content. We manually sync all columns here.
  db.run(`DELETE FROM bookmarks_fts WHERE bookmark_id = ?`, [bookmarkId]);
  db.run(
    `INSERT INTO bookmarks_fts(bookmark_id, title, summary, tags, content)
     VALUES (?, ?, ?, ?, ?)`,
    [bookmarkId, title, summary, tags, content]
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function runPipeline(
  db: Database,
  payload: PipelinePayload,
  options: PipelineOptions = {}
): Promise<void> {
  const { bookmarkId, url } = payload;
  const preserveExistingFields = options.replaceAiFields === false;
  clearPipelineFailure(db, bookmarkId);

  // Fetch current bookmark for fallback title
  const row = db
    .query<{ title: string | null }, [string]>(
      "SELECT title FROM bookmarks WHERE id = ?"
    )
    .get(bookmarkId);
  const existingTitle = row?.title ?? null;

  // ── Stage 1: fetch ────────────────────────────────────────────────────────
  log.info("Pipeline: fetch", { bookmarkId, url });
  let fetched;
  try {
    fetched = await fetchPage(url); // throws → stays "saved", caller retries
  } catch (err) {
    recordPipelineFailure(db, {
      bookmarkId,
      stage: "fetch",
      message: errorMessage(err),
    });
    throw err;
  }
  setStatus(db, bookmarkId, "fetched");
  log.info("Pipeline: fetch done", { bookmarkId, finalUrl: fetched.finalUrl });

  // ── Stage 2: extract ─────────────────────────────────────────────────────
  log.info("Pipeline: extract", { bookmarkId });
  let extracted;
  try {
    extracted = await extractContent(url, fetched, existingTitle);
  } catch (err) {
    const message = errorMessage(err);
    recordPipelineFailure(db, {
      bookmarkId,
      stage: "extract",
      message,
    });
    log.warn("Pipeline: extraction failed, storing title only", {
      bookmarkId,
      error: message,
    });
    // Graceful degradation: store minimal content so bookmark is still usable.
    // Cap raw HTML to avoid storing up to 10 MB per failed bookmark.
    upsertContent(db, bookmarkId, {
      raw_html: fetched.html ? fetched.html.slice(0, 500_000) : null,
      markdown: existingTitle ?? url,
    });
    setStatus(db, bookmarkId, "extracted");
    return; // skip remaining stages
  }

  // Persist extraction results atomically.
  const title = preserveExistingFields
    ? existingTitle ?? extracted.title ?? url
    : extracted.title ?? existingTitle ?? url;
  db.transaction(() => {
    // Build a short description excerpt from markdown for the list view.
    // This is overwritten later if LLM enrichment produces a proper summary.
    const descriptionExcerpt = extracted.markdown
      ? extracted.markdown.replace(/#+\s/g, "").replace(/\n+/g, " ").trim().slice(0, 300)
      : null;

    const sets: string[] = [];
    const setParams: (string | null)[] = [];
    if (
      extracted.title &&
      extracted.title !== existingTitle &&
      (!preserveExistingFields || !existingTitle)
    ) {
      sets.push("title = ?");
      setParams.push(extracted.title);
    }
    if (descriptionExcerpt) {
      sets.push("description = ?");
      setParams.push(descriptionExcerpt);
    }
    if (sets.length) {
      db.run(`UPDATE bookmarks SET ${sets.join(", ")} WHERE id = ?`, [...setParams, bookmarkId]);
    }
    // Cap raw HTML stored in the DB to 500 KB — up to 10 MB may have been fetched.
    // Storing the full body would cause unbounded DB growth (10 MB per bookmark).
    const RAW_HTML_STORE_LIMIT = 500_000;
    upsertContent(db, bookmarkId, {
      raw_html: extracted.rawHtml
        ? extracted.rawHtml.slice(0, RAW_HTML_STORE_LIMIT)
        : null,
      markdown: extracted.markdown,
      author: extracted.author,
      published_at: extracted.publishedAt,
      word_count: extracted.wordCount,
      language: extracted.language,
    });
    setStatus(db, bookmarkId, "extracted");
  })();

  try {
    const mediaCandidates = extractBookmarkMediaCandidates(
      fetched.finalUrl || url,
      extracted.rawHtml ?? fetched.html ?? ""
    );
    await cacheBookmarkMedia(db, {
      bookmarkId,
      dataDir: Config.DATA_DIR,
      candidates: mediaCandidates,
    });
  } catch (err) {
    log.warn("Pipeline: media cache skipped", {
      bookmarkId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("Pipeline: extract done", { bookmarkId, wordCount: extracted.wordCount });

  const runtimeSettings = resolveRuntimeSettings();

  // ── Stage 3: ai_enrich ────────────────────────────────────────────────────
  if (runtimeSettings.llmConfig) {
    log.info("Pipeline: ai_enrich", { bookmarkId });
    try {
      await enrichBookmark(db, runtimeSettings.llmConfig, {
        bookmarkId,
        title,
        content: extracted.markdown ?? "",
      }, {
        preserveCategory: preserveExistingFields,
        preserveTags: preserveExistingFields,
      });
      log.info("Pipeline: ai_enrich done", { bookmarkId });
    } catch (err) {
      const message = errorMessage(err);
      recordPipelineFailure(db, {
        bookmarkId,
        stage: "ai_enrich",
        message,
        configurationRelated: true,
      });
      log.warn("Pipeline: ai_enrich failed, continuing without enrichment", {
        bookmarkId,
        error: message,
      });
      // Non-fatal: bookmark is fully usable without LLM enrichment
    }
  } else {
    log.info("Pipeline: ai_enrich skipped (LLM not configured)", {
      bookmarkId,
      provider: runtimeSettings.runtime.llm.provider,
    });
  }

  // ── Stage 4: embed ────────────────────────────────────────────────────────
  if (runtimeSettings.embeddingConfig) {
    log.info("Pipeline: embed", { bookmarkId });
    try {
      // Read current summary and tags for embedding input
      const contentRow = db
        .query<{ summary: string | null }, [string]>(
          "SELECT summary FROM bookmark_content WHERE bookmark_id = ?"
        )
        .get(bookmarkId);
      const tagNames = db
        .query<{ name: string }, [string]>(
          `SELECT t.name FROM tags t
           JOIN bookmark_tags bt ON bt.tag_id = t.id
           WHERE bt.bookmark_id = ?`
        )
        .all(bookmarkId)
        .map((r) => r.name);

      const embedText = buildEmbedInput({
        title,
        summary: contentRow?.summary ?? null,
        tags: tagNames,
      });

      const vector = await getEmbedding(
        runtimeSettings.embeddingConfig,
        embedText
      );

      const embRepo = new EmbeddingRepository(db);
      embRepo.upsert(bookmarkId, runtimeSettings.embeddingConfig.model, vector);
      log.info("Pipeline: embed done", { bookmarkId, dimensions: vector.length });
    } catch (err) {
      const message = errorMessage(err);
      recordPipelineFailure(db, {
        bookmarkId,
        stage: "embed",
        message,
        configurationRelated: true,
      });
      log.warn("Pipeline: embed failed, continuing without embedding", {
        bookmarkId,
        error: message,
      });
      // Non-fatal: bookmark is fully usable without embedding
    }
  } else {
    log.info("Pipeline: embed skipped (embedding provider not configured)", {
      bookmarkId,
      provider: runtimeSettings.runtime.embeddings.provider,
    });
  }

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
    const message = errorMessage(err);
    recordPipelineFailure(db, {
      bookmarkId,
      stage: "index",
      message,
    });
    log.warn("Pipeline: FTS index update failed", {
      bookmarkId,
      error: message,
    });
    // Non-fatal: bookmark is still usable; FTS will pick it up on next rebuild
  }
}

export async function runEmbeddingRefresh(
  db: Database,
  payload: Pick<PipelinePayload, "bookmarkId">
): Promise<void> {
  const { bookmarkId } = payload;
  const runtimeSettings = resolveRuntimeSettings();
  if (!runtimeSettings.embeddingConfig) {
    throw new Error("Embedding provider is not configured");
  }

  const bookmark = db
    .query<{ id: string; url: string; title: string | null; description: string | null }, [string]>(
      "SELECT id, url, title, description FROM bookmarks WHERE id = ? AND is_trashed = 0"
    )
    .get(bookmarkId);
  if (!bookmark) {
    throw new Error(`Bookmark not found: ${bookmarkId}`);
  }

  const contentRow = db
    .query<{ summary: string | null }, [string]>(
      "SELECT summary FROM bookmark_content WHERE bookmark_id = ?"
    )
    .get(bookmarkId);
  const tagNames = db
    .query<{ name: string }, [string]>(
      `SELECT t.name FROM tags t
       JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE bt.bookmark_id = ?
       ORDER BY t.name`
    )
    .all(bookmarkId)
    .map((r) => r.name);

  const embedText = buildEmbedInput({
    title: bookmark.title ?? bookmark.url,
    summary: contentRow?.summary ?? bookmark.description,
    tags: tagNames,
  });

  const vector = await getEmbedding(runtimeSettings.embeddingConfig, embedText);
  const embRepo = new EmbeddingRepository(db);
  embRepo.upsert(bookmarkId, runtimeSettings.embeddingConfig.model, vector);
  log.info("Pipeline: embedding refresh done", { bookmarkId, dimensions: vector.length });
}
