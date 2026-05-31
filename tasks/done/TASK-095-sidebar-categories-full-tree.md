# TASK-095: Sidebar Categories From Full Tree

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** categories / frontend
**Source:** PAR-014
**Labels:** grimoire-parity, categories, ui

## Description

Render category navigation from the full `/categories` tree so empty categories
and hierarchy are visible instead of deriving navigation only from loaded
bookmarks.

## Scope

1. Fetch and cache the full category tree through the centralized API layer.
2. Render empty categories, nested categories, and counts without depending on
   the current bookmark page.
3. Keep drag, reparent, delete, and filter refresh behavior intact.
4. Add loading, empty, and error states for category navigation.

## Acceptance Criteria

- [x] Empty categories appear in navigation.
- [x] Nested category hierarchy matches `/categories` response ordering.
- [x] Bookmark filters update correctly when selecting any category.
- [x] Category changes refresh navigation without requiring full page reload.
- [x] Frontend tests cover empty and nested category rendering.

## Dependencies

- Coordinates with TASK-118 for aggregate counts.

## Work Notes

- May 31, 2026: Completed after TASK-078 and TASK-079 remained blocked on
  unauthenticated public artifact access. Selected as the next actionable
  high-priority Grimoire parity task with satisfied dependencies.
- Changed the frontend bookmark hook to flatten the cached `/categories` tree
  into sidebar rows that preserve API ordering, parent relationships, depth,
  and `bookmark_count` values. This makes empty categories visible instead of
  deriving navigation only from the loaded bookmark page.
- Added `category_id` query filter support to list, search, and export while
  preserving the existing category-name filter for backwards compatibility.
- Kept the selected category id alongside the selected category name in the
  frontend state so duplicate category labels in different branches do not
  highlight, toggle, or filter together in the sidebar.
- Hardened category rename and delete handling so duplicate-name selection is
  only updated when the selected category id is the mutated category.
- Regenerated API documentation from the daemon contract so `API.md` and
  `docs/api-contract.json` include the id-based category filter.
- Added sidebar loading, empty, and error states for category navigation.
- Added visual report:
  `docs/task-reports/2026/05/2026-05-31-task-095-sidebar-categories-full-tree/index.html`.

## Verification

- `npx vitest run src/hooks/use-bookmarks.test.ts src/lib/export-url.test.ts src/components/AppSidebar.test.tsx`
  passed with 38 tests.
- `bun test daemon/src/test/integration/bookmarks.test.ts daemon/src/test/integration/search.test.ts`
  passed with 36 tests.
- `npm run lint` exited 0 with the repository's existing 9 warnings.
- `npm run type-check:frontend` passed.
- `npm run build` passed with the existing Vite chunk-size warning.
- `npm test` passed with 199 tests.
- `npm run test:daemon` passed with 386 tests.
- `npm run docs:api:check` passed.
- `git diff --check` passed.
- `npm run test:e2e` passed with 19 tests.
- Browser visual verification used an isolated seeded daemon at
  `127.0.0.1:33210` and Vite at `127.0.0.1:18080`. Desktop, filtered category,
  and mobile-sidebar screenshots were captured for the task report.
