# TASK-086: Parity Task Conversion Criteria And Labels

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** project management / documentation
**Source:** PAR-003
**Labels:** grimoire-parity, task-board, planning

## Description

Keep the parity proposal worksheet and task board aligned as approved parity
rows are converted into implementation tasks with clear acceptance criteria and
labels.

## Scope

1. Maintain a repeatable convention for converting approved parity rows into
   task files.
2. Include source proposal IDs, parity labels, phase, priority, area, and
   acceptance criteria in every generated task.
3. Keep `tasks/README.md` and the parity worksheet cross-linked after each
   conversion pass.
4. Capture non-approved rows as pending, deferred, or rejected decisions rather
   than silently dropping them.

## Acceptance Criteria

- [x] Approved parity rows map to concrete task files or an explicit completed
      conversion note.
- [x] Each task includes `Source` and `Labels` metadata.
- [x] Task board index links every active parity backlog task.
- [x] Rejected and deferred rows remain visible in the worksheet.
- [x] Future parity approval passes can follow the same format.

## Dependencies

- Depends on product approval markers in
  `docs/parity/grimoire-parity-task-proposals.md`.

## Notes

- Completed during the approved parity conversion pass. Future worksheet updates
  should preserve the same `Source`, `Labels`, task-board link, and explicit
  deferred/rejected-row convention.
