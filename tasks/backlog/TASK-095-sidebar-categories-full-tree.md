# TASK-095: Sidebar Categories From Full Tree

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Empty categories appear in navigation.
- [ ] Nested category hierarchy matches `/categories` response ordering.
- [ ] Bookmark filters update correctly when selecting any category.
- [ ] Category changes refresh navigation without requiring full page reload.
- [ ] Frontend tests cover empty and nested category rendering.

## Dependencies

- Coordinates with TASK-118 for aggregate counts.
