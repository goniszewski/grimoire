# TASK-024: Category Management UI (Rename, Delete, Move)

**Status:** backlog
**Priority:** high
**Phase:** M1
**Area:** frontend

## Description

The backend fully supports category rename, delete, and reparenting. This task wires up the missing frontend UI. Currently only category creation is exposed in `AppSidebar`.

## Backend (already implemented — verify only)

- `PUT /categories/:id` — rename, reparent (verify works correctly)
- `DELETE /categories/:id` — delete with child reparenting (verify works correctly)

## Frontend

**Rename:**
- Right-click context menu (or hover kebab menu) on category in sidebar → "Rename"
- Inline input replaces the category name label; confirm on Enter or ✓, cancel on Escape

**Delete:**
- Context menu → "Delete"
- Confirmation dialog: warn if category has bookmarks; let user choose to move bookmarks to parent or leave uncategorized

**Move / reparent:**
- Drag-and-drop within the sidebar tree (primary interaction)
- Context menu → "Move to…" dropdown listing all valid parent categories (fallback, also mobile-friendly)
- Backend enforces max 3 levels depth — surface error if violated

## Acceptance Criteria

- [ ] Category can be renamed inline; new name persists on reload
- [ ] Category can be deleted; its bookmarks are reassigned or left uncategorized per user choice
- [ ] Category can be moved via drag-and-drop
- [ ] Category can be moved via "Move to…" dropdown
- [ ] Depth limit error is shown to user if they try to nest beyond 3 levels
- [ ] Empty state handled: deleting last category leaves uncategorized bookmarks accessible
