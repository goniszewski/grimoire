# TASK-089: Read Later Bookmark Flag

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Bookmark records persist `readLater` separately from `pinned`.
- [ ] Grimoire starred/favorite data maps to `pinned`, not to a new field.
- [ ] Frontend list, detail, and bulk flows can read and update the state.
- [ ] Filters and visible badges distinguish pinned/starred from read-later.
- [ ] API contract, generated docs, and shared types include the field.
- [ ] Focused daemon and frontend tests cover mutations and rendering.

## Dependencies

- Depends on the decision captured in PAR-007: starred maps to pinned, read
  later is the new parity flag.
