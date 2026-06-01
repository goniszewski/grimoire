# TASK-101: Category And Tag Regression Tests

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** QA / categories / tags
**Source:** PAR-020
**Labels:** grimoire-parity, tests, categories, tags

## Description

Add category and tag regression tests for empty rows, counts, drag reparenting,
delete behavior, and filter refresh.

## Scope

1. Cover empty category visibility and full tree navigation.
2. Cover category counts, drag reparenting, delete behavior, and filter refresh.
3. Cover tag list, create, delete, rename, detail, and counts as implemented.
4. Include daemon and frontend focused test coverage.

## Acceptance Criteria

- [x] Empty categories and tags are covered by regression tests.
- [x] Counts remain accurate after create, delete, move, and rename actions.
- [x] Category drag/reparent behavior retains existing constraints.
- [x] Filters refresh when category or tag state changes.
- [x] Tests are documented in related task verification notes.

## Dependencies

- Should grow with TASK-095 through TASK-100.

## Work Notes

- June 1, 2026: Added focused daemon regression coverage for empty tags, active
  tag counts excluding archived/trashed bookmarks, tag delete cleanup across
  bookmark filters and keyword search, category active counts, category rename
  and move count preservation, and category delete cleanup.
- June 1, 2026: Fixed category reparent validation to evaluate the full moved
  branch, not only the immediate target parent. `PUT /categories/:id` now
  rejects moves that would push any descendant past the three-level category
  limit.
- June 1, 2026: Added frontend regression coverage for selected category
  rename/delete filter refresh, category move dialog behavior, bookmark-hook
  category/tag aggregate refetches, and tag-detail archive/trash cache
  invalidation.
- June 1, 2026: Review pass corrected parity documentation statuses for
  TASK-100 and TASK-101 so feature reports no longer describe completed tag
  rename work as a future gap.
- June 1, 2026: Completed review and verification, then moved TASK-101 to done.
- Task report added:
  `docs/task-reports/2026/06/2026-06-01-task-101-category-tag-regression-tests/index.html`.

## Verification

- `bun test daemon/src/test/category-repository.test.ts daemon/src/test/integration/categories.test.ts daemon/src/test/integration/tags.test.ts`
  passed with 64 tests.
- `npx vitest run src/hooks/use-bookmarks.test.ts src/components/AppSidebar.test.tsx src/pages/Tags.test.tsx src/pages/TagDetail.test.tsx src/pages/CategoryDetail.test.tsx`
  passed with 64 tests.
- `npm run lint` passed with existing Fast Refresh warnings only.
- `npm run type-check` passed.
- `npm run docs:api:check` passed.
- `git diff --check` passed.
- Review verification also passed:
  `npx tsc --noEmit`, `npm run test` (232 tests), and
  `npm run test:daemon` (410 tests).
