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
| TASK-001 | [littleimpd Daemon Setup](backlog/TASK-001-daemon-setup.md) | v0-alpha | high | backlog |
| TASK-002 | [SQLite Database Schema](backlog/TASK-002-sqlite-schema.md) | v0-alpha | high | backlog |
| TASK-003 | [Bookmark Ingestion API](backlog/TASK-003-bookmark-ingestion-api.md) | v0-alpha | high | backlog |
| TASK-004 | [Content Extraction Pipeline](backlog/TASK-004-content-extraction-pipeline.md) | v0-alpha | high | backlog |
| TASK-005 | [Keyword Search (FTS5)](backlog/TASK-005-keyword-search.md) | v0-alpha | high | backlog |
| TASK-006 | [HTML Bookmark Import](backlog/TASK-006-html-bookmark-import.md) | v0-alpha | high | backlog |
| TASK-007 | [LLM Enrichment](backlog/TASK-007-llm-enrichment.md) | v0-beta | medium | backlog |
| TASK-008 | [Embeddings & Semantic Search](backlog/TASK-008-embeddings-semantic-search.md) | v0-beta | medium | backlog |
| TASK-009 | [Categories & Tags API](backlog/TASK-009-categories-tags-api.md) | v0-alpha | medium | backlog |
| TASK-010 | [Export API (JSON & CSV)](backlog/TASK-010-export-api.md) | v0-alpha | low | backlog |
| TASK-011 | [Autonomous Organization Agent](backlog/TASK-011-autonomous-organization-agent.md) | v0.2 | low | backlog |
| TASK-012 | [Library Evolution Timeline](backlog/TASK-012-library-timeline.md) | v0.2 | low | backlog |
| TASK-013 | [Preferences / Settings API](backlog/TASK-013-preferences-api.md) | v0-beta | medium | backlog |
| TASK-014 | [Frontend API Integration](backlog/TASK-014-frontend-api-integration.md) | v0-alpha | high | backlog |
| TASK-015 | [Domains Page — Real Data](backlog/TASK-015-domains-page.md) | v0-alpha | low | backlog |
| TASK-016 | [Review Queue UI](backlog/TASK-016-review-queue-ui.md) | v0.2 | low | backlog |
| TASK-017 | [AI Palette Integration](backlog/TASK-017-ai-palette-integration.md) | v0-beta | medium | backlog |
| TASK-018 | [Shell Installer Script](backlog/TASK-018-installer-script.md) | v0-alpha | medium | backlog |
| TASK-019 | [PDF Extractor](backlog/TASK-019-pdf-extractor.md) | future | low | backlog |
| TASK-020 | [YouTube Transcript Extractor](backlog/TASK-020-youtube-transcript-extractor.md) | future | low | backlog |

## Current Frontend Status

The frontend (`src/`) is a **mocked React SPA** with:
- Full UI components built (search, bookmarks, sidebar, dialogs)
- Mock data in `src/data/mock-bookmarks.ts`
- Mock state in `src/hooks/use-bookmark-store.ts`
- No real backend connection yet

## Suggested Implementation Order (v0-alpha)

1. TASK-001 — Daemon (foundation)
2. TASK-002 — Schema (data layer)
3. TASK-003 — Ingestion API (core CRUD)
4. TASK-009 — Categories & Tags API
5. TASK-004 — Extraction Pipeline
6. TASK-005 — Keyword Search
7. TASK-006 — Import
8. TASK-010 — Export
9. TASK-014 — Wire frontend to API
10. TASK-018 — Installer
