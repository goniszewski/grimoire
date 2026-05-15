# Little Imp Roadmap

Version: draft-v5
Status: Release alignment for `0.1.0-beta`
Author: Robert Goniszewski
Date: May 2026

## Current State

Little Imp is in `0.1.0-beta` release hardening. The core local-first product is implemented: save, extract, organize, search, review, back up, restore, and run locally through the native daemon or Docker.

Shipped product areas:

- Bookmark ingestion, content extraction, PDF extraction, YouTube transcript extraction, and asynchronous pipeline status.
- SQLite storage with keyword search, semantic search, hybrid search, tags, category CRUD, and category drag-and-drop reparenting.
- Bookmark status actions: pin, archive, mark read, soft delete to Trash, restore from Trash, permanent delete, and 30-day trash purge.
- Personal notes, editable bookmark details, first-run empty state, daemon-offline banner, and degraded-mode messaging when AI or embeddings are not configured.
- AI enrichment, embedding generation, related bookmarks, organization agent suggestions, atomic suggestion acceptance, timeline events, and cold-start guard below 20 bookmarks.
- Settings page for AI, embeddings, runtime settings, app lock, backup destination, scheduled snapshots, and S3-compatible backup targets.
- Portable backup/restore snapshots with `manifest.json`, `checksums.sha256`, `snapshot.db`, non-secret `data/settings.json`, rollback directory creation, and `restart_required: true` restore responses.
- Native install/upgrade/uninstall script for macOS LaunchAgent and Linux systemd user units.
- Docker deployment path with one loopback-bound container port (`127.0.0.1:3210:3210`) serving both frontend and daemon API.
- Streamable HTTP MCP endpoint at `/mcp` for bookmark search, reading, creation, and category listing.
- Source-of-truth API contract in `daemon/src/api/contract.ts`, generated `API.md`, generated `docs/api-contract.json`, and API docs drift checking.
- Packaged `littleimp` backup CLI commands for create, list, restore, and local snapshot verification.
- Local and CI quality gates for linting, type-checks, daemon tests, frontend tests, API docs drift checks, production build, Playwright E2E, and Docker health validation.

## Release Blockers

These checks are complete for the current beta validation state:

- `npm run check`, including lint, type-checks, unit tests, daemon tests, API docs drift check, and production build.
- `npm run test:e2e`.
- Docker Compose startup, loopback-only port publishing, container health, and named-volume preservation after shutdown.
- macOS native installer install, upgrade, health, uninstall, and purge smoke in an isolated temporary home.
- Linux systemd-user installer install, upgrade, health, service enablement, user-manager restart autostart, uninstall, and purge smoke in an Ubuntu 24.04 Docker environment with systemd running as PID 1.
- Documentation release-target and local markdown link audits.
- GitHub Actions `Quality Gates` for lint/types/tests/docs/build, Playwright E2E, and Docker build/health.

No scoped `0.1.0-beta` release-checklist blockers remain in this workspace. Broader Linux host/VM distro matrix coverage remains future release hardening.

## Next Release

The next release should focus on reducing installation friction and improving confidence around backup and operations:

- Distribution polish: Homebrew formula or signed release archive.
- One-command installer entry point after release artifact signing and checksum publication are settled.
- In-app backup verification UX that can validate a snapshot without restoring it.
- Optional encrypted backup package format built around the current portable snapshot directory.
- Better update flow based on the design in [docs/update-system.md](./update-system.md).
- More complete installer matrix coverage for supported macOS and Linux versions on separate hosts or VMs.

## Future Ideas

These are not part of `0.1.0-beta`:

- Browser extension for one-click saves.
- Multi-device sync of live data.
- Multi-user or public-network deployment mode.
- Optional authentication/rate limiting for non-local deployments.
- Plugin system.
- GitHub Issues extractor.
- Provider-specific consumer cloud APIs for Google Drive, Dropbox, OneDrive, or iCloud beyond normal synced folders.
- sqlite-vec-backed vector index optimization if the current float32 BLOB approach becomes a bottleneck.

## User Journey Coverage

| Journey | Status |
|---|---|
| Save a URL | Shipped |
| Search saved content by keyword | Shipped |
| Search saved content semantically or with hybrid ranking | Shipped |
| Add and edit personal notes | Shipped |
| Edit title, tags, category, and notes | Shipped |
| Pin important bookmarks | Shipped |
| Archive and unarchive bookmarks | Shipped |
| Move bookmarks to Trash, restore, and permanently delete | Shipped |
| Mark bookmarks as read or unread | Shipped |
| Create, rename, delete, and reparent categories | Shipped |
| Configure AI and embedding providers | Shipped |
| Understand degraded mode when AI or embeddings are unset | Shipped |
| Import browser bookmarks | Shipped |
| Export bookmarks to JSON or CSV | Shipped |
| Review and accept/reject AI suggestions | Shipped |
| Find related bookmarks | Shipped |
| Back up and restore local data | Shipped, with daemon restart required after restore |
| Run through Docker on localhost | Shipped |
| Connect through MCP on localhost | Shipped |
| Install without cloning the repository | Future |
| Sync live data across devices | Future |

## Milestone Summary

| Milestone | Status | Notes |
|---|---|---|
| M1 Core user journeys | Complete | Bookmark status actions, notes, Trash, archive, category CRUD, drag-and-drop reparenting. |
| M2 Settings UI | Complete | AI, embeddings, runtime settings, app lock, and backup configuration. |
| M3 AI features | Complete | Embeddings, semantic/hybrid search, related bookmarks, organization agent, review queue. |
| M4 Testing infrastructure | Complete | Daemon/unit integration tests, frontend tests, Playwright E2E, API contract drift checks, CI. |
| M5 Distribution readiness | Complete for beta | Native installer, Docker path, first-run/degraded states, backup/restore, and release checklist validation are complete for the beta release. |
| v0-beta hardening | Complete for beta | Runtime settings, Docker safety, CI, safe backup/restore, API docs source of truth, shared API types, documentation alignment, and release validation are represented by TASK-041 through TASK-048. |

## Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Archive vs delete UX | Archive is hidden permanently with no expiry and its own page. Trash is a separate 30-day soft-delete state with restore and permanent delete. |
| 2 | Notes rendering | Markdown read mode with textarea edit mode. |
| 3 | Pinned bookmark display | Pinned bookmarks sort first within the active view. |
| 4 | Settings surface | Dedicated `/settings` page. |
| 5 | Category move UI | Drag-and-drop reparenting is primary; "Move to..." remains the fallback/mobile path. |
| 6 | Test framework | Bun test runner for daemon; Vitest and Playwright for frontend. |
| 7 | Suggestion acceptance | Suggestion action, acceptance status, and timeline insert happen in one SQLite transaction. |
| 8 | Auto-apply behavior | Confidence `>= 0.9` executes directly and records timeline; lower confidence queues for review. |
| 9 | Cold-start behavior | Under 20 bookmarks, organization automation is limited; keyword search still works and semantic search works where embeddings exist. |
| 10 | Vector storage | Embeddings are stored as float32 BLOBs in SQLite; sqlite-vec remains a future optimization. |
| 11 | Backup model | Backup is snapshot-based, not live sync. Restore recreates local state from a portable snapshot and requires daemon restart. |
| 12 | Cloud backup scope | S3-compatible storage is the first remote target. Cloud-synced folders are supported as local destinations. |
| 13 | Docker network model | Docker binds the host port to `127.0.0.1`; container-internal `HOST=0.0.0.0` only enables Docker forwarding. |
| 14 | API documentation | `daemon/src/api/contract.ts` is the source of truth; `API.md` and `docs/api-contract.json` are generated artifacts. |
