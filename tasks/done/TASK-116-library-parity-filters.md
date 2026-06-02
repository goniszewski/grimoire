# TASK-116: Library Parity Filters

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** search / filters / frontend / daemon
**Source:** PAR-045
**Labels:** grimoire-parity, filters, search

## Description

Add filters for unread/read, pinned/starred, read-later, opened count, and
last-opened date after the supporting fields are approved.

## Scope

1. Define filter query parameters and validation in the API contract.
2. Implement daemon filtering for list and search endpoints.
3. Add dense frontend filter controls that combine with existing filters.
4. Preserve URL/local state behavior and reset affordances.

## Acceptance Criteria

- [x] Read/unread, pinned/starred, read-later, opened count, and last-opened
      filters are available once fields exist.
- [x] Filters apply server-side before pagination.
- [x] Filter combinations work with search, category, tag, domain, and date.
- [x] UI makes active filters and reset behavior clear.
- [x] Tests cover individual and combined filters.

## Dependencies

- Depends on TASK-089, TASK-091, and TASK-114.

## Work Notes

- June 1, 2026: Started as the next local high-priority backlog task after the
  remaining release-validation tasks stayed blocked on public artifact
  visibility.
- Added server-side list/search filters for read state, pinned/starred state,
  opened count range, and last-opened date range. Existing read-later filtering
  remains supported and now shares validation with the new parity filters.
- Added shared daemon query validation, shared repository predicates, generated
  API contract/docs coverage, focused daemon route tests, frontend API
  serialization tests, hook wiring tests, and library toolbar tests.
- Added compact library toolbar controls and active filter chips that combine
  with existing category, tag, domain, created-date, search, read-later,
  page-size, and pagination state.
- Review follow-up: extended filtered exports so JSON/CSV downloads receive and
  apply the same read-state, pinned-state, opened-count, and last-opened
  filters as the visible library and search results.
- Visual verification ran against an isolated daemon on `127.0.0.1:33216` and
  Vite on `127.0.0.1:8081`; screenshots are recorded in
  `docs/task-reports/2026/06/2026-06-01-task-116-library-parity-filters/`.
- Verification passed with `npm run check`, `npm run test:e2e`,
  `bun test daemon/src/test/migrations.test.ts`, and `git diff --check`.
- June 2, 2026: Review follow-up passed and task moved to done for commit and
  push.
