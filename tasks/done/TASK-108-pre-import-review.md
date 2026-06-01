# TASK-108: Pre Import Review

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** import / frontend / daemon
**Source:** PAR-036
**Labels:** grimoire-parity, import, ui

## Description

Add pre-import review with detected folders, tags, duplicates, invalid URLs,
skipped private URLs, and estimated changes.

## Scope

1. Add a parse/preview phase that does not mutate library data.
2. Show detected folders, tags, active duplicates, archived duplicates, trashed
   duplicates, invalid URLs, private URLs, and estimated created/updated/
   skipped/restored counts.
3. Let users confirm or cancel before committing the import.
4. Let users select the duplicate policy defined in TASK-120.
5. Preserve streaming progress for the commit phase.

## Acceptance Criteria

- [x] Users can preview an import before data changes are committed.
- [x] Preview summarizes folders, tags, duplicate classes, invalid URLs, and
      private URL skips.
- [x] Preview exposes the approved duplicate handling choices from TASK-120.
- [x] Canceling preview leaves library data unchanged.
- [x] Confirming import uses the previewed decisions.
- [x] Tests cover preview, cancel, confirm, and malformed files.

## Dependencies

- Depends on TASK-120.
- Coordinates with TASK-107, TASK-109, TASK-110, and TASK-113.

## Work Notes

- Added a preview-first import dialog flow that calls the non-mutating
  `/import/preview` endpoint after file selection, shows estimated create,
  merge, restore, and skip counts, and requires explicit confirmation before
  committing.
- Added duplicate policy controls for active, archived, and trashed duplicate
  classes using the TASK-120 policy semantics, with preview estimates refreshed
  when the policy changes.
- Added preview details for detected row classes, folders, tags, parser
  warnings, and a scroll-contained row table for desktop and narrow layouts.
- Guarded pending preview responses so closing the dialog while a preview is in
  flight cannot reopen stale preview state later.
- Preserved the existing streaming import progress phase after confirmation and
  surfaced final created, merged, restored, and skipped counts.
- Added focused dialog coverage for preview, cancel, policy refresh, confirm,
  and malformed preview failure, and updated the business-requirements smoke to
  assert preview-before-commit behavior.
- Added the TASK-108 visual report at
  `docs/task-reports/2026/06/2026-06-01-task-108-pre-import-review/`.
