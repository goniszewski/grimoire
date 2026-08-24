# Using Grimoire

Plain overview of the features that ship in 1.x. Nothing here is aspirational.

## Save links

Add a URL from the library (or paste into the main page). Grimoire rejects private/loopback hosts and non-http(s) schemes. Duplicates of an active bookmark return the existing item. Links already in archive or trash need restore or permanent delete first.

New bookmarks show up immediately as saved, then a background job fetches and processes them. Failures leave the bookmark usable; you can retry from the detail view or reprocess batches in Settings.

## Content extraction

After save, Grimoire pulls readable content when it can:

| Source | What it stores |
| --- | --- |
| Normal web pages | Cleaned text / Markdown |
| PDFs | Extracted text |
| GitHub repositories | Metadata + README |
| GitHub issues | Issue body, labels, top comments |
| Stack Overflow / Stack Exchange | Question and top or accepted answer |
| YouTube | Metadata and captions when available |

## Organize

- **Categories** — create, rename, nest (max three levels), drag to reorder or reparent
- **Tags** — create, rename, attach; browse from Tags pages
- **Per bookmark** — title, notes, pin, read/unread, read later, archive, trash, restore, permanent delete
- **Bulk** — select bookmarks to delete, move, or toggle read later
- **Filters** — category, tag, domain, date, and related library filters

Optional AI can suggest summary, tags, and a broad category during ingest. When an **embedding** provider is configured, an organization agent may propose duplicates or similar categories; review them in **Review Queue**.

## Search

| Mode | When it works |
| --- | --- |
| Keyword | Always (SQLite FTS5 over title, summary, tags, content) |
| Semantic | Embedding provider configured |
| Hybrid | Embedding provider configured (keyword + vector + recency) |

Related bookmarks use embeddings when available.

## Capture from the browser

There is no Chrome/Firefox store extension in 1.x yet. Use the built-in bookmarklet:

1. Open **Settings → Browser Integration**
2. Create an integration token (the full secret is shown once — copy it if you need it elsewhere)
3. While that new token is still on screen, use **copy the bookmarklet URL** (or the **Bookmarklet** button on that token row)
4. In your browser, create a bookmark and paste the copied `javascript:…` URL into the bookmark’s URL field

Existing tokens only store a prefix. You cannot regenerate a bookmarklet for an old token — create a new one. The bookmarklet embeds the token; treat it like a password.

You can also import a Netscape/HTML bookmark export from your browser, and export your library as JSON or CSV.

## Backups

From Settings or the `littleimp` CLI you can create, list, verify, and restore local snapshots. Encrypted packages and optional scheduled/S3 targets are available in Settings when configured. Restores verify checksums and create a rollback copy first.

## Local integrations

- **REST** — see [API.md](../API.md); health at `GET /health`
- **MCP** — Streamable HTTP at `http://127.0.0.1:3210/mcp` with an integration bearer token
- **Capture API** — token-protected `POST /capture` for same-machine clients

## Privacy defaults

Data stays under your local data directory (Docker volume, or `~/.local/share/littleimp/` for native installs). The daemon binds to loopback by default. External AI is opt-in; without it, nothing leaves your machine for enrichment or embeddings.

More answers: [FAQ](./faq.md).
