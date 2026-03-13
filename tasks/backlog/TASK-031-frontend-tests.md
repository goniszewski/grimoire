# TASK-031: Frontend Tests

**Status:** done
**Priority:** medium
**Phase:** M4
**Area:** frontend / testing

## Description

Unit and component tests for the React frontend using Vitest, and a key E2E journey using Playwright.

## Unit tests (Vitest)

**Hooks**
- `use-bookmarks`: filtering, sorting, pagination logic with mocked API responses
- `use-preferences`: reads/writes from localStorage; default values applied correctly

**Utilities**
- Any pure functions in `src/lib/` (formatters, URL helpers, search param builders)

## Component tests (Vitest + Testing Library)

**`BookmarkCard`**
- Renders title, domain, tags, pipeline badge
- Calls correct handler on pin / archive / trash actions
- Shows read indicator when `read_at` is set

**`BookmarkDetailContent`**
- Renders notes section with Markdown
- Edit notes → textarea appears → confirm saves → read mode returns with new content
- Inline title edit saves correctly

**`AppSidebar`**
- Renders category tree
- Rename inline edit fires correct mutation
- Delete triggers confirmation dialog

## E2E tests (Playwright)

**Core journey:**
1. Open app
2. Add bookmark via `AddBookmarkDialog`
3. Bookmark appears in list
4. Open bookmark detail
5. Edit notes → save
6. Notes rendered as Markdown on reopen
7. Archive bookmark → disappears from main feed → appears in `/archive`
8. Restore from `/archive` → back in main feed
9. Trash bookmark → disappears → appears in `/trash`
10. Restore from `/trash` → back in main feed

## Setup

- Vitest config already scaffolded (`src/test/setup.ts`) — extend it
- Mock `fetch` / TanStack Query for unit/component tests
- Playwright tests run against a live daemon (or a fully mocked service worker)

## Acceptance Criteria

- [x] All Vitest tests pass with `bun run test` (or `npx vitest`)
- [x] Playwright E2E journey passes against local running app
- [x] No flaky tests
