import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { Database } from "bun:sqlite";
import { BookmarkRepository } from "../db/bookmark-repository.js";
import { CategoryRepository } from "../db/category-repository.js";
import { SearchRepository, SearchMode } from "../db/search-repository.js";
import { JobQueue } from "../queue.js";
import { Config } from "../config.js";
import { log } from "../logger.js";
import { isPrivateHost } from "../lib/network.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ─── Server factory ───────────────────────────────────────────────────────────

export interface McpDeps {
  db: Database;
  queue: JobQueue;
  version: string;
}

/**
 * Creates a configured McpServer instance with all Little Imp tools and resources.
 * The server is stateless (no session IDs) — each request creates a fresh transport.
 */
export function createMcpServer(deps: McpDeps): McpServer {
  const bookmarkRepo = new BookmarkRepository(deps.db);
  const categoryRepo = new CategoryRepository(deps.db);
  const searchRepo = new SearchRepository(deps.db);

  const server = new McpServer({
    name: "little-imp",
    version: deps.version,
  });

  // ── Tool: search_bookmarks ────────────────────────────────────────────────

  server.registerTool(
    "search_bookmarks",
    {
      title: "Search Bookmarks",
      description:
        "Search the bookmark library using full-text keyword search. " +
        "Returns ranked results with title, URL, summary, tags, and category.",
      inputSchema: z.object({
        query: z.string().describe("Search query string"),
        mode: z
          .enum(["keyword", "semantic", "hybrid"])
          .optional()
          .default("keyword")
          .describe("Search mode: keyword (FTS5), semantic (embeddings), or hybrid"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Maximum number of results to return (1-50)"),
      }),
    },
    async ({ query, mode = "keyword", limit = 10 }) => {
      // Semantic/hybrid require embedding config
      const embeddingConfig = Config.EMBEDDING_API_KEY
        ? {
            baseUrl: Config.EMBEDDING_BASE_URL,
            apiKey: Config.EMBEDDING_API_KEY,
            model: Config.EMBEDDING_MODEL,
          }
        : undefined;

      if ((mode === "semantic" || mode === "hybrid") && !embeddingConfig) {
        return textContent(
          `Error: mode=${mode} requires an embedding API key to be configured. ` +
            "Use keyword mode instead, or configure an embedding provider in settings."
        );
      }

      try {
        const result = await searchRepo.search({
          q: query,
          mode: mode as SearchMode,
          limit,
          offset: 0,
          embeddingConfig,
        });

        if (result.items.length === 0) {
          return textContent(`No bookmarks found matching "${query}".`);
        }

        const lines = result.items.map((item, i) => {
          const tags = item.tags.length > 0 ? ` [${item.tags.join(", ")}]` : "";
          const summary = item.description
            ? `\n   ${item.description.slice(0, 120)}${item.description.length > 120 ? "…" : ""}`
            : "";
          return `${i + 1}. **${item.title ?? item.url}** (id:${item.id})${tags}\n   ${item.url}${summary}`;
        });

        return textContent(
          `Found ${result.total} bookmark(s) — showing ${result.items.length}:\n\n${lines.join("\n\n")}`
        );
      } catch (err) {
        log.error("MCP search_bookmarks error", { error: String(err) });
        return textContent(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  // ── Tool: get_bookmark ────────────────────────────────────────────────────

  server.registerTool(
    "get_bookmark",
    {
      title: "Get Bookmark",
      description: "Fetch full details of a single bookmark by its ID, including notes and tags.",
      inputSchema: z.object({
        id: z.string().describe("Bookmark ID"),
      }),
    },
    ({ id }) => {
      const bookmark = bookmarkRepo.findByIdWithContent(id);
      if (!bookmark) {
        return textContent(`Bookmark with id=${id} not found.`);
      }

      const tags = bookmark.tags.length > 0 ? bookmark.tags.join(", ") : "none";
      const notes = bookmark.notes ? `\nNotes: ${bookmark.notes}` : "";
      const summary = bookmark.content?.summary
        ? `\nSummary: ${bookmark.content.summary}`
        : bookmark.description
          ? `\nDescription: ${bookmark.description}`
          : "";
      const status = [
        bookmark.is_pinned ? "pinned" : null,
        bookmark.is_archived ? "archived" : null,
        bookmark.read_at ? "read" : "unread",
      ]
        .filter(Boolean)
        .join(", ");

      return textContent(
        `**${bookmark.title ?? bookmark.url}** (id:${bookmark.id})\n` +
          `URL: ${bookmark.url}\n` +
          `Domain: ${bookmark.domain}\n` +
          `Tags: ${tags}\n` +
          `Status: ${status}\n` +
          `Added: ${bookmark.created_at}${summary}${notes}`
      );
    }
  );

  // ── Tool: list_bookmarks ──────────────────────────────────────────────────

  server.registerTool(
    "list_bookmarks",
    {
      title: "List Bookmarks",
      description: "List recent bookmarks with optional filtering by category or pin status.",
      inputSchema: z.object({
        category_id: z.string().optional().describe("Filter by category ID"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(20)
          .describe("Number of bookmarks to return (1-50)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .default(0)
          .describe("Pagination offset"),
      }),
    },
    ({ category_id, limit = 20, offset = 0 }) => {
      const result = bookmarkRepo.list({
        limit,
        offset,
        category: category_id,
      });

      if (result.items.length === 0) {
        return textContent("No bookmarks found.");
      }

      const lines = result.items.map((item, i) => {
        const tags = item.tags.length > 0 ? ` [${item.tags.join(", ")}]` : "";
        const pinned = item.is_pinned ? " 📌" : "";
        return `${offset + i + 1}. ${pinned}**${item.title ?? item.url}** (id:${item.id})${tags}\n   ${item.url}`;
      });

      return textContent(
        `Showing ${result.items.length} of ${result.total} bookmarks:\n\n${lines.join("\n\n")}`
      );
    }
  );

  // ── Tool: add_bookmark ────────────────────────────────────────────────────

  server.registerTool(
    "add_bookmark",
    {
      title: "Add Bookmark",
      description:
        "Save a URL to the Little Imp library. " +
        "The daemon will automatically fetch the page, extract content, and enrich it with AI.",
      inputSchema: z.object({
        url: z.string().url().describe("URL to save (must be http or https)"),
        title: z.string().optional().describe("Optional title override"),
      }),
    },
    ({ url, title }) => {
      if (!isValidUrl(url)) {
        return textContent(
          `Invalid URL: "${url}". Only http/https URLs to public hosts are accepted.`
        );
      }

      // Idempotency check
      const existing = bookmarkRepo.findByUrl(url);
      if (existing) {
        if (existing.is_trashed) {
          return textContent(
            `This URL is already in the trash (id:${existing.id}). Restore or delete it before re-adding.`
          );
        }
        if (existing.is_archived) {
          return textContent(
            `This URL is already archived (id:${existing.id}). Restore it from the archive before re-adding.`
          );
        }
        return textContent(
          `URL already saved (id:${existing.id}). Title: ${existing.title ?? "(pending)"}`
        );
      }

      const bookmark = bookmarkRepo.create(url, title);
      deps.queue.enqueue("ingest", { bookmarkId: bookmark.id, url: bookmark.url });

      log.info("MCP add_bookmark", { bookmarkId: bookmark.id, url });

      return textContent(
        `Saved! Bookmark id:${bookmark.id} — the content extraction pipeline has started.`
      );
    }
  );

  // ── Tool: list_categories ─────────────────────────────────────────────────

  server.registerTool(
    "list_categories",
    {
      title: "List Categories",
      description: "Return the full category tree with bookmark counts.",
      inputSchema: z.object({}),
    },
    () => {
      const tree = categoryRepo.listTree();

      if (tree.length === 0) {
        return textContent("No categories found.");
      }

      function renderTree(nodes: typeof tree, indent = ""): string {
        return nodes
          .map((n) => {
            const line = `${indent}- **${n.name}** (id:${n.id}, ${n.bookmark_count} bookmark${n.bookmark_count !== 1 ? "s" : ""})`;
            const children = n.children.length > 0 ? "\n" + renderTree(n.children, indent + "  ") : "";
            return line + children;
          })
          .join("\n");
      }

      return textContent(`Categories:\n\n${renderTree(tree)}`);
    }
  );

  // ── Resource: bookmark://{id} ─────────────────────────────────────────────

  server.registerResource(
    "bookmark",
    "bookmark://{id}",
    {
      title: "Bookmark",
      description: "Full bookmark record including content, notes, and tags",
      mimeType: "text/plain",
    },
    (uri) => {
      const id = uri.pathname.replace(/^\/\//, "");
      const bookmark = bookmarkRepo.findByIdWithContent(id);
      if (!bookmark) {
        return { contents: [{ uri: uri.href, text: `Bookmark ${id} not found.` }] };
      }

      const content = [
        `Title: ${bookmark.title ?? "(untitled)"}`,
        `URL: ${bookmark.url}`,
        `Domain: ${bookmark.domain}`,
        `Tags: ${bookmark.tags.join(", ") || "none"}`,
        `Status: ${bookmark.status}`,
        `Created: ${bookmark.created_at}`,
        bookmark.notes ? `\nNotes:\n${bookmark.notes}` : null,
        bookmark.content?.summary ? `\nSummary:\n${bookmark.content.summary}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return { contents: [{ uri: uri.href, text: content, mimeType: "text/plain" }] };
    }
  );

  return server;
}

// ─── Per-request transport factory ────────────────────────────────────────────

/**
 * Creates a fresh stateless transport for a single HTTP request.
 * The McpServer is shared across requests; each request gets its own transport.
 */
export function createTransport(): WebStandardStreamableHTTPServerTransport {
  return new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
}
