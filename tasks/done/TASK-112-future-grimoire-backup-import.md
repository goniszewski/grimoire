# TASK-112: Future Grimoire Backup Import

**Phase:** Grimoire parity
**Priority:** low
**Status:** done
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
- [x] Future task starts from documented Grimoire backup data shape and field
      mapping.

## Dependencies

- Deferred until TASK-108, TASK-109, TASK-110, TASK-120, and approved bookmark
  parity fields are stable.

## Work Notes

- June 2, 2026: Rechecked TASK-078 and TASK-079 public artifact blockers before
  selecting this task. The tag-qualified installer URL and both published
  archive URLs still returned unauthenticated `404`, so release validation
  remains externally blocked.
- Added `docs/parity/grimoire-backup-import-shape.md` as the future
  implementation handoff. It records the inspected Grimoire source checkout,
  legacy PocketBase backup ZIP shape, current Grimoire SQLite table shape,
  Little Imp field mapping, unresolved product decisions, and verification
  gates for a future direct importer.
- Kept direct Grimoire/PocketBase backup import out of the current runtime
  scope. Future implementation should reuse Little Imp's existing import
  preview, duplicate policy, category/tag remapping, commit, and result report
  flow instead of restoring data directly into SQLite.
- Moved TASK-112 to done as a completed deferral and planning record. The
  actual import tooling remains future scope until explicitly reopened.
