# TASK-140: Real Browser-Daemon Core Journey E2E

**Phase:** Product reset and public beta
**Priority:** critical (P0)
**Status:** backlog
**Area:** testing / E2E / runtime

## Description

Add a browser test that exercises the real daemon instead of intercepting API
requests. This should prove the actual save, process, retrieve, restart, and
capture boundary used by beta users.

## Scope

1. Start an isolated daemon with a temporary home, database, data directory, and
   loopback port from the Playwright workflow.
2. Run the built or development frontend against that daemon.
3. Cover first launch, demo/tour dismissal, URL save, keyword retrieval,
   bookmark detail, archive/restore, import/export, and trustworthy capture.
4. Assert data survives a daemon restart.
5. Keep external network and AI responses deterministic without mocking the
   Little Imp HTTP boundary.
6. Capture useful logs, traces, and temp-root paths on failure.

## Acceptance Criteria

- [ ] At least one Playwright project uses a real isolated daemon.
- [ ] The core save-to-retrieve journey crosses the real frontend/API/database boundary.
- [ ] Restart persistence and browser capture are covered.
- [ ] The test is stable in CI and fails with actionable diagnostics.

## Dependencies

- TASK-136 (CI and acceptance integrity).
- TASK-138 (trustworthy browser capture).

## Notes

- Keep mocked UI tests for fast state coverage; this task adds the missing integration layer.
