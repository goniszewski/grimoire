# Little Imp vs Grimoire Feature Parity Report

Date: 2026-05-31

## Scope

This report compares the current Little Imp workspace against `goniszewski/grimoire` for practical feature parity.

- Little Imp baseline: `3b73011715e74296f0aa4f91ede120409441fb6c` (`2026-05-29`, `chore: add UI audit and task reporting workflow`)
- Grimoire baseline: `7bb6e74c1f6c026040c5be53d5d45eac7c44ee91` (`2025-05-31`, `added one-click deploy via deploystack (#188)`)
- Little Imp source inspected from this local workspace.
- Grimoire source inspected from a fresh GitHub clone.

The current parity batch is locked as local-first, single-user,
loopback-first, and local-integrations-only. It is not a promise of full
Grimoire server parity. Deferred and rejected rows in
`docs/parity/grimoire-parity-task-proposals.md` are intentional product
decisions for this batch rather than hidden unfinished work.

## Executive Summary

Little Imp is not at full Grimoire server parity, but the current workspace has already closed several gaps that were present in earlier snapshots. Little Imp now has bookmark notes, read state, archive/trash flows, category CRUD with reparenting, tag CRUD APIs, generated API contract data, richer release/install documentation, backups, diagnostics, updates, timeline events, suggestions, and a stronger local daemon pipeline.

The largest in-scope gaps were local integration authentication, human/API
client documentation, import review and duplicate handling, read-later/open
metrics, dedicated tag/category surfaces, explicit pagination/filtering, and
richer bookmark detail presentation. The current workspace now includes a
protected local `/capture` endpoint for explicit integration clients. Grimoire's
multi-user/account model, profile/admin surfaces, public-server deployment
posture, endpoint aliases, packaged browser-extension/bookmarklet clients, and
extension compatibility smoke tests remain deliberate non-goals or deferred
decisions for this batch.

## Current Parity Batch Scope

This batch keeps Little Imp's product model intact:

- **Local-first:** SQLite data, backups, diagnostics, and runtime settings stay
  under the user's local control.
- **Single-user:** there is no account model, shared workspace, role model, or
  per-user data partitioning in this batch.
- **Loopback-first:** the daemon remains intended for trusted local access on
  `127.0.0.1`; public-network exposure is out of scope unless a future security
  design explicitly approves it.
- **Local integrations only:** MCP, CLI, protected local capture, local
  scripts, and other explicit local clients are in scope. Packaged
  browser-extension/bookmarklet clients and Grimoire-compatible endpoint aliases
  are not part of this batch.

## Intentional Non-Goals

| Non-goal | Decision source | Rationale | Reconsideration trigger |
| --- | --- | --- | --- |
| Multi-user accounts, signup, login, sessions, profile management, admin roles, and per-user backup scoping | PAR-028 through PAR-034 | These features would change Little Imp from a local personal app into a server/account product and would affect storage, backups, diagnostics, MCP, settings, auth, and support. | Reopen only through a separate multi-user/server product decision with schema, migration, auth/session, backup-scoping, and threat-model work approved together. |
| Public-server or non-loopback deployment mode | PAR-004, TASK-087 | Current daemon routes, installer defaults, Docker docs, and support posture assume trusted loopback access. | Reopen only through the gates in `docs/security-boundaries.md`, including auth, origin policy, CSRF expectations, secrets, diagnostics, backups, MCP, updates, and network exposure. |
| Grimoire-compatible endpoint aliases or adapter routes | PAR-025 | Aliases would add long-term API compatibility surface without a current local-first migration or extension requirement. | Reconsider only if a concrete integration or migration path proves aliases materially reduce user migration cost without weakening the canonical Little Imp API contract. |
| Packaged browser-extension/bookmarklet client | PAR-027 follow-up | The protected local `/capture` endpoint exists, but this batch does not ship or validate a packaged browser client. | Reopen only with a concrete client distribution and setup design that uses integration tokens and loopback-only origins. |
| Browser-extension compatibility smoke tests | PAR-027 | Extension flows are excluded while no packaged browser client is shipped. | Add smoke coverage only when a packaged browser-extension/bookmarklet client is reopened. |
| Bookmark importance rating | PAR-009, TASK-090 | Manual importance adds schema, API, UI, filter, sort, import, and export complexity without clear current workflow value. | Reconsider only if a future ranking or personalization design proves a manual importance signal materially improves retrieval. |
| Direct Grimoire/PocketBase backup import tooling | PAR-041, TASK-112 | Current import/export work should first stabilize browser/Netscape import review, duplicate handling, remapping, result reports, and approved parity fields. | Reopen after TASK-108, TASK-109, TASK-110, TASK-120, and approved bookmark parity fields are stable and the Grimoire backup data shape is documented. |

## Parity Table

| Feature Area | Grimoire | Little Imp | Parity | Notes |
| --- | --- | --- | --- | --- |
| Product model | Self-hosted web app with multi-user assumptions | Local-first single-user app with loopback daemon | Intentional product difference | Current parity batch is local-first, single-user, loopback-first, and local-integrations-only. |
| Multi-user accounts | Signup, login, per-user data, first user becomes admin | No multi-user auth; app lock is local privacy only | Deferred non-goal | Deferred by PAR-028 through PAR-034. A future multi-user/server mode is a separate product decision, not unfinished current-batch work. |
| Sessions and API auth | Lucia sessions plus bearer-token API patterns | First-party REST remains loopback-trusted; MCP and protected capture use managed bearer tokens | Partial local integration parity | Grimoire-style sessions are out of scope. TASK-102 adds scoped local integration-token auth without turning Little Imp into a multi-user server. |
| Admin panel | User list, counts, disable/delete users | None | Deferred non-goal | Admin roles only matter if multi-user/server mode is reopened. |
| Profile page | User info, password editing, profile stats | Preferences and app lock only | Deferred non-goal | Local preferences are not account profile management; account profiles are deferred with multi-user support. |
| Bookmark CRUD | Add, edit, delete, list, detail | Add, list, detail, soft delete, restore, permanent delete, update selected fields | Partial | Little Imp updates title, category, tags, pin, archive, read state, and notes. URL/summary edit UI is still not backed by API mutation. |
| Bookmark fields | URL, title, description, author, content, note, images, icon, screenshot, importance, flagged, read, archive, opened counts | URL, title, description, content table, author, published date, favicon/screenshot columns, pinned, read-later, archived, trashed, read_at, notes, tags, category, opened count, last-opened timestamp | Partial | Notes/read/archive/read-later/opened metrics are present. Starred/favorite maps to pinned, and importance is rejected for this batch. |
| Metadata and extraction | Metadata fetch plus article extraction | Async fetch/extract/AI/embed/index pipeline with site-specific extractors | Little Imp ahead | Little Imp has stronger background processing and recovery behavior. |
| Bookmark notes | Markdown-like personal notes | Markdown notes in API and detail UI | At parity | Implemented through `bookmarks.notes` and detail editor. |
| Read state | Read/unread flag | `read_at` API field plus card/detail controls | Partial | Read state exists; list-level unread/read filters are not exposed. |
| Flagged/starred | Flagged bookmark state | Pinning exists and maps to Grimoire starred/favorite; read-later is a separate flag | Intentional mapping | PAR-007 maps Grimoire starred/favorite state to existing Little Imp pinning. TASK-089 adds separate read-later persistence and UI controls. |
| Importance | Importance score/rating | None | Rejected non-goal | TASK-090 rejects manual importance for this parity batch. |
| Open tracking | Open count and last-opened timestamp | Persisted open count, last-opened timestamp, tracked open endpoint, and shared UI open tracking | At parity | Implemented by TASK-091. Future sorting/filtering by open metrics remains covered by the filter/sort backlog. |
| Tags | Tag CRUD and bookmark assignment | Tag API list/create/delete/attach/detach/rename; UI assign/remove/filter, dedicated management page, and tag detail pages | Partial | Tag management is in review through TASK-098, while tag detail pages, tag rename, and category/tag regression coverage are complete through TASK-099, TASK-100, and TASK-101. |
| Categories | Category CRUD, metadata fields, category pages | Category API create/update/delete/tree; UI create/rename/delete/move/drag/filter, category detail pages, and local metadata fields in review | Partial | Category detail pages are complete through TASK-096. Rich local metadata fields are in review through TASK-097; public visibility remains local metadata only. |
| Search | Fuzzy search with filters | Keyword FTS plus optional semantic/hybrid search | Little Imp ahead in backend | UI still lacks several Grimoire-style filters. |
| Filters | Unread, flagged, sort/domain/opened count and related filters | Category, tag, domain, date range, read-later, sort by date/title/domain | Partial | Missing unread/read, pinned/starred, opened-count, and last-opened filters. Importance filters are rejected for this batch. |
| Pagination | Paginated app pages | API supports pagination; UI requests up to 200 results | Partial | Need pagination or infinite scroll for large libraries. |
| Bookmark detail | Rich metadata, media carousel, content tabs, note, stats | Detail drawer with summary, notes, tags, category, URL/date/actions, related bookmarks | Partial | Missing content tabs, media carousel, opened stats, and richer metadata editing. |
| Import | Browser import with review-oriented workflow | Netscape HTML import with SSE progress, tags parsed, folder hierarchy imported as categories, and duplicate-policy preview/commit semantics | Partial | Need the visible pre-import review UI, category/tag remapping, final result reporting, and broader import/export regression coverage. |
| Export | Export/migration capabilities | JSON/CSV export with filters plus notes, read state, archive state, pinned/starred mapping, read-later state, and opened metrics | At parity | TASK-111 completed approved export parity fields for active-library JSON/CSV exports. Direct Grimoire backup import remains deferred separately. |
| Migration | PocketBase/Grimoire migration helpers | None | Deferred non-goal for direct Grimoire backup import | TASK-112 defers direct Grimoire/PocketBase import until normal import/export parity is stable. Browser/Netscape import hardening remains in scope. |
| Public API docs | OpenAPI-style schema/docs for integration clients | Generated `API.md`, `docs/api-contract.json`, and `docs/openapi.json` | Partial | Human-readable local client examples, OpenAPI-compatible output, local CORS setup docs, and protected `/capture` examples are complete through TASK-103, TASK-104, TASK-105, and TASK-106. |
| Browser extension support | Companion extension supported by API | Protected local `/capture` endpoint exists; no packaged browser client is shipped | Partial local integration parity | TASK-105 adds the token-protected capture endpoint. Packaged browser-extension/bookmarklet clients and extension smoke tests remain out of scope for this batch. |
| Deployment | Docker/self-hosting-oriented docs | Native installer, Homebrew, local daemon, Docker guidance, update docs | Intentional product difference | Little Imp is stronger for local install. Public-server and multi-user deployment modes are out of scope for this parity batch. |
| Backups and restore | Not a primary parity strength | Local/S3 backups, encrypted packages, restore recovery | Little Imp ahead | This is beyond Grimoire parity. |
| Timeline and suggestions | Limited compared with Little Imp | Timeline events, review queue, AI organization suggestions | Little Imp ahead | Local-first AI organization is a Little Imp differentiator. |
| App lock and preferences | Not a core Grimoire feature | Local app lock, theme, view, button-label preferences | Little Imp ahead | App lock does not replace server authentication. |

## Key Remaining Gaps

1. Keep human-readable API examples, OpenAPI-compatible output, and CORS/origin documentation generated from the daemon contract for local scripts and integration clients.
2. Add open metrics while preserving the starred/favorite-to-pinned mapping and the separate read-later flag.
3. Fix the bookmark detail edit mismatch for URL and summary, then add richer metadata/content sections.
4. Add dedicated tag/category management and detail pages, plus approved category metadata.
5. Add import review, duplicate handling, folder-to-category mapping, remapping, result reporting, and export parity fields.
6. Add explicit UI pagination, server-driven sorting, additional approved filters, aggregate counts, and large-library performance checks.

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

## Recurring Release Review

`docs/release-checklist.md` now includes a recurring Grimoire parity review for
release planning. Use it before every parity-facing beta or release-candidate
build to confirm closed parity gaps still have passing API, daemon, frontend,
visual, Playwright e2e, and performance verification where relevant.

## Recommended Implementation Order

1. Keep completed local integration API examples, OpenAPI output, protected capture, and CORS/origin controls stable: TASK-103, TASK-104, TASK-105, and TASK-106.
2. Fix existing bookmark mutation/detail correctness and add approved bookmark fields: TASK-089, TASK-091, TASK-092, and TASK-094.
3. Expand category/tag surfaces and regression coverage: TASK-095 through TASK-101.
4. Improve browser/Netscape import, export parity, duplicate policy, and import/export regression tests: TASK-107 through TASK-113 and TASK-120, excluding deferred TASK-112 implementation.
5. Add pagination, server-driven sorting, approved filters, persisted view preferences, aggregate counts, and large-library verification: TASK-114 through TASK-119.
