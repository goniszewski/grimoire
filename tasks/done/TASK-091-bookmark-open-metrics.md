# TASK-091: Bookmark Open Metrics

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** bookmarks / analytics
**Source:** PAR-010
**Labels:** grimoire-parity, bookmarks, metrics

## Description

Track opened count and last-opened timestamp when users open bookmark URLs from
Little Imp surfaces.

## Scope

1. Add persistence for `openedCount` and `lastOpenedAt`.
2. Increment on every user-triggered open action, including repeated clicks.
3. Route all bookmark open actions through a shared frontend helper or API call.
4. Update cards, detail, search, related-bookmark surfaces, and category/tag
   pages.
5. Expose metrics for sorting, filtering, import/export, and docs where needed.

## Acceptance Criteria

- [x] Every user-triggered open increments the count once, with no debounce or
      collapse window.
- [x] Last-opened timestamp updates on every open.
- [x] Cards, detail, search, related, category, and tag surfaces use the same
      tracking path.
- [x] Passive renders and copy-url actions do not increment open metrics.
- [x] Metrics are available to sorting/filtering/export tasks.
- [x] Tests cover open tracking and avoid double-counting.

## Dependencies

- Coordinates with TASK-115, TASK-116, and TASK-111.

## Work Notes

- May 31, 2026: Started as the next actionable Grimoire parity task because
  TASK-078 and TASK-079 are externally blocked, TASK-090 is rejected, and
  TASK-091 unlocks later sorting, filtering, export, and regression-test work.
- Added failing coverage first for user-triggered open tracking, export fields,
  the frontend API client, and card/detail open actions.
- Implemented `opened_count`, `last_opened_at`, `POST /bookmarks/:id/open`,
  shared frontend open tracking, export fields, generated API docs, e2e mock
  parity, and a task report at
  `docs/task-reports/2026/05/2026-05-31-task-091-bookmark-open-metrics/index.html`.
- Verification completed: `npm run lint`, `npm run type-check`, `npm run test`,
  `npm run test:daemon`, `npm run docs:api:check`, `npm run build`, and
  `npm run test:e2e`.
- May 31, 2026 review follow-up: restored native external-link behavior for
  detail URL/Open actions while preserving metric tracking, updated visible
  open metrics immediately after successful writes, added regression coverage,
  and reran lint, type, unit, daemon, docs, build, and e2e checks.
