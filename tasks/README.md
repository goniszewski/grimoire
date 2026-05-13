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
| TASK-021 | [Bookmark Status Actions (Pin, Archive, Read)](done/TASK-021-bookmark-status-actions.md) | M1 | high | done |
| TASK-022 | [Trash System (Soft Delete + 30-day Purge)](done/TASK-022-trash-system.md) | M1 | high | done |
| TASK-023 | [Personal Notes on Bookmarks](done/TASK-023-personal-notes.md) | M1 | high | done |
| TASK-024 | [Category Management UI (Rename, Delete, Move)](done/TASK-024-category-management-ui.md) | M1 | high | done |
| TASK-025 | [Settings Page (/settings)](done/TASK-025-settings-page.md) | M2 | high | done |
| TASK-026 | [Embeddings Pipeline Integration](done/TASK-026-embeddings-pipeline.md) | M3 | medium | done |
| TASK-027 | [Semantic & Hybrid Search](done/TASK-027-semantic-hybrid-search.md) | M3 | medium | done |
| TASK-028 | [Organization Agent — Full Wiring](done/TASK-028-organization-agent-wiring.md) | M3 | medium | done |
| TASK-030 | [Daemon Integration Tests](done/TASK-030-daemon-integration-tests.md) | M4 | medium | done |
| TASK-031 | [Frontend Tests](done/TASK-031-frontend-tests.md) | M4 | medium | done |
| TASK-032 | [Distribution Readiness](done/TASK-032-distribution-readiness.md) | M5 | low | done |
| TASK-033 | [Backup & Restore](done/TASK-033-backup-restore.md) | M5 | medium | done |
| TASK-034 | [Category Drag-and-Drop Reparenting](done/TASK-034-category-drag-drop.md) | M1 | medium | done |
| TASK-035 | [Pipeline Stage Unit Tests](done/TASK-035-pipeline-unit-tests.md) | M4 | medium | done |
| TASK-036 | [First-Run Experience](done/TASK-036-first-run-experience.md) | M5 | medium | done |
| TASK-037 | [Remote Backup S3](done/TASK-037-remote-backup-s3.md) | M5 | medium | done |
| TASK-038 | [Scheduled Backup Snapshots](done/TASK-038-scheduled-snapshots.md) | M5 | medium | done |
| TASK-039 | [Custom Backup Destination](done/TASK-039-custom-backup-destination.md) | M5 | medium | done |
| TASK-040 | [MCP Server Integration](done/TASK-040-mcp-server.md) | v1.0 | medium | done |
| TASK-041 | [Unify Runtime Settings with AI and Embedding Execution](done/TASK-041-unify-runtime-settings.md) | v0-beta hardening | high | done |
| TASK-042 | [Fix Docker Distribution and Network Safety](done/TASK-042-fix-docker-distribution-network-safety.md) | v0-beta hardening | high | done |
| TASK-043 | [Restore Quality Gates and Add CI](done/TASK-043-restore-quality-gates-and-ci.md) | v0-beta hardening | high | done |
| TASK-044 | [Make Backup and Restore Safe and Match the Design](done/TASK-044-safe-backup-restore.md) | v0-beta hardening | high | done |
| TASK-045 | [Create a Source-of-Truth API Contract and Regenerated Docs](done/TASK-045-api-docs-source-of-truth.md) | v0-beta hardening | medium | done |
| TASK-046 | [Adopt the Shared API Contract in the Frontend](done/TASK-046-share-api-types-between-daemon-and-frontend.md) | v0-beta hardening | medium | done |
| TASK-047 | [Align Roadmap, Release, and Product Documentation](todo/TASK-047-align-roadmap-release-docs.md) | v0-beta hardening | medium | todo |

## Current Status

Core product tasks are mostly complete, but the latest project review identified v0-beta hardening work before release confidence. TASK-041, TASK-042, TASK-043, TASK-044, TASK-045, and TASK-046 are complete. The remaining recommended implementation order is based on dependency and release risk:

1. TASK-047 - Align roadmap, release, and product documentation

Notes:

- TASK-029 is not present as a task file; daemon test coverage is represented by TASK-030 and TASK-035.
- TASK-047 should be the final consistency pass after the implementation-facing hardening tasks land.

See [docs/roadmap.md](../docs/roadmap.md) for full milestone details.
