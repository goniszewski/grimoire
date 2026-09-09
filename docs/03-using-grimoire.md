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
- **Bulk** — select bookmarks to delete, move, toggle read later, or open selected websites. Opening is limited to ten tabs per batch, with a confirmation and retry for blocked popups. Allow popups for the Grimoire address if prompted; retry opens only the blocked remainder, and unsafe URLs are skipped. **Select page** selects only the current page.
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

The rewritten Chrome/Firefox extension is still being prepared for publication.
Until it is available in the existing store listings, use the built-in bookmarklet:

1. Open **Settings → Browser Integration**
2. Create an integration token (the full secret is shown once — copy it if you need it elsewhere)
3. While that new token is still on screen, use **copy the bookmarklet URL** (or the **Bookmarklet** button on that token row)
4. In your browser, create a bookmark and paste the copied `javascript:…` URL into the bookmark’s URL field

Existing tokens only store a prefix. You cannot regenerate a bookmarklet for an old token — create a new one. The bookmarklet embeds the token; treat it like a password.

Replace bookmarklets created by older Grimoire versions after upgrading. The
old full token is not recoverable, so create a new integration token and copy a
new bookmarklet URL.

When clicked, the bookmarklet opens a short-lived local Grimoire capture window
and reports success only after the daemon confirms the save. This avoids
restrictive page CSPs such as GitHub's. Allow popups for the page if the browser
blocks the capture window.

You can also import a Netscape/HTML bookmark export from your browser, and export your library as JSON or CSV.

## Backups

From Settings or the `littleimp` CLI you can create, list, verify, and restore local snapshots. Encrypted packages and optional scheduled/S3 targets are available in Settings when configured. Restores verify checksums and create a rollback copy first.

## Local integrations

- **REST** — see [API.md](../API.md); health at `GET /health`
- **MCP** — Streamable HTTP at `http://127.0.0.1:3210/mcp` with an integration bearer token
- **Capture API** — token-protected `POST /capture` for same-machine clients
- **Browser Companion protocol** — authenticated capability negotiation at
  `GET /integrations/browser/v1/capabilities`, with authenticated taxonomy at
  `GET /integrations/browser/v1/taxonomy`, before extension capture

## Privacy defaults

Data stays under your local data directory (Docker volume, or `~/.local/share/littleimp/` for native installs). The daemon binds to loopback by default. External AI is opt-in; without it, nothing leaves your machine for enrichment or embeddings.

More answers: [FAQ](./faq.md).

## Appearance and bookmark opening

**Preferences** uses a sliders icon in the library header for appearance, library behavior, and the browser lock screen. The sidebar **Settings** gear opens AI providers, backups, and integrations. **Refine library** uses a filter icon.

Choose **System**, **Light**, or **Dark** in Preferences or the desktop appearance menu. System follows your device setting, including changes while Grimoire is open. These preferences are saved for this Grimoire address in the current browser profile; they do not sync between browsers. When browser storage is unavailable, changes last only for the current session.

In **Preferences → Clicking a bookmark**, choose between opening details (the default) and opening the website in a new tab. Ctrl/Cmd-click or middle-click a bookmark title to use normal browser link behavior. **More bookmark actions → Bookmark details** remains available in either mode. In selection mode, a normal title click selects the bookmark; modifier-clicks also select, and middle-click does not open it. Bookmarks with invalid or unsafe URLs open details instead of navigating.

Stored images and screenshots in bookmark details show their full proportions. Select an image to enlarge it; use Escape or Close to return to the detail view.
