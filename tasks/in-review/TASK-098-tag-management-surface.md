# TASK-098: Tag Management Surface

**Phase:** Grimoire parity
**Priority:** high
**Status:** in-review
**Area:** tags / frontend
**Source:** PAR-017
**Labels:** grimoire-parity, tags, ui

## Description

Add a dedicated tag management surface for listing, creating, deleting, and
browsing tags outside bookmark detail.

## Scope

1. Add navigation to a tag management view.
2. List tags with counts, loading, empty, and error states.
3. Support tag creation and deletion with validation and conflict handling.
4. Link tags to filtered library results or tag detail pages.

## Acceptance Criteria

- [x] Users can list all tags independent of current bookmark results.
- [x] Users can create and delete tags from a dedicated surface.
- [x] Tag counts do not depend on the currently loaded bookmark page.
- [x] Deleting a tag has confirmation and clear result feedback.
- [x] Frontend and daemon tests cover list/create/delete behavior.

## Dependencies

- Coordinates with TASK-099 and TASK-118.

## Work Notes

- May 31, 2026: Added a dedicated `/tags` management page backed by the existing daemon tag endpoints. The page lists API-backed active tag counts, creates normalized tags, confirms delete-before-detach behavior, and links each tag into browsing flows.
- Added typed frontend `createTag` and `deleteTag` API helpers and switched sidebar tag aggregates to use `GET /tags` counts instead of recomputing from the currently loaded bookmark page.
- Added sidebar navigation to the tag management surface and URL tag-filter hydration for `/?tag=<name>` links.
- Added focused frontend coverage for API helpers, API-backed tag counts, sidebar navigation, URL tag-filter clearing, import aggregate refreshes, and the tag page create/delete/list flows. Existing daemon tag integration coverage verifies list/create/delete route behavior.
- Visual verification used an isolated loopback daemon on port `33210` and Vite on port `8080`; screenshots are recorded in `docs/task-reports/2026/05/2026-05-31-task-098-tag-management-surface/`.
- May 31, 2026 review: Fixed stale tag filters when the `tag` URL query is removed, refreshed tag/domain aggregates after imports, aligned frontend tag API types with the daemon contract, and invalidated archive/trash/search caches after tag deletion.
- Verification after review: `npm run check`, `npm run test:e2e`, and `git diff --check` passed. `npm run check` still reports existing Fast Refresh lint warnings and Vite chunk-size guidance, with no errors.
- TASK-099 follow-up changed tag management row navigation from direct filtered
  library links to stable tag detail routes. The tag detail page keeps the
  filtered-library action available.
