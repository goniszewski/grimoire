# TASK-048: Release Validation and Docker Restore Hardening

**Status:** done
**Priority:** high
**Phase:** v0-beta release validation
**Area:** release management, backup/restore, docker, ci

## Description

Validate the `0.1.0-beta` release checklist and fix release-blocking failures discovered during validation.

This task covers local quality gates, E2E tests, Docker health checks, backup/restore smoke testing, documentation link and release-target audits, and CI install compatibility.

## Current evidence

- `tasks/README.md` identified release validation as the remaining work before tagging `0.1.0-beta`.
- Docker restore failed because the daemon attempted to create rollback data beside `/data`, which is not writable by the non-root container user.
- GitHub Actions `Quality Gates` failed before tests because `npm ci` rejected an out-of-sync `package-lock.json`.
- The shipped restore docs described the old rollback directory shape.

## Dependencies / sequencing

- Run after TASK-047, once release documentation and hardening tasks are complete.
- Native macOS/Linux installer smoke tests still require clean host or VM environments outside this local workspace.

## Work

1. Run the documented quality gate and API docs drift check.
2. Run Playwright E2E.
3. Build and run Docker Compose, confirm loopback binding and health.
4. Create and restore a backup through the container API.
5. Fix Docker restore rollback placement so non-root containers can restore safely.
6. Add a regression test for restore when `DATA_DIR` parent is not writable.
7. Update restore rollback documentation.
8. Update `package-lock.json` so `npm ci` matches `package.json`.
9. Audit release target docs and local markdown links.

## Acceptance Criteria

- [x] `npm ci` succeeds with the checked-in lockfile.
- [x] `npm run check` passes.
- [x] `npm run test:e2e` passes.
- [x] Docker Compose container reports healthy and `/health` returns `version: "0.1.0-beta"`.
- [x] Docker backup snapshot contains `snapshot.db`, `manifest.json`, `checksums.sha256`, and `data/settings.json`.
- [x] Docker restore returns `restart_required: true` and creates rollback data under `DATA_DIR/restore-rollbacks/`.
- [x] Restored Docker data is readable after daemon restart.
- [x] README and backup design docs describe the shipped rollback path.
- [x] Release target and local markdown link audits pass.
