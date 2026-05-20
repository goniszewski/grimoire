# TASK-009: Categories & Tags API

**Status:** done
**Priority:** medium
**Phase:** v0-alpha
**Area:** backend / api

## Description

Implement CRUD API for categories and tags, plus endpoints used by the sidebar.

## Endpoints

### Categories
- `GET /categories` — list all categories (tree structure)
- `POST /categories` — create category
- `PUT /categories/:id` — rename / reparent
- `DELETE /categories/:id` — delete (move children to parent)

### Tags
- `GET /tags` — list all tags with bookmark counts
- `POST /tags` — create tag
- `DELETE /tags/:id` — remove tag (detach from bookmarks)
- `POST /bookmarks/:id/tags` — attach tag to bookmark
- `DELETE /bookmarks/:id/tags/:tagId` — detach tag

## Acceptance Criteria

- [x] Categories support parent_id for nesting (max 3 levels)
- [x] Tag list returns count of bookmarks per tag
- [x] Category list returns count of bookmarks per category
- [x] Deleting a category does not delete its bookmarks
- [x] Auto-created tags from LLM enrichment go through this API
- [x] Frontend sidebar connects to these endpoints (replaces mock data)
