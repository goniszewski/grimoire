# Little Imp — Roadmap

Version: draft-v4
Status: Draft (for iteration)
Author: Robert Goniszewski
Date: March 2026

---

## Context

Little Imp is past the v0-alpha milestone (save → search → retrieve works). This roadmap focuses on reaching a stable, self-distributable v0-beta by closing the gap between the current implementation and a complete, usable product.

Priority order: **UX completeness → AI features → distribution → testing infrastructure**.

---

## Current State (March 2026)

**Works today:**
- Bookmark ingestion, content extraction, AI enrichment pipeline
- Embeddings pipeline (generate + store; skipped when `EMBEDDING_API_KEY` unset)
- FTS5 keyword search, semantic search, hybrid search (BM25 + cosine) with mode toggle
- Category tree with full CRUD (create, rename, delete, reparent) and tag management
- Pin / unpin, archive / unarchive, mark as read / unread
- Personal notes on bookmarks (Markdown, inline edit)
- Trash system: soft-delete, restore, permanent delete, 30-day auto-purge
- Archive page (`/archive`), Trash page (`/trash`)
- Import (Netscape HTML) / Export (JSON, CSV)
- Review queue (AI suggestions UI) — fully wired: acceptance executes actions atomically
- Timeline view — all agent and user actions recorded
- Organization agent: duplicate detection, category merge suggestions, auto-apply at confidence ≥ 0.9
- `GET /bookmarks/:id/related` — nearest neighbours by embedding
- Settings page (`/settings`): LLM provider, API key, model, embedding provider
- Domains view

**Remaining gaps:**
- Category move via drag-and-drop (only "Move to…" dropdown implemented)
- Unit and integration tests
- Distribution / installer validation
- First-run onboarding / empty state polish
- Backup / restore documentation

---

## Milestones

---

### M1 — Core User Journeys Complete ✅

> Goal: Every basic action a user wants to take on a bookmark is possible and intuitive.

**Bookmark status actions**
- [x] Pin / unpin bookmark (UI + API)
- [x] Archive / unarchive bookmark (UI + API) — hidden from main feed, no expiry, accessible via `/archive` page
- [x] Mark as read / unread (UI + API)

**Trash system**
- [x] Add `is_trashed` + `trashed_at` columns via migrations (`0006`, `0007`)
- [x] Trash icon moves bookmark to Trash (hidden from all views including archive)
- [x] Archive page (`/archive`): archived bookmarks, excludes trashed items; unarchive action
- [x] Trash page (`/trash`): soft-deleted bookmarks with restore and "Delete permanently" actions
- [x] Background purge job: hard-delete rows where `trashed_at` older than 30 days

**Personal notes**
- [x] Add `notes TEXT` column via migration (`0008_bookmark_notes.sql`)
- [x] Expose `notes` in `PUT /bookmarks/:id`
- [x] Update `BookmarkRepository.update()` to accept `notes`
- [x] Display notes in `BookmarkDetailContent` with Markdown rendering (read mode)
- [x] Edit notes inline with a Markdown textarea (write mode)

**Category management**
- [x] Rename category (inline edit in sidebar)
- [x] Delete category (with confirmation — bookmarks become uncategorized)
- [x] Move / reparent category via drag-and-drop in sidebar (primary) — TASK-034
- [x] Move / reparent category via "Move to…" dropdown (fallback / mobile-friendly)

**Bookmark editing**
- [x] All editable fields accessible from `BookmarkDetailContent`: title, URL, category, tags, notes
- [x] Summary edit reviewed and polished

---

### M2 — Settings UI ✅

> Goal: Users can configure the daemon from the app, not by editing env files.

- [x] Settings as a dedicated page (`/settings`) in frontend
- [x] Display current AI provider and model
- [x] Edit LLM provider (OpenAI / Ollama / none), API key, model name
- [x] Edit Embedding provider and model
- [x] "Test connection" button (`POST /settings/test-ai`)
- [x] Show redacted API key in UI
- [x] Persist settings via `PUT /settings`

---

### M3 — AI Features Fully Wired ✅

> Goal: Semantic search and the organization agent are functional end-to-end.

**Embeddings**
- [x] Embed pipeline stage runs after `ai_enriched` status
- [x] Embeddings stored correctly in `embeddings` table
- [x] Pipeline status surfaced in UI via `PipelineBadge` (`indexed` state)

**Semantic search**
- [x] `GET /search?mode=semantic` — embedding cosine similarity
- [x] `GET /search?mode=hybrid` — FTS5 BM25 + cosine similarity combined
- [x] `GET /bookmarks/:id/related` — nearest neighbours by embedding
- [x] Search mode toggle in UI (keyword / semantic / hybrid)

**Organization agent**
- [x] Agent runs on scheduler (`AGENT_INTERVAL_MS`), writes to `agent_suggestions`
- [x] Agent skips run when library has < 20 bookmarks (cold-start guard)
- [x] Suggestion acceptance wired to real actions (category create/merge, bookmark trash) — atomic transaction
- [x] Timeline events recorded for all agent and user actions
- [x] Auto-apply threshold (confidence ≥ 0.9) executes actions directly; lower-confidence items queued for review
- [x] `suggestion_accepted` / `suggestion_rejected` timeline event types added

---

### M4 — Testing Infrastructure

> Goal: Confidence to ship without manual regression testing.

**Unit tests — daemon (Bun test runner)**
- [x] `JobQueue` — enqueue, dequeue, status transitions
- [x] `BookmarkRepository` — CRUD, FTS sync, cascade delete
- [x] `CategoryRepository` — tree queries, reparent, depth limits
- [ ] Extraction pipeline stages — fetch, extract, ai_enrich, embed, index
- [x] Search — keyword results, FTS sanitisation, filter options
- [x] Trash purge — soft-delete, restore, 30-day expiry

**Integration tests — daemon (Bun test runner, in-memory SQLite)**
- [ ] Full ingestion flow: `POST /bookmarks` → pipeline → `GET /bookmarks/:id` (status: indexed)
- [ ] Import flow: upload Netscape HTML → all bookmarks ingested
- [ ] Search: bookmark ingested → FTS returns it
- [ ] Category and tag CRUD via API
- [ ] Archive: archive → hidden from main feed → appears in `/archive` → unarchive → back in feed
- [ ] Trash: delete → appears in `/trash` → restore → no longer in trash; purge after 30 days

**Frontend tests (Vitest)**
- [ ] Unit tests for hooks (`use-bookmarks`, `use-daemon-status`, `use-suggestions`)
- [ ] Component tests for `BookmarkCard`, `BookmarkDetailContent`, `AppSidebar`
- [ ] E2E: add bookmark → appears in list → open detail → edit notes → save

---

### M5 — Distribution Readiness

> Goal: Someone else can install and run Little Imp without assistance.

**Installer**
- [ ] Test `install.sh` end-to-end on macOS (fresh environment)
- [ ] Test systemd unit on Linux
- [ ] Verify macOS LaunchAgent `.plist` auto-starts daemon on login
- [ ] Document manual start/stop/restart commands

**First-run experience**
- [ ] Detect empty library state — show onboarding message or empty state UI
- [ ] Cold start: clustering disabled under 20 bookmarks — enforced ✓; verify from UI perspective
- [ ] Explain degraded mode clearly when AI providers are unset: keyword search works, enrichment / embeddings are skipped
- [ ] Graceful "daemon offline" banner already exists — confirm it shows on first launch before daemon starts

**Packaging**
- [ ] Single-command install: `curl | sh` or Homebrew formula (future)
- [ ] Document `DATA_DIR` location and manual backup procedure
- [ ] Document restore procedure from an existing data directory on a fresh install
- [ ] Release notes / changelog format established

**Backup and restore**
- [ ] Define portable backup bundle format: SQLite DB + manifest + checksums + optional attachments
- [ ] Add "Create backup now" action that writes to a local folder
- [ ] Add "Restore from backup" flow with compatibility checks and clear overwrite rules
- [ ] Add scheduled local snapshots with retention policy
- [ ] Add remote backup target abstraction with first-class S3-compatible support
- [ ] Support user-selected cloud-synced folders as normal local destinations (iCloud Drive, Dropbox, Google Drive, OneDrive)
- [ ] Defer provider-specific APIs unless folder-based backup proves insufficient

---

## User Journey Coverage

| Journey | Status |
|---|---|
| Save a URL | ✅ Done |
| Search saved content (keyword) | ✅ Done |
| Search saved content (semantic / hybrid) | ✅ Done (M3) |
| Add a personal note to a bookmark | ✅ Done (M1) |
| Edit title / tags / category | ✅ Done (M1) |
| Pin important bookmarks | ✅ Done (M1) |
| Archive a bookmark (hide, no expiry) | ✅ Done (M1) |
| Unarchive a bookmark | ✅ Done (M1) |
| Move bookmark to Trash (30-day soft-delete) | ✅ Done (M1) |
| Restore bookmark from Trash | ✅ Done (M1) |
| Permanently delete a bookmark | ✅ Done (M1) |
| Mark a bookmark as read | ✅ Done (M1) |
| Create a category | ✅ Done |
| Rename a category | ✅ Done (M1) |
| Delete a category | ✅ Done (M1) |
| Move a category under another | ✅ Done (M1, TASK-034) |
| Configure AI provider | ✅ Done (M2) |
| Import bookmarks from browser | ✅ Done |
| Export bookmarks | ✅ Done |
| Review AI suggestions (accept/reject wired) | ✅ Done (M3) |
| Find related bookmarks | ✅ Done (M3) |
| Semantic / hybrid search | ✅ Done (M3) |
| Understand degraded mode when AI is not configured | ❌ Not yet explicit in UI/docs |
| Back up and restore local data confidently | ⚠️ Partial (backup path planned; restore flow undocumented) |

---

## Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Archive vs. delete UX | Archive (`is_archived`) = hidden permanently, no expiry, own `/archive` page. Trash (`is_trashed` + `trashed_at`) = 30-day soft-delete, purged automatically, own `/trash` page. Both are separate states. |
| 2 | Notes rendering | Markdown (rendered read mode, textarea write mode) |
| 3 | Pinned bookmarks display | Pinned bookmarks sort first within the active view |
| 4 | Settings page vs. dialog | Separate `/settings` page, distinct from Preferences dialog |
| 5 | Category move UI | Both: drag-and-drop (primary, not yet built) + "Move to…" dropdown (implemented) |
| 6 | Test framework | Bun test runner (daemon) + Vitest (frontend) |
| 7 | Suggestion acceptance atomicity | `applyAction` + `repo.accept()` + timeline insert wrapped in single SQLite transaction |
| 8 | Auto-apply behavior | Confidence ≥ 0.9: execute action immediately + record timeline. Lower: queue for human review. |
| 9 | Cold-start search behavior | Under 20 bookmarks, clustering/organization automation is limited, but keyword search remains available and semantic search can still work for bookmarks that already have embeddings. |
| 10 | Vector storage approach | Embeddings are currently stored as float32 BLOBs in SQLite; sqlite-vec remains a future optimization, not a current dependency. |
| 11 | Backup model | Backup is snapshot-based, not live sync. Restore always recreates a local data directory from a portable backup bundle. |
| 12 | Cloud backup scope | First remote target is S3-compatible object storage. iCloud Drive and similar services are supported initially via user-selected synced folders, not dedicated APIs. |

---

## Out of Scope (for now)

- Browser extension
- MCP integration
- Plugin system
- Multi-device sync
- PDF / YouTube / GitHub Issues extractors (schema-ready, not prioritized)
- Docker packaging
- Rate limiting / auth (local-only assumption holds)
- Category drag-and-drop reparenting (deferred; "Move to…" dropdown covers the use case)
