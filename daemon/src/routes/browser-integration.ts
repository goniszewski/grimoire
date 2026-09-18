import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { requireIntegrationToken } from "../lib/integration-auth.js";
import { CategoryRepository } from "../db/category-repository.js";
import { TagRepository } from "../db/tag-repository.js";

interface BrowserIntegrationDeps {
  db: Database;
  version: string;
}

export function createBrowserIntegrationRoute(deps: BrowserIntegrationDeps): Hono {
  const router = new Hono();
  const categoryRepo = new CategoryRepository(deps.db);
  const tagRepo = new TagRepository(deps.db);

  router.use("/integrations/browser/v1/*", requireIntegrationToken(deps.db));

  router.get("/integrations/browser/v1/capabilities", (c) => {
    return c.json({
      data: {
        protocol: "grimoire-browser-capture",
        protocol_version: 1,
        grimoire_version: deps.version,
        endpoints: {
          capture: "/capture",
          taxonomy: "/integrations/browser/v1/taxonomy",
        },
        capture_fields: {
          is_pinned: true,
          read_later: true,
        },
        limits: {
          request_bytes: 256 * 1024,
          title_characters: 2_000,
          notes_characters: 100_000,
          selected_text_characters: 10_000,
          tag_characters: 50,
        },
      },
    });
  });

  router.get("/integrations/browser/v1/taxonomy", (c) => {
    return c.json({
      data: {
        categories: categoryRepo.listTree(),
        tags: tagRepo.list(),
      },
    });
  });

  return router;
}
