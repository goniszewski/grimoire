# TASK-067: Post-Restore Restart and Recovery UX

**Phase:** MVP readiness
**Priority:** medium
**Status:** todo
**Area:** backup / operations / frontend

## Description

Improve the user experience after restore. The current restore flow safely
replaces the database and returns `restart_required: true`, but MVP users need
clear next steps, restart guidance, health polling, and rollback instructions.

## Scope

1. Review all restore entry points: Settings, daemon API, and packaged CLI.
2. Standardize restore success output with rollback path, restart requirement,
   and platform-specific restart command.
3. Add Settings UI state that tells the user the daemon must be restarted before
   continuing.
4. Poll `/health` after restart and show when the app is usable again.
5. Add a rollback instructions view or CLI output using the generated rollback
   path.
6. Update backup documentation and release checklist.

## Acceptance Criteria

- [ ] Settings clearly blocks normal app interactions after restore until the
      daemon is restarted or healthy again.
- [ ] CLI restore output includes the correct restart command for macOS or
      Linux where detectable.
- [ ] Rollback path and recovery instructions are visible after restore.
- [ ] Health polling confirms when the restored daemon is usable.
- [ ] Documentation matches the shipped restart and rollback behavior.

## Dependencies

- Coordinates with TASK-066 if encrypted restore is added to Settings.

## Notes

- Do not make restore seamless by weakening the current safety model. Clear
  restart guidance is acceptable for MVP.
