# TASK-088: Recurring Parity Release Checklist

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** release / QA
**Source:** PAR-005
**Labels:** grimoire-parity, release-planning, qa

## Description

Add a recurring Grimoire parity checklist to release planning so closed parity
gaps stay closed across future changes.

## Scope

1. Create or update a release checklist section for parity regression review.
2. Include API contract, bookmark fields, category/tag management, import/export,
   search/filter, and integration behavior checkpoints.
3. Link checklist items back to parity tasks and docs.
4. Define when visual, API, e2e, and performance verification are required.

## Acceptance Criteria

- [x] Release planning includes a recurring parity checklist.
- [x] Checklist items cover the approved parity areas.
- [x] Each checklist item names the expected verification signal.
- [x] The checklist links to the parity worksheet or final acceptance checklist.
- [x] Closed parity gaps have a documented regression review path.

## Dependencies

- Should be updated as parity tasks land.

## Work Notes

- May 31, 2026: Selected as the next logical actionable task because
  TASK-078 and TASK-079 remain blocked on public artifact visibility,
  TASK-080 remains blocked by the shared daemon occupying
  `127.0.0.1:3210`, and TASK-088 is the first approved Grimoire parity backlog
  item after the completed scope and security-boundary tasks.
- Added a recurring Grimoire parity review section to
  `docs/release-checklist.md` with checkpoints for API contract/docs,
  bookmark fields, category/tag management, import/export,
  search/filter/pagination/aggregate behavior, and local integrations.
- Linked the checklist to the parity report, parity worksheet, task IDs, and
  source docs so future release planning has a regression review path for
  closed parity gaps.
- Added `scripts/parity-release-checklist.test.ts` to guard the section and
  required verification signal wording inside the recurring parity section.
- Updated the parity worksheet and parity report to show PAR-005/TASK-088 as
  done and to make local integration auth/API docs the next recommended parity
  area.
- Verification: the new focused parity checklist test failed before the
  checklist update, then passed after it. `npm run test` passed with 158/158
  tests. `npm run lint` exited 0 with the repository's existing Fast Refresh
  and exhaustive-deps warnings. `git diff --check` passed.
- May 31, 2026 review: tightened the regression guard so verification phrases
  must appear inside the recurring parity section itself, added explicit
  Playwright e2e wording, confirmed changed report links, and reran
  `npx tsc --noEmit`, `npm run test`, `npm run lint`,
  `npm run docs:api:check`, and `git diff --check`.
