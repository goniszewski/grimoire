# TASK-099: Tag Detail Pages

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Users can open a stable `/tags/:tag` detail route.
- [ ] Detail page shows tag metadata and scoped bookmarks.
- [ ] Bookmark list uses daemon-backed pagination.
- [ ] Empty tag states are clear and actionable.
- [ ] Tests cover route loading, empty state, and pagination.

## Dependencies

- Depends on TASK-098 and coordinates with TASK-114.
