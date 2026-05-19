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
| TASK-047 | [Align Roadmap, Release, and Product Documentation](done/TASK-047-align-roadmap-release-docs.md) | v0-beta hardening | medium | done |
| TASK-048 | [Release Validation and Docker Restore Hardening](done/TASK-048-release-validation.md) | v0-beta release validation | high | done |
| TASK-049 | [Packaged Backup CLI Commands](done/TASK-049-packaged-backup-cli.md) | next release operations | medium | done |
| TASK-050 | [In-App Backup Verification UX](done/TASK-050-in-app-backup-verification.md) | next release operations | medium | done |
| TASK-051 | [Encrypted Backup Packages](done/TASK-051-encrypted-backup-packages.md) | next release operations | medium | done |
| TASK-052 | [Multi-Provider AI Support](done/TASK-052-multi-provider-ai-support.md) | next release AI integrations | medium | done |
| TASK-053 | [Native Installer Frontend Bundle Install](done/TASK-053-native-installer-frontend-bundle.md) | next release distribution polish | medium | done |
| TASK-054 | [CLI Update Check Foundation](done/TASK-054-cli-update-check.md) | next release distribution polish | medium | done |
| TASK-055 | [Daemon Update Check Service](done/TASK-055-daemon-update-check-service.md) | next release distribution polish | medium | done |

## Current Status

Core product tasks, v0-beta hardening tasks, release validation work, the first
three next-release operations tasks, TASK-052 multi-provider AI support,
TASK-053 native installer frontend bundle install, TASK-054 CLI update check
foundation, and TASK-055 daemon update check service available from this macOS
workspace are complete.

Completed release validation evidence:

1. `npm run check` passed locally.
2. `npm run test:e2e` passed locally.
3. Docker Compose build/start/health validation passed with the host port bound to `127.0.0.1:3210:3210`.
4. `docker compose down` preserved the named data volume.
5. Native macOS install/health/upgrade/uninstall/purge smoke passed in an isolated temporary home.
6. Release-target and local markdown link audits passed.
7. GitHub Actions `Quality Gates` passed for the current release-validation commit, including lint/types/tests/docs/build, Playwright E2E, and Docker build/health.
8. Linux systemd user installer smoke passed in an Ubuntu 24.04 Docker environment with systemd running as PID 1 and a non-root `systemctl --user` manager.

Notes:

- TASK-029 is not present as a task file; daemon test coverage is represented by TASK-030 and TASK-035.
- TASK-047 was the final consistency pass after the implementation-facing hardening tasks landed.
- TASK-048 completed the release checklist paths available in this workspace, including a containerized Ubuntu systemd-user smoke for the Linux installer path.

See [docs/roadmap.md](../docs/roadmap.md) for full milestone details.
