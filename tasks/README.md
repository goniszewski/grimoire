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
| TASK-056 | [In-App Update Check](done/TASK-056-in-app-update-check.md) | next release distribution polish | medium | done |
| TASK-057 | [In-App Encrypted Backup Packages](done/TASK-057-in-app-encrypted-backup-packages.md) | next release operations | medium | done |
| TASK-058 | [MVP Evidence and Acceptance Criteria Audit](done/TASK-058-mvp-evidence-acceptance-audit.md) | MVP readiness | high | done |
| TASK-059 | [Signed Release Archive Packaging](done/TASK-059-signed-release-archive-packaging.md) | MVP readiness | high | done |
| TASK-060 | [One-Command Installer Entry Point](done/TASK-060-one-command-installer-entrypoint.md) | MVP readiness | high | done |
| TASK-061 | [Packaged Upgrade Flow](done/TASK-061-packaged-upgrade-flow.md) | MVP readiness | high | done |
| TASK-062 | [Installer Matrix Validation](done/TASK-062-installer-matrix-validation.md) | MVP readiness | high | done |
| TASK-063 | [Homebrew Formula or Tap](done/TASK-063-homebrew-formula-or-tap.md) | MVP readiness | medium | done |
| TASK-064 | [Library Reprocess and Re-Embed Jobs](done/TASK-064-library-reprocess-reembed-jobs.md) | MVP readiness | high | done |
| TASK-065 | [Pipeline Failure Recovery UX](done/TASK-065-pipeline-failure-recovery-ux.md) | MVP readiness | high | done |
| TASK-066 | [In-App Encrypted Backup Verify and Restore](done/TASK-066-in-app-encrypted-backup-verify-restore.md) | MVP readiness | medium | done |
| TASK-067 | [Post-Restore Restart and Recovery UX](done/TASK-067-post-restore-restart-recovery-ux.md) | MVP readiness | medium | done |
| TASK-068 | [Diagnostics and Support Bundle](done/TASK-068-diagnostics-support-bundle.md) | MVP readiness | medium | done |
| TASK-069 | [Production Security Headers and Local Hardening](done/TASK-069-production-security-headers-local-hardening.md) | MVP readiness | medium | done |
| TASK-070 | [Installed-App E2E Smoke Suite](done/TASK-070-installed-app-e2e-smoke-suite.md) | MVP readiness | high | done |
| TASK-071 | [MVP Release Documentation Pass](done/TASK-071-mvp-release-documentation-pass.md) | MVP readiness | high | done |
| TASK-072 | [Audit Follow-Up Gaps](done/TASK-072-audit-follow-up-gaps.md) | post-MVP polish | low | done |
| TASK-073 | [Project Status Review Package](done/TASK-073-project-status-review-package.md) | MVP readiness | medium | done |
| TASK-074 | [Two-Week Engineering Presentation](done/TASK-074-two-week-engineering-presentation.md) | post-MVP polish | low | done |
| TASK-075 | [Release Candidate Freeze and Version Audit](done/TASK-075-release-candidate-freeze-version-audit.md) | MVP release closeout | high | done |
| TASK-076 | [Signed Release Artifact Publication](done/TASK-076-signed-release-artifact-publication.md) | MVP release closeout | high | done |
| TASK-077 | [Fresh-Host Installer Matrix Evidence](done/TASK-077-fresh-host-installer-matrix-evidence.md) | MVP release closeout | high | done |
| TASK-078 | [Published One-Command and CLI Upgrade Validation](in-progress/TASK-078-published-one-command-cli-upgrade-validation.md) | MVP release closeout | high | in-progress |
| TASK-079 | [Homebrew Tap Publication and Live Install Validation](in-progress/TASK-079-homebrew-tap-publication-live-install-validation.md) | MVP release closeout | medium | in-progress |
| TASK-080 | [MVP First-User UX Smoke Pass](done/TASK-080-mvp-first-user-ux-smoke-pass.md) | MVP release closeout | medium | done |
| TASK-081 | [Public Artifact Installed-App E2E](done/TASK-081-public-artifact-installed-app-e2e.md) | MVP release closeout | high | done |
| TASK-082 | [Final Localhost Security Regression Pass](done/TASK-082-final-localhost-security-regression-pass.md) | MVP release closeout | high | done |
| TASK-083 | [Release Notes and Support Readiness](done/TASK-083-release-notes-support-readiness.md) | MVP release closeout | medium | done |
| TASK-084 | [MVP Release Decision Package](done/TASK-084-mvp-release-decision-package.md) | MVP release closeout | medium | done |
| TASK-085 | [Grimoire Parity Scope And Non-Goals](done/TASK-085-grimoire-parity-scope-and-non-goals.md) | Grimoire parity | critical | done |
| TASK-086 | [Parity Task Conversion Criteria And Labels](done/TASK-086-parity-task-conversion-criteria-labels.md) | Grimoire parity | high | done |
| TASK-087 | [Daemon Network Exposure Security Boundaries](done/TASK-087-daemon-network-exposure-security-boundaries.md) | Grimoire parity | critical | done |
| TASK-088 | [Recurring Parity Release Checklist](done/TASK-088-recurring-parity-release-checklist.md) | Grimoire parity | medium | done |
| TASK-089 | [Read Later Bookmark Flag](done/TASK-089-read-later-bookmark-flag.md) | Grimoire parity | high | done |
| TASK-090 | [Bookmark Importance Rating (Rejected)](backlog/TASK-090-bookmark-importance-rating.md) | Grimoire parity | medium | rejected |
| TASK-091 | [Bookmark Open Metrics](done/TASK-091-bookmark-open-metrics.md) | Grimoire parity | medium | done |
| TASK-092 | [Bookmark Detail Metadata And Content Sections](done/TASK-092-bookmark-detail-metadata-content.md) | Grimoire parity | high | done |
| TASK-093 | [Bookmark Media Handling And Preview](done/TASK-093-bookmark-media-handling-preview.md) | Grimoire parity | medium | done |
| TASK-094 | [Bookmark Mutation And Detail Regression Tests](done/TASK-094-bookmark-mutation-detail-regression-tests.md) | Grimoire parity | high | done |
| TASK-095 | [Sidebar Categories From Full Tree](done/TASK-095-sidebar-categories-full-tree.md) | Grimoire parity | high | done |
| TASK-096 | [Category Detail Page](done/TASK-096-category-detail-page.md) | Grimoire parity | medium | done |
| TASK-097 | [Category Metadata Fields](in-review/TASK-097-category-metadata-fields.md) | Grimoire parity | medium | in-review |
| TASK-098 | [Tag Management Surface](in-review/TASK-098-tag-management-surface.md) | Grimoire parity | high | in-review |
| TASK-099 | [Tag Detail Pages](done/TASK-099-tag-detail-pages.md) | Grimoire parity | medium | done |
| TASK-100 | [Tag Rename API And UI](done/TASK-100-tag-rename-api-ui.md) | Grimoire parity | medium | done |
| TASK-101 | [Category And Tag Regression Tests](done/TASK-101-category-tag-regression-tests.md) | Grimoire parity | high | done |
| TASK-102 | [Integration Token Authentication](done/TASK-102-integration-token-authentication.md) | Grimoire parity | critical | done |
| TASK-103 | [Human Readable API Examples](done/TASK-103-human-readable-api-examples.md) | Grimoire parity | high | done |
| TASK-104 | [OpenAPI Contract Output](backlog/TASK-104-openapi-contract-output.md) | Grimoire parity | high | backlog |
| TASK-105 | [One Click Capture Endpoint (Deferred)](backlog/TASK-105-one-click-capture-endpoint.md) | Grimoire parity | high | deferred |
| TASK-106 | [Integration CORS And Origin Controls](backlog/TASK-106-integration-cors-origin-controls.md) | Grimoire parity | high | backlog |
| TASK-107 | [Preserve Import Folder Hierarchy](backlog/TASK-107-preserve-import-folder-hierarchy.md) | Grimoire parity | high | backlog |
| TASK-108 | [Pre Import Review](backlog/TASK-108-pre-import-review.md) | Grimoire parity | high | backlog |
| TASK-109 | [Import Category And Tag Remapping](backlog/TASK-109-import-category-tag-remapping.md) | Grimoire parity | medium | backlog |
| TASK-110 | [Import Result Report](backlog/TASK-110-import-result-report.md) | Grimoire parity | medium | backlog |
| TASK-111 | [Export Parity Fields](backlog/TASK-111-export-parity-fields.md) | Grimoire parity | medium | backlog |
| TASK-112 | [Future Grimoire Backup Import](backlog/TASK-112-future-grimoire-backup-import.md) | Grimoire parity | low | deferred |
| TASK-113 | [Import Export Regression Tests](backlog/TASK-113-import-export-regression-tests.md) | Grimoire parity | high | backlog |
| TASK-114 | [Library Pagination](backlog/TASK-114-library-pagination.md) | Grimoire parity | high | backlog |
| TASK-115 | [Server Driven Sorting](backlog/TASK-115-server-driven-sorting.md) | Grimoire parity | medium | backlog |
| TASK-116 | [Library Parity Filters](backlog/TASK-116-library-parity-filters.md) | Grimoire parity | high | backlog |
| TASK-117 | [Persist Library View Preferences](backlog/TASK-117-persist-library-view-preferences.md) | Grimoire parity | medium | backlog |
| TASK-118 | [Aggregate Count Endpoints](backlog/TASK-118-aggregate-count-endpoints.md) | Grimoire parity | medium | backlog |
| TASK-119 | [Large Library Performance Tests](backlog/TASK-119-large-library-performance-tests.md) | Grimoire parity | medium | backlog |
| TASK-120 | [Import Duplicate Handling Policy](backlog/TASK-120-import-duplicate-handling-policy.md) | Grimoire parity | high | backlog |

## Current Status

Core product tasks, v0-beta hardening tasks, release validation work, the first
three next-release operations tasks, TASK-052 multi-provider AI support,
TASK-053 native installer frontend bundle install, TASK-054 CLI update check
foundation, TASK-055 daemon update check service, TASK-056 in-app update check,
TASK-057 in-app encrypted backup package work, TASK-058 MVP evidence and
acceptance criteria audit, TASK-059 signed release archive packaging work, and
TASK-060 one-command installer entry point work available from this macOS
workspace are complete.

TASK-061 packaged upgrade support, TASK-062 installer matrix validation,
TASK-063 Homebrew alternate install path, TASK-064 library reprocess/re-embed
support, TASK-065 pipeline failure recovery UX, TASK-066 in-app encrypted backup
verify/restore, TASK-067 post-restore restart/recovery UX, TASK-068
diagnostics/support bundles, TASK-069 local production hardening, and TASK-070
installed-artifact smoke testing are complete. TASK-063 includes the
in-repository Homebrew formula, checksum/docs coverage, Homebrew style/audit
validation, and dry-run install planning; full post-publish `brew install`
validation is gated on public access to the `v0.1.0-beta` release artifacts.
TASK-071 is complete with final MVP release documentation alignment across
user-facing, contributor, release-operator, roadmap, PRD, security, changelog,
and update-system docs. TASK-072 is complete with hybrid command-palette search
and user timeline events for manual category mutations. TASK-073 is complete
with post-MVP multi-user direction research and a focused development-server
Playwright smoke suite for documented business requirements. TASK-074 is
complete with a self-contained contributor engineering presentation, tracked
implementation plan, and local static/browser/type/test verification.

The MVP release-closeout queue is TASK-075 through TASK-084. These tasks do not
add new product scope; they close the gap between the implemented app and an
MVP-ready public build by freezing release metadata, publishing signed
artifacts, validating fresh-host installers, validating public install/update
paths, completing publication-gated Homebrew checks, smoke-testing first-user
UX, extending installed-app E2E to public artifacts, rerunning localhost
security regressions, preparing release/support notes, and producing the final
go/no-go release decision package. TASK-075 through TASK-077 and TASK-081
through TASK-084 are complete. TASK-078 is in progress but blocked on public
artifact visibility. TASK-079 is in progress with local formula checksum, test,
audit, and dry-run evidence, but live Homebrew install validation remains
blocked on public artifact visibility. TASK-080 is complete after a real
fresh-data smoke pass with an isolated loopback daemon. TASK-084 is complete
with a final no-go recommendation for public MVP promotion until
unauthenticated artifact access and the dependent public validation paths are
fixed or an authenticated distribution path is deliberately adopted.

The Grimoire parity workstream is now represented by TASK-085 through TASK-120,
converted from approved and refined rows in
`docs/parity/grimoire-parity-task-proposals.md`. The current parity batch is
local-first, single-user, loopback-first, and local-integrations-only. It covers
explicit non-goals, security boundaries, pragmatic local integration token auth,
bookmark read-later/open-metric parity, category/tag parity, import/export
workflow hardening, explicit pagination/filtering, aggregate counts, and
large-library verification. TASK-086 is complete as the conversion record.
TASK-085 is complete after locking the parity scope and non-goals across the
parity report, roadmap, release docs, and task-report index. TASK-087 is
complete after adding the canonical loopback/local-integration threat model,
public-network release gates, and release-checklist blockers for network
exposure changes. TASK-088 is complete after adding recurring Grimoire parity
release checklist coverage for API contracts, bookmark fields, category/tag
management, import/export, search/filter/pagination/aggregate behavior, local
integrations, and their required verification signals. TASK-089 is complete
after adding first-class read-later persistence, API/list/search/export
filters, frontend badges and controls, filtered exports, generated docs, visual
reporting, e2e coverage, and review hardening for validation and cache
invalidation. TASK-091 is complete with open-metric persistence, API/export
fields, shared frontend open tracking, generated docs, visual reporting, review
hardening for native external-link behavior and visible metric refresh, and
full local verification. TASK-092 is complete with bookmark detail metadata and
extracted content sections. TASK-093 is complete with local bounded media
caching, daemon-served favicon/page-preview/extracted-image paths, local-only UI
fallbacks, private-redirect and SVG cache hardening, duplicate final URL
deduping, permanent-delete cache purging, generated API docs, visual reporting,
and focused/full daemon/frontend verification. TASK-094 is complete with bookmark mutation/detail
regression coverage, and TASK-095 is complete with full-tree sidebar category
navigation for empty and nested categories. TASK-096 is complete with a
stable category detail route, metadata and child-category rendering,
category-scoped daemon pagination, sidebar route navigation, focused frontend
tests, e2e coverage, and visual reporting. TASK-097 is in review with local
category metadata persistence, validation, generated API docs, category detail
rendering/editing, focused tests, and visual reporting. TASK-098 is in review
with a dedicated tag management page, API-backed active tag counts, create and
delete flows, sidebar navigation, tag detail browsing links, filtered-library
hydration, focused frontend tests, daemon tag route coverage, and visual
reporting.
TASK-099 is complete with stable tag detail routes, tag metadata, bookmark
chip navigation, focused tag management links, daemon-paginated scoped bookmark
lists, focused tests, e2e coverage, and visual reporting.
TASK-100 is complete with atomic tag rename behavior, duplicate-name conflict
handling, generated API docs, tag management and detail rename controls, cache
consistency hardening, FTS search verification, focused daemon/frontend tests,
e2e coverage, and visual reporting.
TASK-101 is complete with focused category/tag regression coverage for empty
rows, active counts, selected filter refresh, tag delete filter/search cleanup,
category move/delete behavior, and whole-branch category depth validation.
TASK-102 is complete with managed local integration bearer tokens, hashed token
storage, redacted list output, MCP protection, optional REST bearer validation,
rotation, revocation, generated API docs, security documentation, and focused
daemon auth coverage.
TASK-103 is complete with generated request/response examples for local
integration clients across integration tokens, MCP auth failures, bookmark
create/list/detail/update, search filtering and pagination, import/export,
categories, tags, backup, and common error flows. The examples are stored in
the source API contract and regenerated into both `API.md` and
`docs/api-contract.json`, with docs drift covered by `npm run docs:api:check`.
Bookmark importance is rejected for this batch, one-click browser capture is
deferred, future Grimoire backup import is deferred, multi-user/server account
parity remains deferred, and Grimoire endpoint aliases plus browser extension
smoke tests remain rejected for the current parity batch.

Completed release validation evidence:

1. `npm run check` passed locally.
2. `npm run test:e2e` passed locally.
3. Docker Compose build/start/health validation passed with the host port bound to `127.0.0.1:3210:3210`.
4. `docker compose down` preserved the named data volume.
5. Native macOS install/health/upgrade/uninstall/purge smoke passed in an isolated temporary home.
6. Release-target and local markdown link audits passed.
7. GitHub Actions `Quality Gates` passed for the current release-validation commit, including lint/types/tests/docs/build, Playwright E2E, and Docker build/health.
8. Linux systemd user installer smoke passed in an Ubuntu 24.04 Docker environment with systemd running as PID 1 and a non-root `systemctl --user` manager.
9. Installer matrix validation names the exact MVP OS targets and passed the packaged Linux archive smoke on Ubuntu 24.04 LTS and Debian 12 systemd-user containers.
10. Final MVP release documentation alignment passed generated API docs drift
    checking and local Markdown link auditing.
11. TASK-075 release-candidate freeze verified the root and daemon package
    versions, release-tagged installer URLs, release-facing documentation, task
    board status, API docs drift check, and local Markdown links for the
    `0.1.0-beta` release target.
12. TASK-076 generated signed macOS and Linux release archives, verified
    checksums and detached GPG signatures, passed
    `npm run release:validate -- --require-signatures`, and published
    `v0.1.0-beta` as a GitHub prerelease with archives, checksum files,
    signatures, and `release-manifest.json` attached.
13. TASK-077 reran signed-artifact Linux installer matrix validation on Ubuntu
    24.04 LTS and Debian 12 systemd-user containers, confirmed install,
    `/health` version `0.1.0-beta`, autostart, upgrade data preservation,
    uninstall data preservation, and explicit purge behavior, and recorded
    macOS arm64/x64 availability gaps in the installer matrix evidence.
14. TASK-081 added a published-artifact installed-app smoke mode and release
    checklist command. The local installed-app smoke passed against freshly
    packaged artifacts; the published-artifact command stopped before
    install/runtime work because the public macOS archive URL returned
    `HTTP 404`, preserving TASK-078 as the release-blocking visibility issue.
15. TASK-082 reran final localhost security regressions. The current source
    daemon bound to `127.0.0.1`, Docker Compose rendered a loopback-only host
    publish, unsafe browser origins were rejected, CSP and browser hardening
    headers were present, private-host/update-source blocking and guarded
    body/path handling stayed covered by daemon tests, diagnostics redaction now
    includes explicit content/notes/embedding model/vector regression coverage,
    and refreshed GitHub release artifacts passed checksum and GPG signature
    validation.
16. TASK-079 local Homebrew validation updated the in-repository formula to the
    final signed release artifact checksums from `release/release-manifest.json`,
    added checksum drift coverage to `scripts/homebrew-formula.test.ts`, passed
    the focused formula test, passed `brew style Formula/little-imp.rb`, passed
    `brew audit --strict goniszewski/little-imp/little-imp` for the registered
    tap formula shape, and passed the registered-tap Homebrew dry-run install
    plan.
17. TASK-083 added `docs/release-notes-v0.1.0-beta.md` with final user-facing
    release notes covering install paths, supported OS matrix,
    checksum/signature guidance, validation summary, known limitations,
    diagnostics posture, troubleshooting links, and security reporting guidance.
18. TASK-084 added `docs/release-decision-v0.1.0-beta.md` with the release
    identity, artifact inventory, checksum/signature status, validation matrix,
    explicit skipped checks, accepted MVP limitations, and a no-go decision for
    public promotion while public artifact URLs still return `HTTP 404`.

Notes:

- TASK-029 is not present as a task file; daemon test coverage is represented by TASK-030 and TASK-035.
- TASK-047 was the final consistency pass after the implementation-facing hardening tasks landed.
- TASK-048 completed the release checklist paths available in this workspace, including a containerized Ubuntu systemd-user smoke for the Linux installer path.
- TASK-062 documents macOS 12+ x64 as a manual pre-publish target because this workspace does not have Intel macOS hardware or an x64 macOS VM.
- TASK-078 is in progress and currently blocked by repository visibility:
  authenticated GitHub release inspection sees the `v0.1.0-beta` prerelease and
  expected assets, but unauthenticated public checks for the documented
  tag-qualified installer and release archive URLs return `404` while the
  repository is private. TASK-079 shares the same public artifact access
  dependency. Several checks also depend on Homebrew tap availability.
- TASK-079 is in progress. Formula checksum validation is now covered locally,
  but `brew fetch --formula goniszewski/little-imp/little-imp` still returns
  `HTTP 404` for the public macOS archive URL, so live `brew install`, service,
  health, uninstall, and data-preservation checks remain blocked.
- TASK-080 is complete after adding a loopback-only `VITE_DAEMON_URL`
  override for isolated smoke runs. The real fresh-data pass covered
  add/search/detail, degraded AI and embedding states, import, backup
  create/verify, encrypted package create/verify, restore recovery, diagnostics,
  and publication-gated update-check messaging without stopping the installed
  daemon on `127.0.0.1:3210`.
- TASK-081 is complete with a documented
  `npm run test:e2e:installed:published` command that downloads public release
  artifacts, verifies the archive checksum and detached signature, and runs the
  existing installed-app smoke against the verified archive. On May 29, 2026
  the live command failed before install/runtime work because the public macOS
  archive URL returned `HTTP 404`, so TASK-078 remains the release-blocking
  public visibility item.
- TASK-084 is complete. The final release decision is no-go for public MVP
  promotion until the public installer/archive URLs are reachable and TASK-078,
  TASK-079, and the public-artifact smoke path are rerun successfully, or until
  an authenticated distribution path is explicitly chosen and validated.

See [docs/roadmap.md](../docs/roadmap.md) for full milestone details.
