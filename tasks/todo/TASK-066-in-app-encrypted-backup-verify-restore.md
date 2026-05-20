# TASK-066: In-App Encrypted Backup Verify and Restore

**Phase:** MVP readiness
**Priority:** medium
**Status:** todo
**Area:** backup / frontend

## Description

Complete the in-app encrypted backup recovery path. Settings can create
encrypted packages today, while encrypted package verification and restore are
CLI workflows. MVP users should be able to verify and restore encrypted packages
from the app where browser file access and daemon file access make that
practical.

## Scope

1. Define the supported in-app file selection model for encrypted packages.
2. Add daemon API support for verifying an encrypted package path or uploaded
   package if the current architecture supports it safely.
3. Add daemon API support for restoring an encrypted package with explicit
   confirmation and password entry.
4. Ensure passwords are never stored and are redacted from logs and errors.
5. Reuse existing encrypted package verification and restore code paths.
6. Surface restart-required and rollback information after restore.
7. Add focused daemon, contract, and Settings tests.

## Acceptance Criteria

- [ ] Settings can verify an encrypted backup package without restoring it.
- [ ] Settings can restore an encrypted backup package with explicit destructive
      confirmation.
- [ ] Passwords are required per operation and are never persisted.
- [ ] Wrong password or corrupt package errors occur before any restore attempt.
- [ ] Restore reports rollback path and `restart_required: true`.
- [ ] API docs and frontend types reflect the new endpoints or request shapes.

## Dependencies

- Should coordinate with TASK-067 for post-restore restart guidance.

## Notes

- If browser security constraints make arbitrary package upload impractical,
  document the supported local-path model clearly and keep CLI as the fallback.
