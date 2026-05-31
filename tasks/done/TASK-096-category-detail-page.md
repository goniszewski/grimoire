# TASK-096: Category Detail Page

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** categories / frontend
**Source:** PAR-015
**Labels:** grimoire-parity, categories, ui

## Description

Add a dedicated category detail page with category metadata, child categories,
and a paginated bookmark list.

## Scope

1. Add a dedicated `/categories/:id` route and navigation from the sidebar.
2. Show category name, parent path, children, counts, and available metadata.
3. Render paginated bookmarks scoped to the category.
4. Support empty category states and hierarchy navigation.

## Acceptance Criteria

- [x] Users can open a stable `/categories/:id` detail route.
- [x] Detail page shows metadata, child categories, and scoped bookmarks.
- [x] Bookmark list uses daemon pagination instead of only loaded client data.
- [x] Empty categories have a useful state.
- [x] Tests cover routing, loading, empty, and paginated states.

## Dependencies

- Depends on TASK-095 and coordinates with TASK-114.

## Work Notes

- May 31, 2026: Started after TASK-078 and TASK-079 remained blocked on
  unauthenticated public artifact access. Selected as the next logical
  category task because TASK-095 was complete and this task builds directly on
  the full-tree sidebar category navigation.
- Added a dedicated `/categories/:id` route and category detail page that
  resolves the category and parent path from the cached `/categories` tree.
- Added category metadata panels for bookmark count, creation date, and update
  date, plus child category cards that navigate to their own detail routes.
- Added a category-scoped bookmark list backed by daemon pagination through
  `GET /bookmarks?category_id=...&limit=20&offset=...`.
- Hardened bookmark-row rendering to avoid third-party favicon fallbacks when
  the daemon has not stored a favicon.
- Keyed pagination state to the active category id so changing categories does
  not issue a stale offset request.
- Preserved the existing sidebar category filter behavior and added a hover
  action that opens the stable category detail route from each sidebar category
  row.
- Added focused frontend coverage for route loading, metadata, child category
  rendering, empty states, daemon pagination offsets, unknown category handling,
  and sidebar route navigation.
- Added visual report:
  `docs/task-reports/2026/05/2026-05-31-task-096-category-detail-page/index.html`.

## Verification

- `npx vitest run src/pages/CategoryDetail.test.tsx src/components/AppSidebar.test.tsx`
  passed with 21 tests.
- `npm run lint` exited 0 with the repository's existing 9 warnings.
- `npm run type-check` passed.
- `npm test` passed with 206 tests.
- `npm run test:daemon` passed with 386 tests.
- `npm run docs:api:check` passed.
- `npm run build` passed with the existing Vite chunk-size warning.
- `npm run test:e2e` passed with 19 tests.
- `git diff --check` passed.
- Browser visual verification used an isolated seeded daemon on
  `127.0.0.1:33210` and Vite on `127.0.0.1:8080`. Desktop and mobile
  screenshots were captured, inspected, and console errors were empty.
