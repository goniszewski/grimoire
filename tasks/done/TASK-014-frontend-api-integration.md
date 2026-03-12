# TASK-014: Frontend API Integration (Replace Mocks)

**Status:** done
**Priority:** high
**Phase:** v0-alpha
**Area:** frontend

## Description

Wire the existing mocked React frontend to the real `littleimpd` API. All mock data and local state should be replaced with API calls to `http://127.0.0.1:3210`.

## Components to Wire

| Component | Mock to Replace | Real Endpoint |
| --------- | --------------- | ------------- |
| `SearchBar` | mock-bookmarks.ts | `GET /search?q=` |
| `BookmarkCard` / list | mock data | `GET /bookmarks` |
| `BookmarkDetail` | mock data | `GET /bookmarks/:id` |
| `AddBookmarkDialog` | local state | `POST /bookmarks` |
| `ImportDialog` | mock handler | `POST /import` |
| `ExportMenu` | mock handler | `GET /export?format=` |
| `AppSidebar` categories | hardcoded | `GET /categories` |
| `AppSidebar` tags | hardcoded | `GET /tags` |
| `PreferencesDialog` | local state | `GET/PUT /settings` |

## Acceptance Criteria

- [x] `use-bookmark-store.ts` hook replaced with real API client (`use-bookmarks.ts`)
- [x] API client module created at `src/lib/api.ts`
- [x] Loading states shown while API requests are in-flight (TanStack Query `isLoading`)
- [x] Error states handled gracefully (daemon offline, network error)
- [x] Daemon offline banner shown if `127.0.0.1:3210` unreachable
- [x] Search results update on each keystroke (debounced, 300ms)
- [x] Pipeline status badge on BookmarkCard reflects real status
- [x] `PipelineBadge` polls `GET /bookmarks/:id/status` every 3s until indexed
