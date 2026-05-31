# TASK-089: Read Later Bookmark Flag

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** bookmarks / frontend / daemon
**Source:** PAR-008
**Labels:** grimoire-parity, bookmarks, api, ui

## Description

Add a first-class read-later bookmark flag while mapping Grimoire starred or
favorite state to Little Imp's existing pinned state.

## Scope

1. Add schema, repository, API contract, and route support for a boolean
   `readLater` field.
2. Render read-later as a tag-like badge/chip labelled `Read Later` in lists
   and detail.
3. Add detail controls, bulk actions, filters, and optimistic UI handling.
4. Preserve existing pin semantics and document that pinned maps to
   Grimoire-style starred/favorite state.
5. Cover import/export and API docs for both pinned/starred mapping and
   read-later state.

## Acceptance Criteria

- [x] Bookmark records persist `readLater` separately from `pinned`.
- [x] Grimoire starred/favorite data maps to `pinned`, not to a new field.
- [x] Frontend list, detail, and bulk flows can read and update the state.
- [x] Filters and visible badges distinguish pinned/starred from read-later.
- [x] API contract, generated docs, and shared types include the field.
- [x] Focused daemon and frontend tests cover mutations and rendering.

## Dependencies

- Depends on the decision captured in PAR-007: starred maps to pinned, read
  later is the new parity flag.

## Work Notes

- May 31, 2026: Implemented persisted `read_later` support across SQLite,
  repository updates, bookmark/search filters, API contract/docs, JSON/CSV
  export fields, frontend normalization, card/detail badges and controls, bulk
  actions, filtered export URLs, and the library read-later filter. Existing
  `is_pinned` semantics remain separate and documented as the Grimoire
  starred/favorite mapping.
- May 31, 2026: Added a visual task report at
  `docs/task-reports/2026/05/2026-05-31-task-089-read-later-bookmark-flag/index.html`.
- May 31, 2026: Review hardening fixed export `read_later` validation,
  documented `true`/`false` and `1`/`0` filter values, aligned the Playwright
  mock daemon with list/search/export filtering, added read-later export e2e
  coverage, and invalidated active search caches after read-later updates.
  Verification passed with focused daemon tests, focused frontend tests,
  lint, type checks, generated API docs check, production build, Playwright e2e,
  and whitespace checks.
