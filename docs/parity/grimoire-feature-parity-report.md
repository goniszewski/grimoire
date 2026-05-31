# Little Imp vs Grimoire Feature Parity Report

Date: 2026-05-30

## Scope

This report compares the current Little Imp workspace against `goniszewski/grimoire` for practical feature parity.

- Little Imp baseline: `3b73011715e74296f0aa4f91ede120409441fb6c` (`2026-05-29`, `chore: add UI audit and task reporting workflow`)
- Grimoire baseline: `7bb6e74c1f6c026040c5be53d5d45eac7c44ee91` (`2025-05-31`, `added one-click deploy via deploystack (#188)`)
- Little Imp source inspected from this local workspace.
- Grimoire source inspected from a fresh GitHub clone.

## Executive Summary

Little Imp is not at full Grimoire parity, but the current workspace has already closed several gaps that were present in earlier snapshots. Little Imp now has bookmark notes, read state, archive/trash flows, category CRUD with reparenting, tag CRUD APIs, generated API contract data, richer release/install documentation, backups, diagnostics, updates, timeline events, suggestions, and a stronger local daemon pipeline.

The largest remaining gaps are Grimoire's multi-user/account model, session/API authentication, profile/admin surfaces, browser-extension-compatible capture API, Grimoire-style import review and migration flows, richer bookmark metrics such as flagged/importance/open counts, dedicated tag/category pages, and richer media/content presentation in bookmark detail.

## Parity Table

| Feature Area | Grimoire | Little Imp | Parity | Notes |
| --- | --- | --- | --- | --- |
| Product model | Self-hosted web app with multi-user assumptions | Local-first single-user app with loopback daemon | Intentional gap pending decision | Decide whether this is a required parity target or an explicit product difference. |
| Multi-user accounts | Signup, login, per-user data, first user becomes admin | No multi-user auth; app lock is local privacy only | Missing | Multi-user research exists in `docs/multi-user-post-mvp-research.md`, but no implementation. |
| Sessions and API auth | Lucia sessions plus bearer-token API patterns | Daemon REST API is unauthenticated on loopback | Missing | Current docs warn against public exposure without external auth. |
| Admin panel | User list, counts, disable/delete users | None | Missing | Only relevant if server or multi-user mode is approved. |
| Profile page | User info, password editing, profile stats | Preferences and app lock only | Missing | Local preferences are not equivalent to account profile management. |
| Bookmark CRUD | Add, edit, delete, list, detail | Add, list, detail, soft delete, restore, permanent delete, update selected fields | Partial | Little Imp updates title, category, tags, pin, archive, read state, and notes. URL/summary edit UI is still not backed by API mutation. |
| Bookmark fields | URL, title, description, author, content, note, images, icon, screenshot, importance, flagged, read, archive, opened counts | URL, title, description, content table, author, published date, favicon/screenshot columns, pinned, archived, trashed, read_at, notes, tags, category | Partial | Notes/read/archive are present. Importance, flagged/starred, opened count, and last-opened are missing. |
| Metadata and extraction | Metadata fetch plus article extraction | Async fetch/extract/AI/embed/index pipeline with site-specific extractors | Little Imp ahead | Little Imp has stronger background processing and recovery behavior. |
| Bookmark notes | Markdown-like personal notes | Markdown notes in API and detail UI | At parity | Implemented through `bookmarks.notes` and detail editor. |
| Read state | Read/unread flag | `read_at` API field plus card/detail controls | Partial | Read state exists; list-level unread/read filters are not exposed. |
| Flagged/starred | Flagged bookmark state | Pinning exists but no separate flagged state | Partial / missing | Product should decide whether pin maps to flagged or a distinct field is needed. |
| Importance | Importance score/rating | None | Missing | Needed for Grimoire field parity and sorting/filtering parity. |
| Open tracking | Open count and last-opened timestamp | None | Missing | Useful for stats, sorting, and parity with Grimoire's opened metrics. |
| Tags | Tag CRUD and bookmark assignment | Tag API list/create/delete/attach/detach; UI assign/remove/filter | Partial | No dedicated tag management page, rename flow, or tag detail page. |
| Categories | Category CRUD, metadata fields, category pages | Category API create/update/delete/tree; UI create/rename/delete/move/drag/filter | Partial | Missing rich fields such as color/icon/description/slug/public/archive, and dedicated category pages. |
| Search | Fuzzy search with filters | Keyword FTS plus optional semantic/hybrid search | Little Imp ahead in backend | UI still lacks several Grimoire-style filters. |
| Filters | Unread, flagged, sort/domain/opened count and related filters | Category, tag, domain, date range, sort by date/title/domain | Partial | Missing unread/read, flagged, importance, opened-count, and last-opened filters. |
| Pagination | Paginated app pages | API supports pagination; UI requests up to 200 results | Partial | Need pagination or infinite scroll for large libraries. |
| Bookmark detail | Rich metadata, media carousel, content tabs, note, stats | Detail drawer with summary, notes, tags, category, URL/date/actions, related bookmarks | Partial | Missing content tabs, media carousel, opened stats, and richer metadata editing. |
| Import | Browser import with review-oriented workflow | Netscape HTML import with SSE progress, tags parsed, folders parsed but not applied | Partial | Need pre-import review, duplicate choices, and category mapping from folders. |
| Export | Export/migration capabilities | JSON/CSV export with filters | Partial | Current export omits some parity fields such as notes/read/archive unless intentionally excluded. |
| Migration | PocketBase/Grimoire migration helpers | None | Missing | Only needed if direct Grimoire migration is a product goal. |
| Public API docs | OpenAPI-style schema/docs for integration clients | `docs/api-contract.json`; no `API.md` present in workspace | Partial | Contract exists, but human/API client docs and extension examples need work. |
| Browser extension support | Companion extension supported by API | No explicit extension auth or capture endpoint | Missing | Add integration token and one-click capture flow if this parity target is approved. |
| Deployment | Docker/self-hosting-oriented docs | Native installer, Homebrew, local daemon, Docker guidance, update docs | Mixed | Little Imp is stronger for local install; Grimoire is stronger for self-hosted multi-user deployment. |
| Backups and restore | Not a primary parity strength | Local/S3 backups, encrypted packages, restore recovery | Little Imp ahead | This is beyond Grimoire parity. |
| Timeline and suggestions | Limited compared with Little Imp | Timeline events, review queue, AI organization suggestions | Little Imp ahead | Local-first AI organization is a Little Imp differentiator. |
| App lock and preferences | Not a core Grimoire feature | Local app lock, theme, view, button-label preferences | Little Imp ahead | App lock does not replace server authentication. |

## Key Remaining Gaps

1. Decide whether Grimoire's multi-user/auth/admin model is required parity or an intentional non-goal.
2. Add integration authentication and browser-extension-compatible capture APIs if extension parity is approved.
3. Fix the bookmark detail edit mismatch for URL and summary.
4. Add missing rich bookmark fields: flagged/starred, importance, opened count, and last-opened timestamp.
5. Add dedicated tag/category management and detail pages, plus richer category metadata if desired.
6. Add import review, duplicate handling, folder-to-category mapping, and optional Grimoire/PocketBase migration.
7. Add UI pagination or infinite scroll, server-driven sorting, and missing filters.
8. Publish human-readable API docs and examples from the daemon contract.

## Notable Little Imp Advantages

- Local-first loopback daemon with SQLite storage.
- Async ingestion pipeline with fetch, extract, AI enrichment, embeddings, indexing, retries, and failure recovery.
- Keyword, semantic, and hybrid search architecture.
- Category timeline events and AI organization review queue.
- Backup, encrypted backup package, restore, diagnostics, update, and installer workflows.
- Strong local install documentation for native daemon, Homebrew, Docker guidance, and release validation.
- MCP route/server support.

## Evidence References

Little Imp:

- Daemon routes: `daemon/src/routes/bookmarks.ts`, `daemon/src/routes/categories.ts`, `daemon/src/routes/tags.ts`, `daemon/src/routes/import.ts`, `daemon/src/routes/export.ts`, `daemon/src/routes/search.ts`
- Frontend API client: `src/lib/api.ts`
- Library state and mutations: `src/hooks/use-bookmarks.ts`
- Bookmark detail UI: `src/components/BookmarkDetailContent.tsx`
- Category management UI: `src/components/AppSidebar.tsx`
- Import UI: `src/components/ImportDialog.tsx`
- API contract: `docs/api-contract.json`
- Multi-user research: `docs/multi-user-post-mvp-research.md`
- Deployment/security docs: `README.md`, `docs/docker-deployment.md`, `docs/release-decision-v0.1.0-beta.md`

Grimoire:

- SvelteKit routes under `src/routes`
- Authentication helpers under `src/lib/server/auth.ts`
- Bookmark, category, tag, admin, profile, import, and API routes under `src/routes`
- PocketBase migration and OpenAPI-related documentation in repository docs/scripts

## Recommended Implementation Order

1. Confirm product scope: local-first only, integration-compatible local app, or full Grimoire-style multi-user mode.
2. Fix existing UI/API correctness gaps before adding new fields.
3. Add integration authentication, API docs, and capture endpoint if extension parity is approved.
4. Add missing bookmark metrics and filters.
5. Expand category/tag pages and management.
6. Improve import review and migration.
7. Add pagination/scale work and final parity acceptance tests.
