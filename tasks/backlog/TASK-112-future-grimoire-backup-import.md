# TASK-112: Future Grimoire Backup Import

**Phase:** Grimoire parity
**Priority:** low
**Status:** deferred
**Area:** migration / tooling
**Source:** PAR-041
**Labels:** grimoire-parity, migration, tooling

## Description

Record deferred future tooling for importing from Grimoire backup data after the
browser/Netscape import and JSON/CSV export parity work is stable.

## Scope

1. Keep direct PocketBase migration and Grimoire backup import out of the
   current parity implementation batch.
2. Reopen after the Grimoire backup data shape is known and the import preview,
   duplicate handling, remapping, and result report flows are stable.
3. Future scope should map Grimoire backup bookmarks, categories, tags,
   starred-to-pinned state, read-later/flag state where available, metadata, and
   media references.
4. Future tooling should reuse the normal import preview, duplicate handling,
   remapping, and result report flows.

## Acceptance Criteria

- [x] Deferred for this parity batch.
- [x] Current import work focuses on browser/Netscape import and JSON/CSV export
      parity.
- [ ] Future task starts from documented Grimoire backup data shape and field
      mapping.

## Dependencies

- Deferred until TASK-108, TASK-109, TASK-110, TASK-120, and approved bookmark
  parity fields are stable.
