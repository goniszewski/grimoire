# TASK-124: Public-Artifact Installed-App E2E Validation

**Phase:** Release unblocking
**Priority:** critical (P0)
**Status:** backlog (blocked on repository being public)
**Area:** release / testing / E2E

## Description

Complete TASK-081 by running the public-artifact installed-app E2E smoke against the published release. This validates the full user-facing path: download, verify, install, save, search, import, export, backup, restore, update check, upgrade, and uninstall.

## Scope

1. Run `npm run test:e2e:installed:published`.
2. Confirm the script downloads `v0.1.0-beta` from the public release URL.
3. Confirm the archive SHA-256 checksum is verified.
4. Confirm the detached GPG signature is verified when published.
5. Confirm the installed-app smoke runs in an isolated temporary home.
6. Confirm the smoke covers:
   - daemon health check
   - save a bookmark
   - keyword search
   - HTML bookmark import
   - JSON/CSV export
   - Settings access
   - local backup creation
   - backup verification
   - restore with restart
   - update availability check
   - upgrade data preservation
   - uninstall without purge
7. If the smoke fails, inspect the temp root (especially `daemon.log` and `daemon.error.log`) and record the failure.

## Acceptance Criteria

- [ ] The published archive downloads and verifies correctly.
- [ ] The installed-app smoke passes in an isolated temporary home.
- [ ] All covered user flows complete without unexpected errors.

## Blocked By

- Making the GitHub repository public so the release archive URL is accessible to unauthenticated downloads.

## Dependencies

- TASK-076 (signed release artifact publication) — complete.
- TASK-081 (public-artifact installed-app E2E) — in-progress, blocked on same issue.
- TASK-122 (public distribution unblocking) — must complete first.

## Notes

- Run immediately after TASK-122 since both depend on the same artifact visibility precondition.
