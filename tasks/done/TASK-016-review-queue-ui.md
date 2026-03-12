# TASK-016: Review Queue UI

**Status:** done
**Priority:** low
**Phase:** v0.2
**Area:** frontend

## Description

Build the Review Queue page/panel where users can accept or reject AI agent suggestions for library reorganization.

## UI Requirements

- List of pending suggestions from `GET /suggestions`
- Each suggestion shows: type, description, affected bookmarks, confidence score
- Accept button → `POST /suggestions/:id/accept`
- Reject button → `POST /suggestions/:id/reject`
- Empty state when no suggestions pending

## Suggestion Types to Display

- New subcategory suggestion
- Category merge suggestion
- Duplicate bookmark pair

## Acceptance Criteria

- [x] Review Queue accessible from sidebar
- [x] Pending count badge on sidebar nav item
- [x] Accept/Reject updates UI optimistically
- [x] Empty state is friendly and informative
- [x] Suggestion list auto-refreshes after accept/reject
