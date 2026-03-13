/**
 * LLM enrichment stage.
 *
 * A single chat-completion call returns:
 *   { summary, tags, category, confidence }
 *
 * Results are persisted to bookmark_content.summary, bookmark_tags,
 * and bookmarks.category_id (category upserted by name).
 * Bookmark status is advanced to "ai_enriched".
 *
 * Designed for technical / developer-oriented content.
 */

import { Database } from "bun:sqlite";
import { LlmConfig, chatCompletion } from "./llm-client.js";
import { log } from "../logger.js";
import { CategoryRow, TagRow } from "../db/types.js";

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a librarian that specialises in technical and developer-oriented content.
Given the title and content of a saved webpage, return a JSON object with:
  "summary"    — 2-3 sentence plain-English summary focused on what the content is and why it matters
  "tags"       — array of 3-7 lowercase single-word or hyphenated tags (e.g. "typescript", "web-dev")
  "category"   — single category name from: ["Article", "Tutorial", "Documentation", "Tool", "Library", "Video", "Discussion", "News", "Other"]
  "confidence" — float 0.0-1.0 reflecting how confident you are in the tags and category

Rules:
- Respond ONLY with valid JSON — no markdown, no preamble.
- tags must be lowercase and contain only letters, digits, and hyphens.
- If content is empty or too short to classify, use category "Other" and confidence 0.1.`;

function buildUserMessage(title: string, content: string): string {
  // Truncate content to ~4000 chars to stay well within token limits for all models.
  const truncated = content.length > 4000 ? content.slice(0, 4000) + "\n…[truncated]" : content;
  return `Title: ${title}\n\nContent:\n${truncated}`;
}

// ─── Response shape ───────────────────────────────────────────────────────────

interface EnrichmentResponse {
  summary: string;
  tags: string[];
  category: string;
  confidence: number;
}

const VALID_CATEGORIES = new Set([
  "Article", "Tutorial", "Documentation", "Tool",
  "Library", "Video", "Discussion", "News", "Other",
]);

function parseResponse(raw: string): EnrichmentResponse | null {
  let parsed: unknown;
  try {
    // Strip potential markdown code fences that some models add despite instructions
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  const summary = typeof p.summary === "string" ? p.summary.trim() : "";
  const confidence = typeof p.confidence === "number"
    ? Math.max(0, Math.min(1, p.confidence))
    : 0.5;

  const rawTags = Array.isArray(p.tags) ? p.tags : [];
  const tags = rawTags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter((t) => t.length > 0 && t.length <= 64)
    .slice(0, 10);

  const rawCategory = typeof p.category === "string" ? p.category.trim() : "Other";
  const category = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "Other";

  return { summary, tags, category, confidence };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function upsertCategory(db: Database, name: string): string {
  // Single atomic statement: insert or no-op, then always return the row.
  // Relies on the UNIQUE index on categories(name, COALESCE(parent_id, '')).
  const row = db.query<CategoryRow, [string]>(
    `INSERT INTO categories (name) VALUES (?)
     ON CONFLICT(name, COALESCE(parent_id, '')) DO UPDATE SET name = name
     RETURNING *`
  ).get(name);
  if (!row) throw new Error(`Failed to upsert category: ${name}`);
  return row.id;
}

function upsertTag(db: Database, name: string): string {
  // Single atomic statement: insert or no-op, then always return the row.
  // Relies on the UNIQUE index on tags(name).
  const row = db.query<TagRow, [string]>(
    `INSERT INTO tags (name) VALUES (?)
     ON CONFLICT(name) DO UPDATE SET name = name
     RETURNING *`
  ).get(name);
  if (!row) throw new Error(`Failed to upsert tag: ${name}`);
  return row.id;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface EnrichInput {
  bookmarkId: string;
  title: string;
  /** Markdown content from the extraction stage (may be empty). */
  content: string;
}

/**
 * Run the LLM enrichment stage and persist results.
 * Throws if the LLM call ultimately fails (after retries inside llm-client).
 */
export async function enrichBookmark(
  db: Database,
  config: LlmConfig,
  input: EnrichInput
): Promise<void> {
  const { bookmarkId, title, content } = input;

  const rawResponse = await chatCompletion(
    config,
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(title, content) },
    ],
    { jsonMode: true, maxTokens: 512 }
  );

  const result = parseResponse(rawResponse);
  if (!result) {
    throw new Error(`LLM returned unparseable response: ${rawResponse.slice(0, 200)}`);
  }

  log.info("LLM enrichment parsed", {
    bookmarkId,
    category: result.category,
    tagCount: result.tags.length,
    confidence: result.confidence,
  });

  // Persist atomically
  db.transaction(() => {
    // Summary → bookmark_content (full summary for search/detail view)
    // Also denormalize a short excerpt into bookmarks.description so the list
    // API can surface it without an extra JOIN (description is the fast-path
    // field shown in bookmark cards).
    if (result.summary) {
      db.run(
        `INSERT INTO bookmark_content (bookmark_id, summary)
         VALUES (?, ?)
         ON CONFLICT(bookmark_id) DO UPDATE SET summary = excluded.summary`,
        [bookmarkId, result.summary]
      );
      // Truncate to 300 chars for the description quick-access field
      const descriptionExcerpt = result.summary.slice(0, 300);
      db.run("UPDATE bookmarks SET description = ? WHERE id = ?", [descriptionExcerpt, bookmarkId]);
    }

    // Category
    if (result.category) {
      const categoryId = upsertCategory(db, result.category);
      db.run("UPDATE bookmarks SET category_id = ? WHERE id = ?", [categoryId, bookmarkId]);
    }

    // Tags — merge with any existing tags (from import or manual)
    for (const tagName of result.tags) {
      const tagId = upsertTag(db, tagName);
      db.run(
        `INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`,
        [bookmarkId, tagId]
      );
    }

    // Advance status
    db.run("UPDATE bookmarks SET status = 'ai_enriched' WHERE id = ?", [bookmarkId]);
  })();
}
