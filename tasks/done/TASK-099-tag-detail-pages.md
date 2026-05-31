# TASK-099: Tag Detail Pages

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** tags / frontend
**Source:** PAR-018
**Labels:** grimoire-parity, tags, ui

## Description

Add tag detail pages with tag metadata and paginated bookmark lists.

## Scope

1. Add a dedicated `/tags/:tag` route and navigation from tag lists and bookmark
   chips.
2. Show tag name, count, metadata, and related actions.
3. Render paginated bookmarks scoped to the tag.
4. Support missing, empty, loading, and error states.

## Acceptance Criteria

- [x] Users can open a stable `/tags/:tag` detail route.
- [x] Detail page shows tag metadata and scoped bookmarks.
- [x] Bookmark list uses daemon-backed pagination.
- [x] Empty tag states are clear and actionable.
- [x] Tests cover route loading, empty state, and pagination.

## Dependencies

- Depends on TASK-098 and coordinates with TASK-114.

## Work Notes

- May 31, 2026: Started as the next local Grimoire parity task after TASK-098
  reached in-review. The release-closeout tasks remain blocked on public
  artifact visibility, while TASK-099 can build on existing tag management and
  daemon-backed bookmark pagination.
- May 31, 2026: Added the `/tags/:tag` route with tag metadata from `GET
  /tags`, scoped bookmarks from `GET /bookmarks?tag=&limit=&offset=`, loading,
  missing, empty, error, and pagination states. Tag management rows now open tag
  detail pages, and bookmark card tag chips link to the same stable routes.
- Verification passed for focused tag detail/tag management/bookmark card tests,
  lint, type-check, production build, and the Playwright E2E suite. Visual
  desktop and narrow screenshots are recorded in
  `docs/task-reports/2026/05/2026-05-31-task-099-tag-detail-pages/`.
- May 31, 2026: Moved to done after review hardening fixed SPA tag-chip
  navigation, added loading/error state coverage, and aligned parity/task
  documentation.
