# TASK-040: MCP Server Integration

**Status:** done
**Priority:** medium
**Phase:** v1.0
**Area:** daemon, infrastructure

## Description

Expose `littleimpd` as an MCP (Model Context Protocol) server so AI assistants (Claude, Cursor, etc.) can read and query the bookmark library directly. This turns Little Imp from a standalone app into a knowledge-base tool usable from any MCP-compatible client.

MCP runs over stdio (for local tools) or HTTP/SSE. Since `littleimpd` is already a local HTTP server, the cleanest approach is an HTTP+SSE MCP transport mounted at `/mcp` alongside the existing REST API.

## Tools to expose

| Tool name | Description | Arguments |
|---|---|---|
| `search_bookmarks` | Full-text or hybrid search over bookmarks | `query: string`, `mode?: "keyword"\|"semantic"\|"hybrid"`, `limit?: number` |
| `get_bookmark` | Fetch a single bookmark by ID | `id: number` |
| `list_bookmarks` | List recent or filtered bookmarks | `category_id?: number`, `is_pinned?: boolean`, `limit?: number`, `offset?: number` |
| `add_bookmark` | Save a new URL to the library | `url: string`, `title?: string` |
| `list_categories` | Return the category tree | — |

## Resources to expose

| URI template | Description |
|---|---|
| `bookmark://{id}` | Full bookmark record with notes and tags |
| `category://{id}/bookmarks` | All bookmarks in a category |

## Work

1. Add `@modelcontextprotocol/sdk` to daemon dependencies
2. Create `src/mcp/server.ts` — instantiate `McpServer`, register tools and resources
3. Wire tool handlers to existing repository/search functions (reuse, don't duplicate)
4. Mount MCP HTTP transport at `/mcp` in `src/server.ts`
5. Update `README.md` with MCP configuration example for Claude Desktop / Cursor

## Acceptance Criteria

- [x] `bun check` passes with no type errors
- [x] `/mcp` exposes a Streamable HTTP MCP endpoint with server name, version, tools, and resources through MCP initialization
- [x] `search_bookmarks` returns ranked results using existing search route logic
- [x] `add_bookmark` ingests a URL through the existing pipeline
- [x] MCP server can be configured in Claude Desktop `claude_desktop_config.json`
- [x] No changes to existing REST API routes

## Notes

- Use `@modelcontextprotocol/sdk` Hono adapter if available, otherwise implement SSE transport manually
- Keep MCP handlers thin — call the same service functions the REST routes call
- Do not add auth — daemon is local-only, same trust model as REST API
