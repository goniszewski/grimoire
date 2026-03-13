# TASK-021: Bookmark Status Actions (Pin, Archive, Read)

**Status:** done
**Priority:** high
**Phase:** M1
**Area:** backend / frontend

## Description

Wire up the three status fields that exist in the DB schema but have no API or UI: `is_pinned`, `is_archived`, and `read_at`. Also connect the existing `BookmarkRepository.softDelete()` to the UI.

## Backend

- Extend `PUT /bookmarks/:id` to accept `is_pinned`, `is_archived`, `read_at` fields
- Update `BookmarkRepository.update()` to handle these fields
- `GET /bookmarks` list query must exclude archived and trashed bookmarks by default
- Add `archived=true` filter param to `GET /bookmarks` to surface archive page content

## Frontend

- Pin / unpin action in `BookmarkCard` context menu and `BookmarkDetailContent`
- Archive / unarchive action in `BookmarkCard` context menu and `BookmarkDetailContent`
- Mark as read / unread action in `BookmarkCard` context menu
- Pinned bookmarks float to top within their category view by default
- User preference toggle: pin globally vs. pin per-category
- Archive page (`/archive`): lists archived bookmarks, excludes trashed; unarchive action available
- Update `use-bookmarks` hook to send the correct PATCH fields

## Acceptance Criteria

- [x] Pin/unpin persists across page reload
- [x] Archived bookmarks do not appear in the main feed
- [x] `/archive` page shows only archived, non-trashed bookmarks
- [x] Read/unread toggle updates `read_at` (set to now) or clears it (null)
- [x] Pinned bookmarks appear at top of category list by default
- [x] Global pin preference is respected when toggled
