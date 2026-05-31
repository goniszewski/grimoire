# TASK-110: Import Result Report

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
**Area:** import / frontend / daemon
**Source:** PAR-039
**Labels:** grimoire-parity, import, ui

## Description

Add an import result report with created, updated, skipped, failed, and warning
rows.

## Scope

1. Define result data returned by the import pipeline.
2. Show summary counts and row-level details after import completion.
3. Include warnings for active duplicates, archived restores, trashed restores,
   invalid URLs, private URLs, remapping, and partial failures.
4. Provide a durable enough report for users to review immediately after import.

## Acceptance Criteria

- [ ] Import completion shows created, updated, skipped, restored, merged,
      failed, and warning counts.
- [ ] Users can inspect row-level failures and warnings.
- [ ] Result data includes category and tag mapping effects.
- [ ] Progress and result states are clearly separated.
- [ ] Tests cover successful, partial, skipped, and failed import reports.

## Dependencies

- Depends on TASK-120.
- Coordinates with TASK-108, TASK-109, and TASK-113.
