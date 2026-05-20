# TASK-022: Trash System (Soft Delete + 30-day Purge)

**Status:** done
**Priority:** high
**Phase:** M1
**Area:** backend / frontend

## Description

Introduce a proper Trash concept: deleting a bookmark moves it to Trash (sets `deleted_at`), where it lives for 30 days before being hard-deleted by a background purge job. The existing `is_archived` state is kept separate — archive is a permanent "put away", trash is a time-limited deletion queue.

## Backend

- Migration `0006_trash.sql`: add `deleted_at TEXT` column to `bookmarks`
- `DELETE /bookmarks/:id` sets `deleted_at = now()` instead of hard-deleting
- New `POST /bookmarks/:id/restore` endpoint — clears `deleted_at`
- New `DELETE /bookmarks/:id/permanent` endpoint — hard-deletes immediately
- All list queries (`GET /bookmarks`, search, archive) must exclude rows where `deleted_at IS NOT NULL`
- `GET /trash` endpoint: returns bookmarks where `deleted_at IS NOT NULL`, ordered by `deleted_at` desc
- Background purge job in `Scheduler`: runs daily, hard-deletes rows where `deleted_at < now() - 30 days`
- Update `BookmarkRepository` with `trash()`, `restore()`, `purgeExpired()` methods

## Frontend

- Trash icon on `BookmarkCard` calls soft-delete (not hard-delete)
- Trash page (`/trash`): lists trashed bookmarks with days-remaining indicator
- Restore button per item on `/trash`
- "Delete permanently" button per item on `/trash`
- "Empty trash" bulk action on `/trash`
- Trashed bookmarks are excluded from all other views including `/archive`

## Acceptance Criteria

- [x] Clicking trash icon moves bookmark to `/trash`, disappears from main feed
- [x] Restored bookmark reappears in main feed
- [x] Permanently deleted bookmark is gone from DB
- [x] Purge job removes rows older than 30 days
- [x] `/archive` never shows trashed bookmarks
- [x] Trashed bookmarks excluded from search results
