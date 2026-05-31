# TASK-108: Pre Import Review

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Users can preview an import before data changes are committed.
- [ ] Preview summarizes folders, tags, duplicate classes, invalid URLs, and
      private URL skips.
- [ ] Preview exposes the approved duplicate handling choices from TASK-120.
- [ ] Canceling preview leaves library data unchanged.
- [ ] Confirming import uses the previewed decisions.
- [ ] Tests cover preview, cancel, confirm, and malformed files.

## Dependencies

- Depends on TASK-120.
- Coordinates with TASK-107, TASK-109, TASK-110, and TASK-113.
