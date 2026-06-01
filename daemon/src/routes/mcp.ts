import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { JobQueue } from "../queue.js";
import { createMcpServer, createTransport } from "../mcp/server.js";
import { log } from "../logger.js";
import { requireIntegrationToken } from "../lib/integration-auth.js";

interface McpRouteDeps {
  db: Database;
  queue: JobQueue;
  version: string;
}

/**
 * Mounts the MCP (Model Context Protocol) server at /mcp.
 *
 * Stateless: each request gets its own McpServer + transport pair.
 * The McpServer protocol layer throws if you call connect() on an already-
 * connected instance, so a shared server cannot be reused across requests
 * without explicit close/reconnect logic. Creating fresh instances per request
 * is the correct pattern for stateless HTTP transport — repositories are cheap
 * value objects backed by the shared SQLite Database handle.
 *
 * Compatible with Claude Desktop, Cursor, and any MCP client that supports
 * the Streamable HTTP transport (MCP spec 2025-03-26+).
 */
export function createMcpRoute(deps: McpRouteDeps): Hono {
  const router = new Hono();

  router.use("/mcp", requireIntegrationToken(deps.db));

  router.all("/mcp", async (c) => {
    try {
      const server = createMcpServer(deps);
      const transport = createTransport();
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } catch (err) {
      log.error("MCP request error", { error: String(err) });
      return c.json({ error: "MCP request failed" }, 500);
    }
  });

  return router;
}
