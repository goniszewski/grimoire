# TASK-117: Persist Library View Preferences

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** library / frontend
**Source:** PAR-046
**Labels:** grimoire-parity, preferences, library

## Description

Persist saved filter, sort, view, and page-size preferences locally.

## Scope

1. Define which library preferences are local-only versus daemon settings.
2. Persist filter, sort, view mode, and page-size choices.
3. Do not persist the current page across app sessions unless an explicit route
   already encodes it.
4. Restore preferences on app load without surprising first-run users.
5. Provide reset behavior for saved preferences.

## Acceptance Criteria

- [x] Filter, sort, view, and page-size preferences persist locally.
- [x] Current page is not silently restored across sessions.
- [x] Preferences restore consistently across reloads.
- [x] Saved state does not break shared links or explicit route filters.
- [x] Users can reset preferences.
- [x] Tests cover persistence, reset, and precedence rules.

## Dependencies

- Coordinates with TASK-114, TASK-115, and TASK-116.

## Work Notes

- June 2, 2026: Implemented local-only library view preference persistence in
  `useBookmarks` using `little-imp-library-view-preferences`. The persisted
  state includes filter choices, sort, search mode, and page size, while
  `pageOffset` remains session-only and resets to the first page on reload.
- Kept bookmark view mode in the existing app preferences store
  `little-imp-preferences`, so no daemon settings or API contract changes were
  needed.
- Added a toolbar reset command that clears saved library filters/sort/page
  size and resets bookmark view mode to grid without changing daemon data.
- Adjusted `/?tag=...` hydration so explicit shared tag links override saved
  local tag filters without clearing saved preferences during a normal root
  page load.
- Added focused hook and page tests for hydration, persistence without page
  restoration, reset behavior, and route-tag precedence.
- June 2, 2026 review pass: separated explicit route tag filters into a
  transient override so later preference writes cannot serialize shared-link tag
  filters, and tightened stored date parsing to reject rollover dates such as
  `2026-02-31`.
- Verification passed for focused hook/page tests, the full frontend/unit test
  suite, full frontend+daemon type-check, lint, Playwright e2e, production
  build, whitespace diff validation, and desktop/mobile visual screenshots.
- Visual evidence is recorded in
  `docs/task-reports/2026/06/2026-06-02-task-117-persist-library-view-preferences/`.
