# TASK-118: Aggregate Count Endpoints

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Aggregate counts are available independent of current page size.
- [ ] Counts support the approved library filter context.
- [ ] Sidebar and filter UI use aggregate data instead of loaded-page data.
- [ ] Queries remain performant on representative large libraries.
- [ ] Tests cover empty, filtered, and large-count scenarios.

## Dependencies

- Coordinates with TASK-095, TASK-098, TASK-116, and TASK-119.
