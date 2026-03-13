# TASK-030: Daemon Integration Tests

**Status:** backlog
**Priority:** medium
**Phase:** M4
**Area:** backend / testing

## Description

End-to-end tests for the daemon API using a real in-memory SQLite database and a test Hono app instance. No network calls to real URLs — use mock fetch/extractor responses.

## Test scenarios

**Ingestion flow**
- `POST /bookmarks` with a mocked URL → job enqueued → pipeline runs (mocked fetch/extract/enrich) → `GET /bookmarks/:id` returns status `indexed`

**Import flow**
- Upload a minimal Netscape HTML file to `POST /import` → all bookmarks created → SSE progress events received

**Search**
- Ingest a bookmark with known title → `GET /search?q=<title>&mode=keyword` returns it
- Ingest bookmark with embedding → `GET /search?q=...&mode=semantic` returns it (mock embedding similarity)

**Category CRUD**
- Create → rename → reparent → delete via API; verify state at each step

**Tag CRUD**
- Create tag → attach to bookmark → detach → delete; verify counts

**Archive flow**
- Archive bookmark → absent from `GET /bookmarks` → present in `GET /bookmarks?archived=true`
- Unarchive → back in `GET /bookmarks`

**Trash flow**
- `DELETE /bookmarks/:id` → present in `GET /trash` → `POST /bookmarks/:id/restore` → back in `GET /bookmarks`
- `DELETE /bookmarks/:id/permanent` → gone from DB
- Purge job → bookmarks with `deleted_at` > 30 days are removed

## Setup

- Spin up `createApp(deps)` with test deps (in-memory SQLite, mocked extractor)
- Use `bun test` with `supertest`-style HTTP calls against the Hono app
- Reset DB state between test files

## Acceptance Criteria

- [ ] All scenarios pass with `bun test`
- [ ] No real HTTP requests made to external URLs
- [ ] Tests run in < 10 seconds total
