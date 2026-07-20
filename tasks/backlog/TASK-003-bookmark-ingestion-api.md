# TASK-003: Bookmark Ingestion API

**Status:** backlog
**Priority:** high
**Phase:** v0-alpha
**Area:** backend / api

## Description

Implement the REST API endpoints for saving and managing bookmarks.

## Endpoints

- `POST /bookmarks` — save a URL, enqueue pipeline job, return immediately
- `GET /bookmarks` — list bookmarks with pagination, filter by tag/domain/category/date
- `GET /bookmarks/:id` — get single bookmark with full content
- `PUT /bookmarks/:id` — update title, tags, category manually
- `DELETE /bookmarks/:id` — soft delete bookmark
- `GET /bookmarks/:id/status` — pipeline processing status

## Acceptance Criteria

- [ ] POST creates bookmark record with `saved` status immediately
- [ ] Response includes bookmark ID before pipeline completes
- [ ] List supports pagination (cursor or offset)
- [ ] List supports filter params: `tag`, `domain`, `category`, `date_from`, `date_to`
- [ ] All endpoints return consistent JSON envelope
- [ ] Error responses follow RFC 7807 problem+json format
- [ ] Input validation rejects malformed URLs
