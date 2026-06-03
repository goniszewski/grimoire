import { Hono, Context } from "hono";
import { Database } from "bun:sqlite";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { log } from "../logger.js";

interface DemoDeps {
  db: Database;
}

/**
 * Demo bookmark fixture — realistic developer content.
 * Each entry has a fake URL (real domains pointing to plausible paths),
 * a descriptive title, a category name, and tags.
 */
interface DemoBookmark {
  url: string;
  title: string;
  category: string;
  tags: string[];
}

const DEMO_CATEGORIES = ["Engineering", "Design", "Research"];
const DEMO_BOOKMARKS: DemoBookmark[] = [
  {
    url: "https://example.dev/blog/type-systems-in-practice",
    title: "Type Systems in Practice: A Guide for Application Developers",
    category: "Engineering",
    tags: ["typescript", "programming-languages", "engineering"],
  },
  {
    url: "https://example.dev/docs/bun-sqlite-performance",
    title: "Bun SQLite Performance Benchmarks and Best Practices",
    category: "Engineering",
    tags: ["bun", "sqlite", "performance", "engineering"],
  },
  {
    url: "https://github.com/example/container-optimizer",
    title: "container-optimizer — A CLI tool for Docker image optimization",
    category: "Engineering",
    tags: ["docker", "cli", "open-source", "engineering"],
  },
  {
    url: "https://example.design/articles/ui-patterns-for-developer-tools",
    title: "UI Patterns for Developer Tools: What Makes a Great DX",
    category: "Design",
    tags: ["ux", "ui-design", "developer-experience", "design"],
  },
  {
    url: "https://example.design/blog/color-accessibility-guidelines",
    title: "Color Accessibility Guidelines for Data-Heavy Dashboards",
    category: "Design",
    tags: ["accessibility", "color-theory", "dashboard", "design"],
  },
  {
    url: "https://www.youtube.com/watch?v=example_talk_id",
    title: "Building Local-First Applications — Conference Talk",
    category: "Engineering",
    tags: ["local-first", "architecture", "talk", "engineering"],
  },
  {
    url: "https://example.research/papers/vector-search-comparison",
    title: "Vector Search Algorithms: A Comparative Analysis of ANN Approaches",
    category: "Research",
    tags: ["vector-search", "machine-learning", "research", "semantic-search"],
  },
  {
    url: "https://example.dev/blog/zero-downtime-migrations-sqlite",
    title: "Zero-Downtime Schema Migrations in SQLite",
    category: "Engineering",
    tags: ["sqlite", "migrations", "database", "engineering"],
  },
  {
    url: "https://example.design/guides/information-architecture-for-apps",
    title: "Information Architecture for Bookmark and Knowledge Management Apps",
    category: "Design",
    tags: ["information-architecture", "ux-research", "knowledge-management", "design"],
  },
  {
    url: "https://arxiv.org/abs/example-pdf-id",
    title: "Local-First Software: A Paradigm for Resilient Applications (PDF)",
    category: "Research",
    tags: ["local-first", "research-paper", "pdf", "research"],
  },
];

export function createDemoRoute(deps: DemoDeps): Hono {
  const router = new Hono();
  const bookmarkRepo = new BookmarkRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);

  /**
   * POST /demo/load
   *
   * Loads demo bookmarks into an empty library. Creates demo categories
   * and tags demo bookmarks for easy bulk removal.
   *
   * Returns 409 if the library already has bookmarks.
   * Returns 200 with { bookmarks_created, categories_created } on success.
   */
  router.post("/demo/load", async (c: Context) => {
    // Guard: only allow when library is empty
    const count = deps.db.query<{ count: number }, []>("SELECT COUNT(*) as count FROM bookmarks").get()!;
    if (count.count > 0) {
      return c.json({ error: "Library is not empty — demo data can only be loaded on a fresh library" }, 409);
    }

    try {
      // Create demo categories
      const categoryMap = new Map<string, string>();
      for (const name of DEMO_CATEGORIES) {
        const cat = categoryRepo.create(name);
        categoryMap.set(name, cat.id);
      }

      // Create demo bookmarks
      let created = 0;
      for (const bm of DEMO_BOOKMARKS) {
        const bookmark = bookmarkRepo.create(bm.url, bm.title, categoryMap.get(bm.category) ?? null);
        // Add tags
        for (const tag of bm.tags) {
          bookmarkRepo.addTag(bookmark.id, tag);
        }
        created++;
      }

      log.info("Demo data loaded", { bookmarks: created, categories: DEMO_CATEGORIES.length });

      return c.json({
        data: {
          bookmarks_created: created,
          categories_created: DEMO_CATEGORIES.length,
        },
      });
    } catch (err) {
      log.error("Failed to load demo data", { error: String(err) });
      return c.json({ error: "Failed to load demo data" }, 500);
    }
  });

  return router;
}
