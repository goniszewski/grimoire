# Grimoire Parity Acceptance Checklist

Date: 2026-06-08  
Scope: approved local-first, single-user, loopback-first, local-integration parity batch  
Status: accepted for current parity scope; public distribution blockers remain tracked separately

This checklist answers one release-readiness question: every closed parity row
for the current local-first batch has a concrete verification signal. It covers
rows marked `Approved` and `Done` in
[`grimoire-parity-task-proposals.md`](./grimoire-parity-task-proposals.md). It
consolidates the parity report, recurring release checklist, completed task
notes, task reports, and local verification commands.

## Acceptance Summary

- Approved parity rows are closed for the current local-first scope.
- No untracked parity gaps were found while reviewing the worksheet against
  [`grimoire-feature-parity-report.md`](./grimoire-feature-parity-report.md).
- Deferred and rejected rows remain intentional non-goals, not release blockers
  for this parity batch.
- Evidence is strongest where runtime behavior changed: daemon tests, frontend
  tests, generated API checks, Playwright e2e, performance tests, and visual
  task reports are cited below.
- Documentation-only rows are accepted through document diffs, task-board
  cross-links, link checks, and release-checklist tests; runtime tests are not
  expected for those rows.

## Approved Evidence Matrix

| Parity ID | Closure task | Verification signal | Remediation note |
|---|---|---|---|
| PAR-001 | TASK-085 | Scope decision recorded in this report, the worksheet, and task report [`2026-05-31-task-085-grimoire-parity-scope`](../task-reports/2026/05/2026-05-31-task-085-grimoire-parity-scope/index.html); final TASK-085 verification passed `npm run check`, `git diff --check`, `npm run docs:api:check`, and local documentation link checks. | None. |
| PAR-002 | TASK-085 | Intentional non-goals are captured in the parity report, roadmap/release docs, and TASK-085 task report; final TASK-085 verification passed `npm run check`, `git diff --check`, `npm run docs:api:check`, and link checks. | None. |
| PAR-003 | TASK-086 | Converted approved rows into task files and task-board links under `tasks/`; task is documentation/workflow only. | Runtime tests are not expected for task conversion. |
| PAR-004 | TASK-087 | Security boundaries documented in [`security-boundaries.md`](../security-boundaries.md); TASK-087 notes record `npm run check`, focused daemon security tests, `npm run docs:api:check`, link checks, and task report [`2026-05-31-task-087-daemon-network-exposure-security-boundaries`](../task-reports/2026/05/2026-05-31-task-087-daemon-network-exposure-security-boundaries/index.html). | None. |
| PAR-005 | TASK-088 | Recurring release gates live in [`release-checklist.md`](../release-checklist.md); `scripts/parity-release-checklist.test.ts` verifies the section names parity checkpoints and verification signals. TASK-088 notes record `npx tsc --noEmit`, `npm run test`, `npm run lint`, `npm run docs:api:check`, and `git diff --check`. | None. |
| PAR-007 | TASK-089 | Pinning maps to Grimoire starred/favorite and read-later is separate. Evidence includes focused daemon tests, focused frontend tests, generated API docs check, production build, Playwright e2e, `npm run check`, and task report [`2026-05-31-task-089-read-later-bookmark-flag`](../task-reports/2026/05/2026-05-31-task-089-read-later-bookmark-flag/index.html). | None. |
| PAR-008 | TASK-089 | Read-later persistence, filters, badges, exports, and cache invalidation are covered by `daemon/src/test/integration/bookmarks.test.ts`, `src/components/BookmarkCard.test.tsx`, `src/hooks/use-bookmarks.test.ts`, `src/lib/export-url.test.ts`, `e2e/business-requirements.spec.ts`, `npm run docs:api:check`, and the TASK-089 visual report. | None. |
| PAR-010 | TASK-091 | Open count and last-opened behavior is covered by daemon/frontend tests, export field coverage, generated API docs, `npm run lint`, `npm run type-check`, `npm run test`, `npm run test:daemon`, `npm run docs:api:check`, `npm run build`, `npm run test:e2e`, and task report [`2026-05-31-task-091-bookmark-open-metrics`](../task-reports/2026/05/2026-05-31-task-091-bookmark-open-metrics/index.html). | None. |
| PAR-011 | TASK-092 | Bookmark detail metadata/content sections are covered by focused detail tests including `src/components/BookmarkDetailContent.test.tsx`, visual desktop/narrow evidence in [`2026-05-31-task-092-bookmark-detail-metadata-content`](../task-reports/2026/05/2026-05-31-task-092-bookmark-detail-metadata-content/index.html), and review hardening for safe extracted links/images. | None. |
| PAR-012 | TASK-093 | Local media handling is covered by `daemon/src/test/bookmark-media.test.ts`, media route/cache checks, generated API docs where route behavior changed, and visual evidence in [`2026-05-31-task-093-bookmark-media-handling-preview`](../task-reports/2026/05/2026-05-31-task-093-bookmark-media-handling-preview/index.html). | None. |
| PAR-013 | TASK-094 | Bookmark mutation/detail regression coverage passed `bun test daemon/src/test/integration/bookmarks.test.ts`, focused frontend tests for `BookmarkDetailContent`, `BookmarkDetail`, `use-bookmarks`, and `src/lib/api.test.ts`, `npm run docs:api:check`, `npm run type-check`, `npm run lint`, then review verification with `npm run check`, `npm run test:e2e`, and `npx tsc --noEmit`. | None. |
| PAR-014 | TASK-095 | Full category tree navigation is covered by `src/components/AppSidebar.test.tsx`, `src/hooks/use-bookmarks.test.ts`, `daemon/src/test/integration/bookmarks.test.ts`, `daemon/src/test/integration/search.test.ts`, full frontend/daemon suites, `npm run docs:api:check`, `npm run test:e2e`, and visual evidence in [`2026-05-31-task-095-sidebar-categories-full-tree`](../task-reports/2026/05/2026-05-31-task-095-sidebar-categories-full-tree/index.html). | None. |
| PAR-015 | TASK-096 | Category detail pages are covered by `src/pages/CategoryDetail.test.tsx`, `src/components/AppSidebar.test.tsx`, full frontend/daemon suites, `npm run docs:api:check`, `npm run build`, `npm run test:e2e`, and visual evidence in [`2026-05-31-task-096-category-detail-page`](../task-reports/2026/05/2026-05-31-task-096-category-detail-page/index.html). | None. |
| PAR-016 | TASK-097 | Category metadata fields are covered by focused daemon category tests, focused category-detail frontend tests, generated API docs checks, lint/type/frontend/daemon/build/e2e gates, and visual evidence in [`2026-05-31-task-097-category-metadata-fields`](../task-reports/2026/05/2026-05-31-task-097-category-metadata-fields/index.html). | None. |
| PAR-017 | TASK-098 | Tag management is covered by `daemon/src/test/integration/tags.test.ts`, `src/pages/Tags.test.tsx`, `src/lib/api.test.ts`, `npm run check`, `npm run test:e2e`, `git diff --check`, and visual evidence in [`2026-05-31-task-098-tag-management-surface`](../task-reports/2026/05/2026-05-31-task-098-tag-management-surface/index.html). | None. |
| PAR-018 | TASK-099 | Tag detail pages are covered by focused `src/pages/TagDetail.test.tsx`, tag management and bookmark-card tests, lint/type/build gates, Playwright e2e, and visual evidence in [`2026-05-31-task-099-tag-detail-pages`](../task-reports/2026/05/2026-05-31-task-099-tag-detail-pages/index.html). | None. |
| PAR-019 | TASK-100 | Tag rename is covered by focused daemon/frontend tests, e2e verification, cache-consistency review hardening, and visual evidence in [`2026-05-31-task-100-tag-rename-api-ui`](../task-reports/2026/05/2026-05-31-task-100-tag-rename-api-ui/index.html). | None. |
| PAR-020 | TASK-101 | Category/tag regression coverage passed `bun test daemon/src/test/category-repository.test.ts daemon/src/test/integration/categories.test.ts daemon/src/test/integration/tags.test.ts`, focused frontend tests for `use-bookmarks`, `AppSidebar`, `Tags`, `TagDetail`, and `CategoryDetail`, `npm run docs:api:check`, `npm run test`, `npm run test:daemon`, and task report [`2026-06-01-task-101-category-tag-regression-tests`](../task-reports/2026/06/2026-06-01-task-101-category-tag-regression-tests/index.html). | None. |
| PAR-021 | TASK-102 | Integration-token auth is covered by `daemon/src/test/integration/integration-token-auth.test.ts`, migration coverage, `npm run docs:api:check`, `npm run check`, and task report [`2026-06-01-task-102-integration-token-auth`](../task-reports/2026/06/2026-06-01-task-102-integration-token-auth/index.html). | None. |
| PAR-022 | TASK-103 | Human-readable API examples are covered by `scripts/api-docs-generator.test.ts`, `npm run docs:api:check`, full `npm run check`, regenerated `API.md` and `docs/api-contract.json`, and task report [`2026-06-01-task-103-api-examples`](../task-reports/2026/06/2026-06-01-task-103-api-examples/index.html). | None. |
| PAR-023 | TASK-104 | OpenAPI output is covered by generator tests, `npm run docs:api:check`, `npm run docs:openapi:check`, `npm run check`, `git diff --check`, and task report [`2026-06-01-task-104-openapi-contract-output`](../task-reports/2026/06/2026-06-01-task-104-openapi-contract-output/index.html). | None. |
| PAR-024 | TASK-105 | Protected capture is covered by `daemon/src/test/integration/capture.test.ts`, API generator coverage, generated `API.md`, `docs/api-contract.json`, `docs/openapi.json`, and task report [`2026-06-02-task-105-one-click-capture-endpoint`](../task-reports/2026/06/2026-06-02-task-105-one-click-capture-endpoint/index.html). Packaged browser clients remain out of scope. | None for the protected endpoint; browser clients are deferred. |
| PAR-026 | TASK-106 | CORS/origin controls are covered by focused daemon origin tests, generated API docs, [`security-boundaries.md`](../security-boundaries.md), and task report [`2026-06-01-task-106-integration-cors-origin-controls`](../task-reports/2026/06/2026-06-01-task-106-integration-cors-origin-controls/index.html). | None. |
| PAR-035 | TASK-107 | Folder hierarchy import is covered by `bun test daemon/src/test/integration/import.test.ts`, `npm run docs:api:check`, `npm run lint`, `npm run type-check`, `npm run test:daemon`, `npm run check`, `git diff --check`, and task report [`2026-06-01-task-107-preserve-import-folder-hierarchy`](../task-reports/2026/06/2026-06-01-task-107-preserve-import-folder-hierarchy/index.html). | None. |
| PAR-036 | TASK-108 | Pre-import review is covered by focused `src/components/ImportDialog.test.tsx` coverage for preview, cancel, policy refresh, confirm, and malformed preview failure; business-requirements e2e coverage for preview-before-commit behavior; and visual evidence in [`2026-06-01-task-108-pre-import-review`](../task-reports/2026/06/2026-06-01-task-108-pre-import-review/index.html). | None. |
| PAR-037 | TASK-109 | Category/tag remapping is covered by `bun test daemon/src/test/integration/import.test.ts`, `npx vitest run src/components/ImportDialog.test.tsx src/lib/api.test.ts src/hooks/use-bookmarks.test.ts`, `npm run docs:api:check`, `npm run test:e2e -- e2e/business-requirements.spec.ts`, `npm run check`, and visual evidence in [`2026-06-01-task-109-import-category-tag-remapping`](../task-reports/2026/06/2026-06-01-task-109-import-category-tag-remapping/index.html). | None. |
| PAR-038 | TASK-120 | Duplicate handling policy is covered by `bun test daemon/src/test/integration/import.test.ts`, `npm run test:daemon`, `npm run test`, `npm run lint`, `npm run type-check`, `npm run docs:api:check`, `npm run build`, and task report [`2026-06-01-task-120-import-duplicate-handling-policy`](../task-reports/2026/06/2026-06-01-task-120-import-duplicate-handling-policy/index.html). | None. |
| PAR-039 | TASK-110 | Import result reports are covered by daemon/frontend tests, e2e mock updates, `npm run check`, `npm run test:e2e`, `npm run lint`, and visual evidence in [`2026-06-01-task-110-import-result-report`](../task-reports/2026/06/2026-06-01-task-110-import-result-report/index.html). | None. |
| PAR-040 | TASK-111 | Export parity fields are covered by focused export integration tests, full daemon suite, daemon type-checking, `npm run docs:api:check`, `npm run docs:openapi:check`, whitespace checks, and task report [`2026-06-01-task-111-export-parity-fields`](../task-reports/2026/06/2026-06-01-task-111-export-parity-fields/index.html). | None. |
| PAR-042 | TASK-113 | Import/export regression coverage passed `bun test daemon/src/test/netscape-parser.test.ts daemon/src/test/integration/import.test.ts daemon/src/test/integration/bookmarks.test.ts`, `npm run test -- src/components/ImportDialog.test.tsx`, `npm test`, `npm run test:daemon`, `npm run lint`, and task report [`2026-06-01-task-113-import-export-regression-tests`](../task-reports/2026/06/2026-06-01-task-113-import-export-regression-tests/index.html). | None. |
| PAR-043 | TASK-114 | Library pagination is covered by focused pagination/component tests, focused pagination e2e, `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`, `git diff --check`, and visual evidence in [`2026-06-01-task-114-library-pagination`](../task-reports/2026/06/2026-06-01-task-114-library-pagination/index.html). | None. |
| PAR-044 | TASK-115 | Server-driven sorting is covered by `daemon/src/test/search-repository.test.ts`, `src/lib/api.test.ts`, `src/hooks/use-bookmarks.test.ts`, generated API contract checks, and visual evidence in [`2026-06-02-task-115-server-driven-sorting`](../task-reports/2026/06/2026-06-02-task-115-server-driven-sorting/index.html). | None. |
| PAR-045 | TASK-116 | Library parity filters are covered by `npm run check`, `npm run test:e2e`, `bun test daemon/src/test/migrations.test.ts`, `git diff --check`, and visual evidence in [`2026-06-01-task-116-library-parity-filters`](../task-reports/2026/06/2026-06-01-task-116-library-parity-filters/index.html). | None. |
| PAR-046 | TASK-117 | Persisted library preferences are covered by focused hook/page tests, full frontend/unit suite, full frontend and daemon type-checking, lint, Playwright e2e, production build, whitespace diff validation, and desktop/mobile visual evidence in [`2026-06-02-task-117-persist-library-view-preferences`](../task-reports/2026/06/2026-06-02-task-117-persist-library-view-preferences/index.html). | None. |
| PAR-047 | TASK-118 | Aggregate counts are covered by focused daemon tests for empty/default, filtered, and 150-row large-count scenarios; `src/lib/api.test.ts` and `src/hooks/use-bookmarks.test.ts` aggregate serialization/navigation coverage; regenerated API docs/OpenAPI; and task report [`2026-06-02-task-118-aggregate-count-endpoints`](../task-reports/2026/06/2026-06-02-task-118-aggregate-count-endpoints/index.html). | None. |
| PAR-048 | TASK-119 | Large-library performance is covered by `npm run test:performance`, `npm run type-check:daemon`, `npm run test:daemon`, `npm run lint`, `git diff --check`, and budgets documented in [`performance.md`](../performance.md). | None. |
| PAR-049 | TASK-103 | Parity-driven local API examples are covered by the same generated examples and generator tests as PAR-022; browser-extension/bookmarklet examples remain deferred because packaged clients are not shipped in this batch. | None for local integration examples. |
| PAR-050 | TASK-085, TASK-088 | Parity goals and non-goals are aligned in the parity report, release docs, task board, and recurring release checklist; evidence includes TASK-085 docs checks and `scripts/parity-release-checklist.test.ts`. | None. |
| PAR-051 | TASK-133 | Task reports for visible parity work are linked from the task-report root/year/month indexes, with batch report [`2026-06-05-task-133-parity-visual-verification`](../task-reports/2026/06/2026-06-05-task-133-parity-visual-verification/index.html). | None. |
| PAR-052 | TASK-133 | Visual verification includes 18 synthetic desktop/narrow screenshots for category tree, bookmark detail/media, category detail, tag list/detail, library pagination/sort/filter, filter dropdowns, and import preview/result states; dimensions were checked with `sips` and screenshots were visually inspected. | None. |
| PAR-053 | TASK-121 | Contract route behavior checks are covered by `scripts/api-docs-generator.test.ts`; route existence drift and status-code drift are wired into `npm run docs:api:check`, then `npm run check` and CI. | Hard failure for every static status-code drift case is intentionally deferred until regex limitations are removed; current accepted signal reports drift deterministically. |
| PAR-054 | TASK-134 | This checklist consolidates per-row evidence, verifies deferred/non-goal scope, and is linked from the release decision package. | None. |

## Deferred Or Rejected Rows

These are intentionally not counted as accepted current-batch parity gaps:

| Parity ID | Status | Current decision |
|---|---|---|
| PAR-006 | Deferred, mismatch closed | URL and extracted-summary runtime mutation remains deferred. TASK-094 removed unsupported editable affordances so the detail UI no longer promises unsupported mutation. |
| PAR-009 | Rejected | Bookmark importance rating remains rejected for this batch because it adds schema/API/UI/filter/export complexity without a clear retrieval workflow benefit. |
| PAR-025 | Rejected | Grimoire-compatible endpoint aliases are not needed for the current local-first migration or integration scope. |
| PAR-027 | Rejected | Browser-extension compatibility smoke tests stay out of scope while no packaged browser extension/bookmarklet client is shipped. |
| PAR-028 through PAR-034 | Deferred | Multi-user accounts, sessions, admin, profile, per-user scoping, and auth/session threat-model work remain a separate product decision. |
| PAR-041 | Deferred handoff | Direct Grimoire/PocketBase backup import remains future runtime work. The source shape and field mapping are documented in [`grimoire-backup-import-shape.md`](./grimoire-backup-import-shape.md). |

## Release Use

Before claiming a parity-facing beta or release candidate is parity-complete,
rerun the recurring checklist in [`release-checklist.md`](../release-checklist.md)
and refresh this acceptance matrix when any parity-linked API, daemon,
frontend, import/export, task-report, or release-documentation surface changes.
