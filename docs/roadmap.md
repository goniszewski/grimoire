# Little Imp — Roadmap

Version: draft-v3
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
- FTS5 keyword search with filters
- Category tree (create only) and tag management
- Import (Netscape HTML) / Export (JSON, CSV)
- Review queue (AI suggestions UI)
- Timeline view
- Domains view

**Schema exists but not wired:**
- `is_pinned`, `is_archived`, `read_at` — columns in DB, no API or UI
- Soft delete via `is_archived` — repository method exists, not triggered from UI

**Completely missing:**
- Personal notes on bookmarks (schema, API, UI)
- Category rename / delete / move (backend done, UI missing)
- Settings UI (AI provider, API keys)
- Semantic / hybrid search fully wired
- Embeddings pipeline integration
- Unit and integration tests

---

## Milestones

---

### M1 — Core User Journeys Complete

> Goal: Every basic action a user wants to take on a bookmark is possible and intuitive.

**Bookmark status actions**
- [ ] Pin / unpin bookmark (UI + API); pinned position is per-category by default, with a user toggle to pin globally
- [ ] Archive / unarchive bookmark (UI + API) — hidden from main feed, no expiry, accessible via `/archive` page
- [ ] Mark as read / unread (UI + API)

**Trash system**
- [ ] Add `deleted_at TEXT` column via migration (`0006_trash.sql`)
- [ ] Trash icon moves bookmark to Trash (`deleted_at` set, hidden from all views including archive)
- [ ] Archive page (`/archive`): archived bookmarks, excludes trashed items; unarchive action
- [ ] Trash page (`/trash`): soft-deleted bookmarks with restore and "Delete permanently" actions
- [ ] Background purge job: hard-delete rows where `deleted_at` older than 30 days

**Personal notes**
- [ ] Add `notes TEXT` column via migration (`0007_bookmark_notes.sql`)
- [ ] Expose `notes` in `PUT /bookmarks/:id`
- [ ] Update `BookmarkRepository.update()` to accept `notes`
- [ ] Display notes in `BookmarkDetailContent` with Markdown rendering (read mode)
- [ ] Edit notes inline with a Markdown textarea (write mode), consistent with existing inline edit pattern

**Category management**
- [ ] Rename category (inline edit in sidebar or context menu)
- [ ] Delete category (with confirmation — reassign or orphan bookmarks)
- [ ] Move / reparent category via drag-and-drop in sidebar (primary)
- [ ] Move / reparent category via "Move to…" dropdown (fallback / mobile-friendly)

**Bookmark editing**
- [ ] Ensure all editable fields are accessible from `BookmarkDetailContent`: title, URL, category, tags, notes
- [ ] Summary edit already exists — review and polish

---

### M2 — Settings UI

> Goal: Users can configure the daemon from the app, not by editing env files.

- [ ] Settings as a dedicated page (`/settings`) in frontend — separate from the existing Preferences dialog
- [ ] Display current AI provider and model
- [ ] Edit LLM provider (OpenAI / Ollama / none), API key, model name
- [ ] Edit Embedding provider and model
- [ ] "Test connection" button (backend endpoint already exists: `POST /settings/test-ai`)
- [ ] Show redacted API key in UI (backend already redacts)
- [ ] Persist settings via `PUT /settings`

---

### M3 — AI Features Fully Wired

> Goal: Semantic search and the organization agent are functional end-to-end.

**Embeddings**
- [ ] Confirm embed pipeline stage runs after `ai_enriched` status
- [ ] Verify embedding stored correctly in `embeddings` table
- [ ] Surface pipeline status in UI (already has `PipelineBadge` — confirm `indexed` state is reached)

**Semantic search**
- [ ] Wire `GET /search?mode=semantic` to embedding similarity (currently stubbed)
- [ ] Wire `GET /search?mode=hybrid` — combine FTS5 BM25 + cosine similarity per PRD weights
- [ ] `GET /bookmarks/:id/related` — return nearest neighbors by embedding (currently stubbed)

**Organization agent**
- [ ] Confirm agent runs on scheduler and writes to `agent_suggestions`
- [ ] Wire suggestion acceptance to category create / merge / duplicate mark APIs
- [ ] Wire timeline event recording for all agent actions
- [ ] Auto-apply threshold (confidence ≥ 0.9) tested and verified

---

### M4 — Testing Infrastructure

> Goal: Confidence to ship without manual regression testing.

**Unit tests — daemon (Bun test runner)**
- [ ] `JobQueue` — enqueue, dequeue, status transitions
- [ ] `BookmarkRepository` — CRUD, FTS sync, cascade delete
- [ ] `CategoryRepository` — tree queries, reparent, depth limits
- [ ] Extraction pipeline stages — fetch, extract, ai_enrich, embed, index
- [ ] Search — keyword results, hybrid ranking weights
- [ ] Trash purge — soft-delete, restore, 30-day expiry

**Integration tests — daemon (Bun test runner, in-memory SQLite)**
- [ ] Full ingestion flow: `POST /bookmarks` → pipeline → `GET /bookmarks/:id` (status: indexed)
- [ ] Import flow: upload Netscape HTML → all bookmarks ingested
- [ ] Search: bookmark ingested → FTS returns it
- [ ] Category and tag CRUD via API
- [ ] Archive: archive → hidden from main feed → appears in `/archive` → unarchive → back in feed
- [ ] Trash: delete → appears in `/trash` → restore → no longer in trash; purge after 30 days

**Frontend tests (Vitest)**
- [ ] Unit tests for hooks (`use-bookmarks`, `use-preferences`)
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
- [ ] Cold start: clustering disabled under 20 bookmarks (per PRD) — verify this is enforced
- [ ] Graceful "daemon offline" banner already exists — confirm it shows on first launch before daemon starts

**Packaging**
- [ ] Single-command install: `curl | sh` or Homebrew formula (future)
- [ ] Document `DATA_DIR` location and manual backup procedure
- [ ] Release notes / changelog format established

---

## User Journey Coverage After M1–M2

| Journey | Status After M1–M2 |
|---|---|
| Save a URL | ✓ Already works |
| Search saved content | ✓ Already works (keyword) |
| Add a personal note to a bookmark | ✓ M1 |
| Edit title / tags / category | ✓ Already partially works → polished in M1 |
| Pin important bookmarks | ✓ M1 |
| Archive a bookmark (hide, no expiry) | ✓ M1 |
| Unarchive a bookmark | ✓ M1 |
| Move bookmark to Trash (30-day soft-delete) | ✓ M1 |
| Restore bookmark from Trash | ✓ M1 |
| Permanently delete a bookmark | ✓ M1 (from Trash page) |
| Mark a bookmark as read | ✓ M1 |
| Create a category | ✓ Already works |
| Rename a category | ✓ M1 |
| Delete a category | ✓ M1 |
| Move a category under another | ✓ M1 |
| Configure AI provider | ✓ M2 |
| Import bookmarks from browser | ✓ Already works |
| Export bookmarks | ✓ Already works |
| Review AI suggestions | ✓ Already works (UI) → fully wired in M3 |
| Find related bookmarks | ✓ M3 |
| Semantic search | ✓ M3 |

---

## Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Archive vs. delete UX | Archive (`is_archived`) = hidden permanently, no expiry, own `/archive` page. Trash (`deleted_at`) = 30-day soft-delete, purged automatically, own `/trash` page. Both are separate states. |
| 2 | Notes rendering | Markdown (rendered read mode, textarea write mode) |
| 3 | Pinned bookmarks display | Per-category by default; user can toggle to pin globally |
| 4 | Settings page vs. dialog | Separate `/settings` page, distinct from Preferences dialog |
| 5 | Category move UI | Both: drag-and-drop (primary) + "Move to…" dropdown (fallback) |
| 6 | Test framework | Bun test runner (daemon) + Vitest (frontend) |

---

## Out of Scope (for now)

- Browser extension
- MCP integration
- Plugin system
- Multi-device sync
- PDF / YouTube / GitHub Issues extractors (schema-ready, not prioritized)
- Docker packaging
- Rate limiting / auth (local-only assumption holds)
