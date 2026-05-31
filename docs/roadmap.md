# Little Imp Roadmap

Version: draft-v5
Status: Release alignment for `0.1.0-beta`
Author: Robert Goniszewski
Date: May 2026

## Current State

Little Imp is in final `0.1.0-beta` release closeout. The core local-first product is implemented: save, extract, organize, search, review, back up, restore, diagnose local issues, and run locally through the native daemon, Docker, release archive, one-command installer, or Homebrew alternate path.

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
- In-app local backup verification from Settings without restoring the snapshot.
- Optional encrypted backup packages through the `littleimp` CLI and Settings.
- Manual Settings, daemon API, and packaged `littleimp update check` paths for GitHub Releases-compatible update availability checks.
- Explicit packaged `littleimp update install` native upgrade flow with archive download, local archive support, checksum/signature verification, daemon restart, health version verification, and rollback guidance.
- Signed release archive packaging for macOS and Linux with built frontend assets, daemon runtime files, checksums, and signature-ready manifests.
- One-command release installer that downloads the platform archive, verifies the published checksum, verifies detached signatures when present, and delegates to the native installer.
- In-repository Homebrew formula for an alternate MVP install path backed by checksum-verified release archives and `brew services`.
- Redacted diagnostics from Settings, `littleimp diagnostics`, and `GET /diagnostics` for local support bundles without telemetry.
- Local and CI quality gates for linting, type-checks, daemon tests, frontend tests, API docs drift checks, production build, Playwright E2E, and Docker health validation.

## Release Closeout Gates

The product surface is implemented for `0.1.0-beta`. TASK-075 through TASK-077
and TASK-080 through TASK-084 now have release-closeout evidence, but the
public build is not ready for promotion until the remaining TASK-078 and
TASK-079 release-control blockers are completed or explicitly deferred. The
release-closeout queue covers final metadata freeze, signed artifact
publication, fresh-host installer evidence, public install and upgrade checks,
publication-gated Homebrew validation, first-user UX smoke testing,
public-artifact installed-app E2E, final localhost security regression, release
notes, and the go/no-go decision package.

These checks are complete for the current beta validation state:

- `npm run check`, including lint, type-checks, unit tests, daemon tests, API docs drift check, and production build.
- `npm run test:e2e`.
- Docker Compose startup, loopback-only port publishing, container health, and named-volume preservation after shutdown.
- macOS native installer install, upgrade, health, uninstall, and purge smoke in an isolated temporary home.
- Linux systemd-user installer install, upgrade, health, service enablement, user-manager restart autostart, uninstall, and purge smoke in an Ubuntu 24.04 Docker environment with systemd running as PID 1.
- Installer matrix validation names macOS 12+ arm64, macOS 12+ x64, Ubuntu 24.04 LTS, and Debian 12 as the MVP targets, with Ubuntu and Debian packaged archive smokes passing in systemd-user containers.
- Documentation release-target and local markdown link audits, including the
  TASK-075 release-candidate freeze pass.
- GitHub Actions `Quality Gates` for lint/types/tests/docs/build, Playwright E2E, and Docker build/health.
- TASK-076 signed release artifact publication: macOS and Linux archives,
  checksum files, detached GPG signatures, and `release-manifest.json` are
  attached to the `v0.1.0-beta` GitHub prerelease.
- TASK-084 release decision package: `docs/release-decision-v0.1.0-beta.md`
  records the release identity, artifact inventory, validation evidence,
  explicit skipped checks, accepted MVP limitations, and a no-go decision for
  public promotion while public artifact URLs still return `HTTP 404`.

No product-scope blockers remain in this workspace. The remaining
release-control blockers are TASK-078 public install/update validation and
TASK-079 live Homebrew validation. TASK-080 is complete after a May 31, 2026
real fresh-data first-user UX smoke pass against an isolated daemon and a
loopback-only frontend API override. Public one-command installer, Homebrew,
and public-artifact E2E checks remain gated while the GitHub repository is
private because unauthenticated release and raw tag URLs return `404`. macOS
12+ x64 remains a manual pre-publish validation target because this workspace
has no Intel Mac or x64 macOS VM.

## Post-MVP Release Operations

After `0.1.0-beta` passes the public-promotion gates and the remaining
release-closeout blockers are completed or explicitly deferred, the next
release-operations pass should focus on polish that is not required for the MVP
public build:

- Broader update polish beyond the current explicit manual packaged upgrade flow, based on the design in [docs/update-system.md](./update-system.md).
- Resolve the non-blocking post-MVP audit items tracked by TASK-072.

## Grimoire Parity Scope

The current Grimoire parity batch is a local-first Little Imp compatibility
pass, not a full Grimoire server-mode clone. The batch is locked as
local-first, single-user, loopback-first, and local-integrations-only.

In scope:

- local integration security boundaries, token auth, origin policy, API
  examples, and OpenAPI-compatible output;
- bookmark read-later state, open metrics, richer detail metadata/content, and
  regression coverage for supported bookmark mutations;
- category and tag navigation, management, detail pages, metadata, and
  regression coverage;
- browser/Netscape import review, folder preservation, duplicate handling,
  remapping, result reports, export parity fields, and import/export
  regression tests;
- explicit library pagination, server-driven sorting, approved filters, saved
  view preferences, aggregate counts, and large-library verification.

Intentional non-goals for this batch:

- multi-user accounts, signup, login, sessions, admin roles, account profiles,
  and per-user backup scoping;
- public-server or non-loopback deployment mode;
- Grimoire-compatible endpoint aliases or adapter routes;
- browser-extension/bookmarklet one-click capture and extension smoke tests;
- bookmark importance ratings;
- direct Grimoire/PocketBase backup import tooling.

Future reconsideration requires a new product decision rather than treating the
non-goal as unfinished parity work. Public-network or multi-user modes need
their own threat model, auth/session model, data-scoping design, backup
implications, diagnostics posture, and release gates before implementation.

## Future Ideas

These are not part of `0.1.0-beta`:

- Browser extension or bookmarklet for one-click saves, after local
  integration auth and origin policy are stable.
- Multi-device sync of live data.
- Multi-user or public-network deployment mode, tracked as post-MVP direction
  research in [docs/multi-user-post-mvp-research.md](./multi-user-post-mvp-research.md).
- Optional authentication/rate limiting for non-local deployments.
- Direct Grimoire/PocketBase backup import tooling after browser/Netscape
  import and JSON/CSV export parity are stable.
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
| Verify local backups without restoring | Shipped |
| Create encrypted backup packages in Settings | Shipped |
| Verify or restore encrypted backup packages | Shipped from Settings for packages under the configured backup folder; shipped from CLI for arbitrary local paths |
| Run through Docker on localhost | Shipped |
| Connect through MCP on localhost | Shipped |
| Install without cloning the repository | Shipped through release archives and the one-command release installer |
| Install through Homebrew | Alternate MVP path implemented; full install validation is gated on publicly reachable release artifacts |
| Generate local diagnostics | Shipped |
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
| 15 | Grimoire parity mode | The current parity batch is local-first, single-user, loopback-first, and local-integrations-only. Multi-user/server mode, endpoint aliases, and browser-extension/bookmarklet capture are deferred or rejected as documented in the parity report. |
