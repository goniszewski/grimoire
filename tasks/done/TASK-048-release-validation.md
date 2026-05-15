# TASK-048: Release Validation and Docker Restore Hardening

**Status:** done
**Priority:** high
**Phase:** v0-beta release validation
**Area:** release management, backup/restore, docker, ci, installer

## Description

Validate the `0.1.0-beta` release checklist and fix release-blocking failures discovered during validation.

This task covers local quality gates, E2E tests, Docker health checks, backup/restore smoke testing, documentation link and release-target audits, and CI install compatibility.

## Current evidence

- `tasks/README.md` identified release validation as the remaining work before tagging `0.1.0-beta`.
- Docker restore failed because the daemon attempted to create rollback data beside `/data`, which is not writable by the non-root container user.
- GitHub Actions `Quality Gates` failed before tests because `npm ci` rejected an out-of-sync `package-lock.json`.
- The shipped restore docs described the old rollback directory shape.
- May 15, 2026 local release validation completed `npm run check`, `npm run test:e2e`, Docker Compose build/start/health, documentation release-target and link audits, and an isolated macOS installer install/upgrade/uninstall/purge smoke.
- GitHub Actions `Quality Gates` passed for commit `a28bf9d62436fe12c7c19cfa6af5c5f72f8ad6aa`, including lint/types/tests/docs/build, Playwright E2E, and Docker build/health jobs.
- May 15, 2026 Linux installer validation passed in an Ubuntu 24.04 Docker container running systemd as PID 1. The smoke ran `daemon/install.sh` as a non-root `smoke` user with a real `systemctl --user` manager, verified install, health, service enablement, upgrade with data preservation, user-manager restart autostart, uninstall with data preservation, and purge.

## Dependencies / sequencing

- Run after TASK-047, once release documentation and hardening tasks are complete.
- Linux systemd user installer smoke uses a containerized Ubuntu systemd environment from this macOS workspace.

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
10. Smoke-test macOS native install, health, upgrade, uninstall, and purge in an isolated temporary home.
11. Confirm the latest GitHub Actions quality-gate run is green for the release commit.
12. Smoke-test Linux systemd user install, health, upgrade, autostart, uninstall, and purge in a containerized Ubuntu systemd environment.

## Acceptance Criteria

- [x] `npm ci` succeeds with the checked-in lockfile.
- [x] `npm run check` passes.
- [x] `npm run test:e2e` passes.
- [x] Docker Compose container reports healthy and `/health` returns `version: "0.1.0-beta"`.
- [x] Docker Compose binds the host port to `127.0.0.1:3210:3210` and preserves the named data volume after `docker compose down`.
- [x] Docker backup snapshot contains `snapshot.db`, `manifest.json`, `checksums.sha256`, and `data/settings.json`.
- [x] Docker restore returns `restart_required: true` and creates rollback data under `DATA_DIR/restore-rollbacks/`.
- [x] Restored Docker data is readable after daemon restart.
- [x] macOS installer smoke covers install, health, upgrade with data preserved, uninstall with data preserved, and purge.
- [x] Linux systemd user installer smoke covers install, health, service enablement, upgrade with data preserved, user-manager restart autostart, uninstall with data preserved, and purge.
- [x] GitHub Actions `Quality Gates` is green for lint, types, tests, API docs drift, build, E2E, and Docker validation.
- [x] README and backup design docs describe the shipped rollback path.
- [x] Release target and local markdown link audits pass.

## Remaining Outside This Workspace

- Full distro matrix coverage on separate Linux hosts or VMs remains future release hardening; the `0.1.0-beta` systemd user installer path has containerized Ubuntu smoke evidence.
