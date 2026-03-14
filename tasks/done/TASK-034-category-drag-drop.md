# TASK-034: Category Drag-and-Drop Reparenting

**Status:** done
**Priority:** medium
**Phase:** M1
**Area:** frontend / UX

## Description

Add drag-and-drop reparenting of categories in the sidebar. This closes the last remaining M1 gap ("Move a category under another — Partial").

## Implementation

- Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Added `DndContext` wrapping the categories `SidebarMenu`
- Extracted `DraggableCategory` sub-component: each category row is both a draggable source and a drop target
- Added `RootDropZone` sub-component: allows dropping a category over the "All" item to make it a root-level category
- Drag handle (`GripVertical`) appears on hover; always visible while any drag is in progress
- Drop targets highlight with a primary ring on hover
- `DragOverlay` renders a floating ghost of the dragged item
- On `DragEnd`, calls the existing `moveMutation` (same API as the "Move to…" dropdown)
- Cycle-prevention: validates the drop target is not a descendant of the dragged category (reuses `getMoveTargets`)
- No changes to existing "Move to…" dropdown — both methods co-exist
- `PointerSensor` with `distance: 6` activation constraint to avoid accidental drags on clicks

## Code Review Fixes (post-implementation)

Five issues found and fixed during code review:

1. **Tags-only patch bypassed trashed check** (`bookmark-repository.ts`) — `setTags()` ran unconditionally when patch had only `tags`. Added existence + is_trashed guard before writing.
2. **POST /restore had no concurrency guard** (`backup.ts`) — Unified `backupInProgress` into `operationInProgress` covering both backup and restore endpoints. Also fixed `resolvedBackupsDir` not being `path.resolve()`'d before the `startsWith` containment check (caused all restores to 422 when `DATA_DIR` was a relative path).
3. **Auto-trash in OrganizationAgent was not atomic** (`organization-agent.ts`) — Wrapped `softDelete()` + `timelineRepo.insert()` in a single `db.transaction()`.
4. **Dead variables in DraggableCategory** (`AppSidebar.tsx`) — Removed unused `transform` and `isOver` destructures.
5. **No cycle guard in `collectSubtree`** (`AppSidebar.tsx`) — Added early-return `if (excluded.has(id)) return` to prevent infinite recursion on malformed data.

## Acceptance Criteria

- [x] Drag a category and drop it onto another → becomes a child (API call fires, tree refreshes)
- [x] Drag a category onto "All" → becomes root-level
- [x] Cannot drop a category onto itself or its own descendants
- [x] Visual feedback during drag (ghost overlay, drop target highlight)
- [x] Click-to-select still works (not triggered by drag)
- [x] All 52 frontend + 136 daemon tests pass
- [x] TypeScript clean, build succeeds
