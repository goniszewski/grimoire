import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { SuggestionRepository } from "../db/suggestion-repository.js";
import { TimelineRepository } from "../db/timeline-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { log } from "../logger.js";

interface SuggestionsDeps {
  db: Database;
}

function problem(
  c: Context,
  status: 400 | 404 | 422 | 500,
  title: string,
  detail?: string
) {
  return c.json(
    {
      type: `https://littleimp.app/problems/${title.toLowerCase().replace(/\s+/g, "-")}`,
      title,
      status,
      detail,
    },
    status,
    { "Content-Type": "application/problem+json" }
  );
}

function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data }, status);
}

export function createSuggestionsRoute(deps: SuggestionsDeps): Hono {
  const router = new Hono();
  const repo = new SuggestionRepository(deps.db);
  const timelineRepo = new TimelineRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);
  const bookmarkRepo = new BookmarkRepository(deps.db);

  // GET /suggestions — list pending suggestions
  router.get("/suggestions", (c) => {
    const suggestions = repo.listPending();
    return c.json({ data: suggestions, meta: { pending: suggestions.length } });
  });

  // POST /suggestions/:id/accept — accept a suggestion and execute the action
  router.post("/suggestions/:id/accept", (c) => {
    const id = c.req.param("id");
    const existing = repo.findById(id);

    if (!existing) {
      return problem(c, 404, "Not Found", "Suggestion not found");
    }
    if (existing.status !== "pending") {
      return problem(c, 422, "Unprocessable Entity", `Suggestion is already ${existing.status}`);
    }

    let updated: ReturnType<typeof repo.accept>;
    try {
      deps.db.transaction(() => {
        applyAction(existing.type, existing.metadata, existing.value, deps.db, categoryRepo, bookmarkRepo, timelineRepo);
        updated = repo.accept(id);
        timelineRepo.insert(
          "suggestion_accepted",
          `User accepted suggestion: ${existing.value}`,
          { suggestionId: id, type: existing.type, ...existing.metadata },
          "user",
          existing.bookmarkId
        );
      })();
    } catch (err) {
      log.error("Failed to apply suggestion action", {
        id,
        type: existing.type,
        error: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof SuggestionActionError) {
        return problem(c, err.status, err.title, err.detail);
      }
      return problem(c, 500, "Internal Server Error", "Failed to apply suggestion action");
    }

    return ok(c, updated!);
  });

  // POST /suggestions/:id/reject — reject a suggestion
  router.post("/suggestions/:id/reject", (c) => {
    const id = c.req.param("id");
    const existing = repo.findById(id);

    if (!existing) {
      return problem(c, 404, "Not Found", "Suggestion not found");
    }
    if (existing.status !== "pending") {
      return problem(c, 422, "Unprocessable Entity", `Suggestion is already ${existing.status}`);
    }

    const updated = repo.reject(id);

    timelineRepo.insert(
      "suggestion_rejected",
      `User rejected suggestion: ${existing.value}`,
      { suggestionId: id, type: existing.type, ...existing.metadata },
      "user",
      existing.bookmarkId
    );

    return ok(c, updated);
  });

  return router;
}

/** Typed error for expected action failures (stale data, missing entities). */
class SuggestionActionError extends Error {
  constructor(
    public status: 400 | 404 | 422 | 500,
    public title: string,
    public detail: string
  ) {
    super(detail);
  }
}

/**
 * Execute the real-world action corresponding to a suggestion type.
 * Called when the user manually accepts a suggestion.
 */
function applyAction(
  type: string,
  metadata: Record<string, unknown>,
  value: string,
  db: Database,
  categoryRepo: CategoryRepository,
  bookmarkRepo: BookmarkRepository,
  timelineRepo: TimelineRepository
): void {
  switch (type) {
    case "new_subcategory": {
      const categoryName = value.slice(0, 100).trim();
      if (!categoryName) throw new SuggestionActionError(422, "Unprocessable Entity", "Suggestion value is empty");
      const parentId = typeof metadata.parentId === "string" ? metadata.parentId : null;

      const created = categoryRepo.create(categoryName, parentId);
      log.info("Suggestion accepted: created category", { name: categoryName, id: created.id });

      // Move matching bookmarks into the new category if IDs are provided
      const bookmarkIds = Array.isArray(metadata.bookmarkIds) ? metadata.bookmarkIds as string[] : [];
      for (const bmId of bookmarkIds) {
        db.run("UPDATE bookmarks SET category_id = ? WHERE id = ? AND is_trashed = 0", [created.id, bmId]);
      }

      timelineRepo.insert(
        "category_created",
        `Agent suggestion accepted: created category "${categoryName}"`,
        { categoryId: created.id, parentId, movedBookmarks: bookmarkIds.length },
        "user"
      );
      break;
    }

    case "merge_categories": {
      const categoryIdA = metadata.categoryIdA as string | undefined;
      const categoryIdB = metadata.categoryIdB as string | undefined;
      if (!categoryIdA || !categoryIdB) {
        throw new Error("merge_categories suggestion missing categoryIdA or categoryIdB in metadata");
      }

      const catA = categoryRepo.findById(categoryIdA);
      const catB = categoryRepo.findById(categoryIdB);
      if (!catA || !catB) {
        throw new SuggestionActionError(
          422,
          "Unprocessable Entity",
          "One or both categories no longer exist; suggestion may be stale"
        );
      }

      // Move all bookmarks from B into A, then delete B
      db.transaction(() => {
        db.run(
          "UPDATE bookmarks SET category_id = ? WHERE category_id = ? AND is_trashed = 0",
          [categoryIdA, categoryIdB]
        );
        categoryRepo.delete(categoryIdB);
      })();

      log.info("Suggestion accepted: merged categories", {
        source: catB.name,
        target: catA.name,
      });

      timelineRepo.insert(
        "category_merged",
        `Agent suggestion accepted: merged "${catB.name}" into "${catA.name}"`,
        { targetCategoryId: categoryIdA, sourceCategoryId: categoryIdB, targetName: catA.name, sourceName: catB.name },
        "user"
      );
      break;
    }

    case "duplicate_bookmark": {
      const bookmarkIdA = metadata.bookmarkIdA as string | undefined;
      const bookmarkIdB = metadata.bookmarkIdB as string | undefined;
      if (!bookmarkIdA || !bookmarkIdB) {
        throw new Error("duplicate_bookmark suggestion missing bookmarkIdA or bookmarkIdB in metadata");
      }

      // Trash the newer bookmark (B), keep the older (A) as canonical
      const trashed = bookmarkRepo.softDelete(bookmarkIdB);
      if (!trashed) {
        // Bookmark already gone (deleted or trashed) — suggestion is stale
        throw new SuggestionActionError(
          422,
          "Unprocessable Entity",
          "Duplicate bookmark no longer exists; it may have already been deleted"
        );
      }

      log.info("Suggestion accepted: trashed duplicate bookmark", {
        canonical: bookmarkIdA,
        trashed: bookmarkIdB,
      });

      timelineRepo.insert(
        "duplicate_removed",
        `Agent suggestion accepted: duplicate bookmark moved to Trash`,
        { canonicalBookmarkId: bookmarkIdA, trashedBookmarkId: bookmarkIdB },
        "user",
        bookmarkIdB
      );
      break;
    }

    default:
      throw new Error(`Unknown suggestion type: ${type}`);
  }
}
