# TASK-114: Library Pagination

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** library / frontend / daemon
**Source:** PAR-043
**Labels:** grimoire-parity, pagination, library

## Description

Add explicit UI pagination backed by existing daemon pagination.

## Scope

1. Add explicit pagination controls; do not implement infinite scroll in this
   batch.
2. Use daemon pagination for library, search, category detail, tag detail, and
   domain lists where applicable.
3. Define page size behavior and total-count display.
4. Reset or clear cross-page selection predictably when page/filter/sort changes.
5. Add loading, empty, empty-page recovery, and error states for page
   transitions.

## Acceptance Criteria

- [x] Library UI can navigate beyond the first daemon result page.
- [x] Search and filtered lists respect pagination.
- [x] Selection and bulk actions reset or clear predictably across page changes.
- [x] Page size is user-visible or locally configurable.
- [x] Empty pages after filter/delete changes recover to a valid page.
- [x] Frontend and e2e tests cover pagination behavior.

## Dependencies

- Coordinates with TASK-096, TASK-099, TASK-115, and TASK-117.

## Work Notes

- June 1, 2026: Added daemon-backed pagination state to the shared library hook,
  with 20, 50, and 100 item page-size choices, list/search `limit` and
  `offset` params, visible range metadata, and next/previous helpers.
- Added library footer controls for page size and page navigation. Search
  input, filters, sort, and page-size changes reset to page 1, while page and
  search-scope changes clear selected bookmark IDs so bulk actions stay scoped
  to visible results.
- Added empty-page recovery and error states for library, category detail, and
  tag detail pagination paths.
- Updated e2e daemon mocks to respect bookmark/search pagination metadata and
  added a business-requirements e2e for library next-page navigation and
  cross-page selection clearing.
- Visual verification used an isolated loopback daemon on port `33210` and Vite
  on port `8080`; screenshots are recorded in
  `docs/task-reports/2026/06/2026-06-01-task-114-library-pagination/`.
- Verification passed: focused pagination/component tests, focused pagination
  e2e, `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`,
  `npm run test:e2e`, and `git diff --check`. Lint/build/test output still
  includes the existing Fast Refresh, browserslist/chunk-size, and `punycode`
  warnings.
- Review hardening: selection scope now keys off the raw search input, not only
  the debounced search request, so bulk selections clear immediately when the
  user starts changing the search query.
