# TASK-070: Installed-App E2E Smoke Suite

**Phase:** MVP readiness
**Priority:** high
**Status:** done
**Area:** testing / release validation

## Description

Add an artifact-level smoke suite that validates Little Imp as an installed app,
not only as a development server or Docker container. MVP release confidence
should prove that the packaged install path can run core user journeys.

## Scope

1. Define a temporary isolated home/data directory strategy for installed-app
   smoke tests.
2. Install from a release archive or one-command installer when available.
3. Start the daemon through the installed service or a controlled test process.
4. Use Playwright or API-level checks to validate core journeys:
   save, search, import, export, Settings, backup, restore, update check, and
   health.
5. Validate that data survives upgrade and uninstall-without-purge.
6. Add the smoke suite to CI if practical, or document it as a release-blocking
   local command.

## Acceptance Criteria

- [x] A repeatable command validates the installed artifact in an isolated
      environment.
- [x] The suite covers save, search, import/export, Settings, backup/restore,
      update check, and daemon health.
- [x] The suite verifies data preservation across upgrade and uninstall without
      purge.
- [x] Failure output points to logs and diagnostics.
- [x] Release checklist includes the installed-app smoke command.

## Dependencies

- Should follow TASK-059 and TASK-060.
- Can share validation coverage with TASK-062.

## Notes

- Keep this suite focused on MVP confidence. It should not duplicate every unit
  or integration test.

## Completion Notes

- Added `npm run test:e2e:installed`, which packages release artifacts and runs
  `scripts/installed-app-smoke.ts`.
- The smoke unpacks the current-platform release archive into an isolated temp
  home after preflighting archive paths, verifies payload checksums, rejects
  unsupported payload entry types, installs daemon/frontend/CLI runtime files,
  starts the daemon on a random loopback port, and exercises health, save,
  keyword search, import persistence, export, Settings, backup verification,
  restore, post-restore restart, packaged CLI update check, upgrade data
  preservation, and uninstall-without-purge behavior.
- The runner prints a diagnostics temp root plus `daemon.log` and
  `daemon.error.log` paths when a run fails or when `--keep-temp` is used.
- Updated the release checklist with the installed-app smoke command.

## Verification

- `npm run test:e2e:installed` passed locally on macOS.
- `npx tsc --noEmit` passed locally.
- `npm run check` passed locally.
