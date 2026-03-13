# Little Imp — Task Board

## Directory Structure

```
tasks/
  backlog/      — tasks not yet started
  todo/         — prioritized for current cycle
  in-progress/  — actively being worked on
  in-review/    — implementation complete, under review
  done/         — completed tasks
```

## Task Index

| ID | Title | Phase | Priority | Status |
|----|-------|-------|----------|--------|
| TASK-001 | [littleimpd Daemon Setup](done/TASK-001-daemon-setup.md) | v0-alpha | high | done |
| TASK-002 | [SQLite Database Schema](done/TASK-002-sqlite-schema.md) | v0-alpha | high | done |
| TASK-003 | [Bookmark Ingestion API](done/TASK-003-bookmark-ingestion-api.md) | v0-alpha | high | done |
| TASK-004 | [Content Extraction Pipeline](done/TASK-004-content-extraction-pipeline.md) | v0-alpha | high | done |
| TASK-005 | [Keyword Search (FTS5)](done/TASK-005-keyword-search.md) | v0-alpha | high | done |
| TASK-006 | [HTML Bookmark Import](done/TASK-006-html-bookmark-import.md) | v0-alpha | high | done |
| TASK-007 | [LLM Enrichment](done/TASK-007-llm-enrichment.md) | v0-beta | medium | done |
| TASK-008 | [Embeddings & Semantic Search](done/TASK-008-embeddings-semantic-search.md) | v0-beta | medium | done |
| TASK-009 | [Categories & Tags API](done/TASK-009-categories-tags-api.md) | v0-alpha | medium | done |
| TASK-010 | [Export API (JSON & CSV)](done/TASK-010-export-api.md) | v0-alpha | low | done |
| TASK-011 | [Autonomous Organization Agent](done/TASK-011-autonomous-organization-agent.md) | v0.2 | low | done |
| TASK-012 | [Library Evolution Timeline](done/TASK-012-library-timeline.md) | v0.2 | low | done |
| TASK-013 | [Preferences / Settings API](done/TASK-013-preferences-api.md) | v0-beta | medium | done |
| TASK-014 | [Frontend API Integration](done/TASK-014-frontend-api-integration.md) | v0-alpha | high | done |
| TASK-015 | [Domains Page — Real Data](done/TASK-015-domains-page.md) | v0-alpha | low | done |
| TASK-016 | [Review Queue UI](done/TASK-016-review-queue-ui.md) | v0.2 | low | done |
| TASK-017 | [AI Palette Integration](done/TASK-017-ai-palette-integration.md) | v0-beta | medium | done |
| TASK-018 | [Shell Installer Script](done/TASK-018-installer-script.md) | v0-alpha | medium | done |
| TASK-019 | [PDF Extractor](done/TASK-019-pdf-extractor.md) | future | low | done |
| TASK-020 | [YouTube Transcript Extractor](done/TASK-020-youtube-transcript-extractor.md) | future | low | done |
| TASK-021 | [Bookmark Status Actions (Pin, Archive, Read)](backlog/TASK-021-bookmark-status-actions.md) | M1 | high | backlog |
| TASK-022 | [Trash System (Soft Delete + 30-day Purge)](backlog/TASK-022-trash-system.md) | M1 | high | backlog |
| TASK-023 | [Personal Notes on Bookmarks](backlog/TASK-023-personal-notes.md) | M1 | high | backlog |
| TASK-024 | [Category Management UI (Rename, Delete, Move)](backlog/TASK-024-category-management-ui.md) | M1 | high | backlog |
| TASK-025 | [Settings Page (/settings)](backlog/TASK-025-settings-page.md) | M2 | high | backlog |
| TASK-026 | [Embeddings Pipeline Integration](backlog/TASK-026-embeddings-pipeline.md) | M3 | medium | backlog |
| TASK-027 | [Semantic & Hybrid Search](backlog/TASK-027-semantic-hybrid-search.md) | M3 | medium | backlog |
| TASK-028 | [Organization Agent — Full Wiring](backlog/TASK-028-organization-agent-wiring.md) | M3 | medium | backlog |
| TASK-029 | [Daemon Unit Tests](backlog/TASK-029-daemon-unit-tests.md) | M4 | medium | backlog |
| TASK-030 | [Daemon Integration Tests](backlog/TASK-030-daemon-integration-tests.md) | M4 | medium | backlog |
| TASK-031 | [Frontend Tests](backlog/TASK-031-frontend-tests.md) | M4 | medium | backlog |
| TASK-032 | [Distribution Readiness](backlog/TASK-032-distribution-readiness.md) | M5 | low | backlog |

## Current Status

All v0-alpha and v0-beta tasks are complete. Active work is on the roadmap milestones M1–M5.
See [docs/roadmap.md](../docs/roadmap.md) for full milestone details.

## M1 Implementation Order (start here)

1. TASK-022 — Trash system (schema migration first)
2. TASK-021 — Pin / archive / read status actions
3. TASK-023 — Personal notes (second migration)
4. TASK-024 — Category management UI
