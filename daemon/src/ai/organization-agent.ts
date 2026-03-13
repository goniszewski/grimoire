/**
 * Autonomous Organization Agent
 *
 * Runs periodically to analyse the bookmark library and produce suggestions:
 *   1. Duplicate detection — pairs of bookmarks with very similar embeddings
 *   2. Category merge suggestions — pairs of categories whose bookmarks share
 *      high average embedding similarity
 *   3. New subcategory suggestions — via LLM, when a cluster of uncategorized
 *      bookmarks has no existing matching category
 *
 * Low-confidence outcomes are written to the `agent_suggestions` table for
 * human review. High-confidence outcomes (≥ AUTO_APPLY_THRESHOLD) are
 * auto-applied directly: duplicates are trashed, similar categories are merged.
 */

import { Database } from "bun:sqlite";
import { log } from "../logger.js";
import { EmbeddingRepository } from "../db/embedding-repository.js";
import { SuggestionRepository } from "../db/suggestion-repository.js";
import { TimelineRepository } from "../db/timeline-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { cosineSimilarity } from "./embeddings.js";
import { Config } from "../config.js";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Cosine similarity above which two bookmarks are considered duplicates. */
const DUPLICATE_THRESHOLD = 0.97;

/** Cosine similarity above which two categories warrant a merge suggestion. */
const CATEGORY_MERGE_THRESHOLD = 0.88;

/** Confidence at or above which a suggestion is auto-applied without review. */
const AUTO_APPLY_THRESHOLD = 0.9;

/** Minimum library size before any analysis runs (cold-start guard). */
const MIN_BOOKMARKS = 20;

/** Minimum bookmarks per category to be considered for merge analysis. */
const MIN_CATEGORY_BOOKMARKS = 3;

/**
 * Maximum number of embeddings considered for the O(n²) duplicate scan.
 * At 2 000 embeddings the loop performs ~2 million comparisons — still fast
 * in JS (~100 ms). Beyond this threshold we skip the scan to protect against
 * very large libraries. Increase if needed once a proper ANN index is in place.
 */
const MAX_EMBEDDINGS_FOR_DUPLICATE_SCAN = 2_000;

// ─── Agent ────────────────────────────────────────────────────────────────────

export class OrganizationAgent {
  private embRepo: EmbeddingRepository;
  private suggRepo: SuggestionRepository;
  private timelineRepo: TimelineRepository;
  private categoryRepo: CategoryRepository;
  private bookmarkRepo: BookmarkRepository;

  constructor(private db: Database) {
    this.embRepo = new EmbeddingRepository(db);
    this.suggRepo = new SuggestionRepository(db);
    this.timelineRepo = new TimelineRepository(db);
    this.categoryRepo = new CategoryRepository(db);
    this.bookmarkRepo = new BookmarkRepository(db);
  }

  async run(): Promise<void> {
    log.info("OrganizationAgent: starting run");

    const totalBookmarks = this.countActiveBookmarks();
    if (totalBookmarks < MIN_BOOKMARKS) {
      log.info("OrganizationAgent: library too small, skipping", {
        count: totalBookmarks,
        minimum: MIN_BOOKMARKS,
      });
      return;
    }

    const model = Config.EMBEDDING_MODEL;
    const embeddings = this.embRepo.getAllForModel(model);

    if (embeddings.length < 2) {
      log.info("OrganizationAgent: not enough embeddings, skipping", {
        count: embeddings.length,
      });
      return;
    }

    log.info("OrganizationAgent: loaded embeddings", { count: embeddings.length });

    await this.detectDuplicates(embeddings);
    await this.detectCategoryMerges(embeddings);

    log.info("OrganizationAgent: run complete");
  }

  // ─── Duplicate detection ────────────────────────────────────────────────────

  private async detectDuplicates(
    embeddings: Array<{ bookmarkId: string; vector: number[] }>
  ): Promise<void> {
    if (embeddings.length > MAX_EMBEDDINGS_FOR_DUPLICATE_SCAN) {
      log.warn("OrganizationAgent: embedding count exceeds duplicate-scan limit, skipping", {
        count: embeddings.length,
        limit: MAX_EMBEDDINGS_FOR_DUPLICATE_SCAN,
      });
      return;
    }

    let found = 0;

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const sim = cosineSimilarity(embeddings[i].vector, embeddings[j].vector);
        if (sim < DUPLICATE_THRESHOLD) continue;

        const idA = embeddings[i].bookmarkId;
        const idB = embeddings[j].bookmarkId;

        const bmA = this.bookmarkRepo.findById(idA);
        const bmB = this.bookmarkRepo.findById(idB);
        if (!bmA || !bmB) continue;

        const value = `Possible duplicate: "${bmA.title ?? bmA.url}" and "${bmB.title ?? bmB.url}"`;

        // Skip if identical URLs (not a duplicate by content, just same page)
        if (bmA.url === bmB.url) continue;

        // Skip if already suggested (match by structured IDs, not human-readable value)
        if (this.suggRepo.hasPending("duplicate_bookmark", value, { bookmarkIdA: idA, bookmarkIdB: idB })) continue;

        const confidence = Math.min(sim, 1.0);
        found++;

        if (confidence >= AUTO_APPLY_THRESHOLD) {
          // High-confidence: auto-trash the duplicate (idB) and record to timeline.
          const trashed = this.bookmarkRepo.softDelete(idB);
          if (trashed) {
            this.timelineRepo.insert(
              "duplicate_removed",
              `Auto-removed duplicate: "${bmB.title ?? bmB.url}" (kept "${bmA.title ?? bmA.url}")`,
              { canonicalBookmarkId: idA, trashedBookmarkId: idB, similarity: sim },
              "agent",
              idB
            );
            log.info("OrganizationAgent: auto-removed duplicate", { canonical: idA, trashed: idB, sim });
          } else {
            this.timelineRepo.insert(
              "duplicate_flagged",
              value,
              { bookmarkIdA: idA, bookmarkIdB: idB, similarity: sim },
              "agent"
            );
            log.info("OrganizationAgent: auto-flagged duplicate (already trashed?)", { idA, idB, sim });
          }
        } else {
          this.suggRepo.insert(
            "duplicate_bookmark",
            value,
            { bookmarkIdA: idA, bookmarkIdB: idB, similarity: sim },
            confidence,
            idA
          );
        }
      }
    }

    log.info("OrganizationAgent: duplicate detection done", { found });
  }

  // ─── Category merge detection ───────────────────────────────────────────────

  private async detectCategoryMerges(
    embeddings: Array<{ bookmarkId: string; vector: number[] }>
  ): Promise<void> {
    const categories = this.categoryRepo.listFlat();
    if (categories.length < 2) return;

    // Build bookmarkId → category_id lookup in a single query to avoid N+1
    const bmCatRows = this.db
      .query<{ id: string; category_id: string | null }, []>(
        "SELECT id, category_id FROM bookmarks WHERE is_archived = 0 AND is_trashed = 0"
      )
      .all();
    const bmCatMap = new Map<string, string | null>(
      bmCatRows.map((r) => [r.id, r.category_id])
    );

    // Build a map: category_id → mean embedding vector
    const embMap = new Map<string, number[]>();
    for (const cat of categories) {
      if (cat.bookmark_count < MIN_CATEGORY_BOOKMARKS) continue;

      const catEmbeddings = embeddings.filter(
        (e) => bmCatMap.get(e.bookmarkId) === cat.id
      );
      if (catEmbeddings.length === 0) continue;

      const mean = meanVector(catEmbeddings.map((e) => e.vector));
      embMap.set(cat.id, mean);
    }

    const catIds = [...embMap.keys()];
    const mergedIds = new Set<string>();
    let found = 0;

    for (let i = 0; i < catIds.length; i++) {
      if (mergedIds.has(catIds[i])) continue;
      for (let j = i + 1; j < catIds.length; j++) {
        if (mergedIds.has(catIds[j])) continue;
        const idA = catIds[i];
        const idB = catIds[j];
        const sim = cosineSimilarity(embMap.get(idA)!, embMap.get(idB)!);
        if (sim < CATEGORY_MERGE_THRESHOLD) continue;

        const catA = categories.find((c) => c.id === idA)!;
        const catB = categories.find((c) => c.id === idB)!;
        const value = `Consider merging "${catA.name}" and "${catB.name}" — their bookmarks are very similar`;

        if (this.suggRepo.hasPending("merge_categories", value, { categoryIdA: idA, categoryIdB: idB })) continue;

        const confidence = Math.min((sim - CATEGORY_MERGE_THRESHOLD) / (1 - CATEGORY_MERGE_THRESHOLD), 1.0);
        found++;

        if (confidence >= AUTO_APPLY_THRESHOLD) {
          // High-confidence: auto-merge catB into catA and record to timeline atomically.
          this.db.transaction(() => {
            this.db.run(
              "UPDATE bookmarks SET category_id = ? WHERE category_id = ? AND is_trashed = 0",
              [idA, idB]
            );
            this.categoryRepo.delete(idB);
            this.timelineRepo.insert(
              "category_merged",
              `Auto-merged "${catB.name}" into "${catA.name}"`,
              { targetCategoryId: idA, sourceCategoryId: idB, targetName: catA.name, sourceName: catB.name, similarity: sim },
              "agent"
            );
          })();

          mergedIds.add(idB);
          log.info("OrganizationAgent: auto-merged categories", {
            target: catA.name, source: catB.name, sim,
          });
          break; // stop inner loop — idA has absorbed idB; move to next idA
        } else {
          this.suggRepo.insert(
            "merge_categories",
            value,
            { categoryIdA: idA, categoryIdB: idB, similarity: sim },
            confidence
          );
        }
      }
    }

    log.info("OrganizationAgent: category merge detection done", { found });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private countActiveBookmarks(): number {
    return (
      this.db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM bookmarks WHERE is_archived = 0 AND is_trashed = 0"
        )
        .get()?.count ?? 0
    );
  }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0].length;
  const sum = new Array<number>(dims).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) {
      sum[i] += v[i];
    }
  }
  return sum.map((s) => s / vectors.length);
}
