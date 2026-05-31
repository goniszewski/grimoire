# TASK-091: Bookmark Open Metrics

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Every user-triggered open increments the count once, with no debounce or
      collapse window.
- [ ] Last-opened timestamp updates on every open.
- [ ] Cards, detail, search, related, category, and tag surfaces use the same
      tracking path.
- [ ] Passive renders and copy-url actions do not increment open metrics.
- [ ] Metrics are available to sorting/filtering/export tasks.
- [ ] Tests cover open tracking and avoid double-counting.

## Dependencies

- Coordinates with TASK-115, TASK-116, and TASK-111.
