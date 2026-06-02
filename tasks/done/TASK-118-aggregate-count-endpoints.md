# TASK-118: Aggregate Count Endpoints

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** daemon / search / navigation
**Source:** PAR-047
**Labels:** grimoire-parity, api, aggregates

## Description

Add aggregate endpoints for category, tag, domain, read, pinned/starred, and
read-later counts independent of currently loaded result pages.

## Scope

1. Define aggregate count API shapes and filter interactions.
2. Implement efficient category, tag, domain, read, pinned/starred, and
   read-later counts.
3. Wire counts into navigation and filter UI without deriving them from the
   current page.
4. Add caching or query optimization if needed for large libraries.

## Acceptance Criteria

- [x] Aggregate counts are available independent of current page size.
- [x] Counts support the approved library filter context.
- [x] Sidebar and filter UI use aggregate data instead of loaded-page data.
- [x] Queries remain performant on representative large libraries.
- [x] Tests cover empty, filtered, and large-count scenarios.

## Work Notes

- June 2, 2026: Added `GET /bookmarks/aggregates` with category, tag, domain,
  read, pinned/starred, and read-later counts under the approved active-library
  filter context. The endpoint intentionally ignores pagination and sorting.
- Sidebar category, tag, and domain count data now comes from an unfiltered
  active-library aggregate response while category metadata still comes from the
  full category tree, so selected facets do not hide other navigation options.
- Generated API documentation, API contract JSON, and OpenAPI output were
  refreshed from `daemon/src/api/contract.ts`.
- Focused daemon coverage includes empty/default behavior, filtered counts, and
  a 150-row large-count scenario beyond normal page size.

## Dependencies

- Coordinates with TASK-095, TASK-098, TASK-116, and TASK-119.
