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
- **Tags** — create, rename, add a short description, attach; browse from Tags pages
- **Per bookmark** — title, notes, pin, read/unread, Later, archive, trash, restore, permanent delete
- **Bulk** — select bookmarks to delete, move, or toggle Later
- **Filters** — category, tag, domain, date, and related library filters

## Later and Revisit

Use **Add → Add these to Later** to save one URL or paste a list of URLs. A single
link can also have a note explaining why you saved it. The save dialog confirms
which links reached Grimoire; failed links remain in the dialog for retry. An
existing active bookmark is added to Later without replacing its note or tags.

**Later** appears in the sidebar, and the library shows an invitation when you
have Later bookmarks. Start a shuffled round of five (or choose ten or twenty),
or browse all Later bookmarks with the ordinary library filter. You can pause a round and continue
it later. The queue and progress are stored in the local daemon.

Opening the original page or reading extracted content does not mark a bookmark
read. **Mark as read** records its read time and removes it from Later while keeping
the bookmark. **Skip** moves to the next card while keeping the bookmark in Later;
it can appear again in a later pass. **Postpone for** makes it eligible after a day,
week, or month; it does not send a notification. For an already-read card, **Done
with this** removes it from Later without changing its read time. The **More** menu
offers **Remove from Later** without marking an unread bookmark read, plus **Move
to Trash** using the ordinary recoverable trash. **Undo** reverses the last round
decision and returns to that card.

Optional AI can suggest summary, tags, and a broad category during ingest. When an **embedding** provider is configured, an organization agent may propose duplicates or similar categories; review them in **Review Queue**.

## Search

| Mode | When it works |
| --- | --- |
| Keyword | Always (SQLite FTS5 over title, summary, tags, content) |
| Semantic | Embedding provider configured |
| Hybrid | Embedding provider configured (keyword + vector + recency) |

Related bookmarks use embeddings when available.

### Searching by several words and tags

Keyword search treats each space-separated word as its own term, and every term
must match somewhere in the bookmark's title, summary, tags, or saved content.
Typing `android app opensource` therefore finds bookmarks that carry those three
tags, or mention them elsewhere. Matching is whole-word, and there is no
`tag:name` syntax.

To filter by tags exactly, click a tag in the sidebar, then Ctrl/Cmd/Shift-click
more tags to add or remove them. The active tags appear under **Filtering by**
with a **Match all / Match any** button: *all* keeps bookmarks that have every
selected tag (the default), *any* keeps bookmarks that have at least one. Tag
filters combine with the search box and the other filters. A tag that does not
exist matches nothing under *all* and is ignored under *any*. Multi-tag
selections last for the session; only the first tag is remembered.

Through the API, repeat the parameter: `GET /bookmarks?tag=android&tag=app&tag_match=any`
(also supported by `/search`, `/bookmarks/aggregates`, and `/export`).

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

## Share links (prefilled Add dialog)

Open Grimoire at `/add` with query parameters to start a save from a bookmarklet,
a custom script, or an Android share action:

```
http://127.0.0.1:3210/add?url=https%3A%2F%2Fexample.com%2Fpost&title=Nice%20post&note=Read%20later&tags=reading,rust
```

`127.0.0.1:3210` is the default address of the installed app and the Docker image. When running the Vite dev server (`npm run dev`), use `http://localhost:5173` instead.

| Parameter | Meaning | Limits |
|-----------|---------|--------|
| `url` | Link to save. Must be `http` or `https`, no embedded credentials. | 2048 characters |
| `title` | Optional title | 300 characters |
| `note` | Optional personal note | 10,000 characters |
| `tags` | Optional comma-separated tags | 20 tags, 50 characters each |

Remember to URL-encode the values. Grimoire opens the Add dialog with those
fields filled in; nothing is saved until you press **Save Bookmark**. If the URL
is already saved as an active bookmark, that bookmark opens for editing instead
and the shared title, note and tags are ignored. Parameters are removed from the
address bar once read. Invalid values (for example a `javascript:` URL) are
dropped, and everything is treated as plain text.

## Unsaved drafts

While the Add dialog is open, and while you edit a bookmark's title or notes,
Grimoire keeps your in-progress text in this browser's local storage. If you
close the dialog by accident, a save fails, or the tab crashes, reopening the
same dialog restores the text with a "Restored unsaved draft" notice and a
**Discard** button. Drafts are cleared when you save, cancel, or discard, and drafts older than 7 days are dropped automatically. They
stay in the browser only: they are never sent to the daemon and are not part of
backups. Clearing site data removes them.

## Backups

From Settings or the `grimoire` CLI you can create, list, verify, and restore local snapshots. The legacy `littleimp` command remains available as a compatibility alias. Encrypted packages and optional scheduled/S3 targets are available in Settings when configured. Restores verify checksums and create a rollback copy first.

The already-published v1.1.0 archive predates the CLI rename and uses
`littleimp` when invoked directly; current source installs and future
repackaged releases use `grimoire`.

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

Search results default to **Relevance**. You can choose a different sort while
searching; clearing the query restores your saved library sort. AI and mixed
search rank indexed bookmarks by similarity, so their result count can include
the full indexed library even when keyword search would return no matches.
