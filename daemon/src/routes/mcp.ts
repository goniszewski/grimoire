import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { createMcpServer, createTransport } from "../mcp/server.js";
import { log } from "../logger.js";

interface McpRouteDeps {
  db: Database;
  queue: JobQueue;
  version: string;
}

/**
 * Mounts the MCP (Model Context Protocol) server at /mcp.
 *
 * Uses stateless Streamable HTTP transport — each request creates a fresh
 * transport instance connected to the shared McpServer. This means no session
 * management overhead, which is appropriate for a local-only daemon.
 *
 * Compatible with Claude Desktop, Cursor, and any MCP client that supports
 * the Streamable HTTP transport (MCP spec 2025-03-26+).
 */
export function createMcpRoute(deps: McpRouteDeps): Hono {
  const router = new Hono();

  // Lazily create the MCP server once and reuse it across requests
  const mcpServer = createMcpServer(deps);

  router.all("/mcp", async (c) => {
    try {
      const transport = createTransport();
      await mcpServer.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } catch (err) {
      log.error("MCP request error", { error: String(err) });
      return c.json({ error: "MCP request failed" }, 500);
    }
  });

  return router;
}
