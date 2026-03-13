# TASK-029: Daemon Unit Tests

**Status:** backlog
**Priority:** medium
**Phase:** M4
**Area:** backend / testing

## Description

Establish unit test coverage for the daemon's core modules using Bun's built-in test runner.

## Test suites

**`JobQueue`** (`src/queue.ts`)
- Enqueue a job → status is `pending`
- Dequeue → status transitions to `running`
- Complete job → status is `done`
- Fail job → status is `failed`, error message stored

**`BookmarkRepository`** (`src/db/repositories/bookmark-repository.ts`)
- Create bookmark → row exists with correct fields
- Update title, category, tags, notes, is_pinned, is_archived, read_at
- Soft delete (trash) → `deleted_at` set; not returned by default list query
- Restore → `deleted_at` cleared; returned by list query again
- FTS sync: create bookmark → FTS row exists; update title → FTS row updated; delete → FTS row removed
- Cascade: delete bookmark → content row gone, tag junction rows gone

**`CategoryRepository`** (`src/db/repositories/category-repository.ts`)
- Create root category
- Create child category (depth 1, 2)
- Reject creation at depth 3+ (max depth enforced)
- Rename category
- Reparent category
- Prevent circular reparent
- Delete category → children reparented to grandparent

**Search** (`src/routes/search.ts` / search logic)
- Keyword search returns matching bookmarks
- Hybrid ranking weights applied correctly (can use mock scores)

**Trash purge** (scheduler purge job)
- Bookmarks with `deleted_at` older than 30 days are hard-deleted
- Bookmarks with `deleted_at` within 30 days are kept

## Setup

- Use Bun's built-in `test` runner (`bun test`)
- Use in-memory SQLite for all repository tests (`:memory:`)
- Run migrations against in-memory DB before each test suite

## Acceptance Criteria

- [ ] All suites pass with `bun test`
- [ ] No real filesystem or network calls in unit tests
- [ ] Coverage reported via `bun test --coverage`
