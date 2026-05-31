# TASK-114: Library Pagination

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
**Area:** library / frontend / daemon
**Source:** PAR-043
**Labels:** grimoire-parity, pagination, library

## Description

Add explicit UI pagination backed by existing daemon pagination.

## Scope

1. Add explicit pagination controls; do not implement infinite scroll in this
   batch.
2. Use daemon pagination for library, search, category detail, tag detail, and
   domain lists where applicable.
3. Define page size behavior and total-count display.
4. Reset or clear cross-page selection predictably when page/filter/sort changes.
5. Add loading, empty, empty-page recovery, and error states for page
   transitions.

## Acceptance Criteria

- [ ] Library UI can navigate beyond the first daemon result page.
- [ ] Search and filtered lists respect pagination.
- [ ] Selection and bulk actions reset or clear predictably across page changes.
- [ ] Page size is user-visible or locally configurable.
- [ ] Empty pages after filter/delete changes recover to a valid page.
- [ ] Frontend and e2e tests cover pagination behavior.

## Dependencies

- Coordinates with TASK-096, TASK-099, TASK-115, and TASK-117.
