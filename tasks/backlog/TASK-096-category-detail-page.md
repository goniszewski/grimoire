# TASK-096: Category Detail Page

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Users can open a stable `/categories/:id` detail route.
- [ ] Detail page shows metadata, child categories, and scoped bookmarks.
- [ ] Bookmark list uses daemon pagination instead of only loaded client data.
- [ ] Empty categories have a useful state.
- [ ] Tests cover routing, loading, empty, and paginated states.

## Dependencies

- Depends on TASK-095 and coordinates with TASK-114.
