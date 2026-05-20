# TASK-070: Installed-App E2E Smoke Suite

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
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

- [ ] A repeatable command validates the installed artifact in an isolated
      environment.
- [ ] The suite covers save, search, import/export, Settings, backup/restore,
      update check, and daemon health.
- [ ] The suite verifies data preservation across upgrade and uninstall without
      purge.
- [ ] Failure output points to logs and diagnostics.
- [ ] Release checklist includes the installed-app smoke command.

## Dependencies

- Should follow TASK-059 and TASK-060.
- Can share validation coverage with TASK-062.

## Notes

- Keep this suite focused on MVP confidence. It should not duplicate every unit
  or integration test.
