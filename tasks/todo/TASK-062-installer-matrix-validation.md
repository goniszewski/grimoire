# TASK-062: Installer Matrix Validation

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
**Area:** release validation / QA

## Description

Expand installer validation beyond the existing macOS smoke and Ubuntu systemd
container evidence. MVP readiness needs confidence that release artifacts install
and upgrade on the supported native environments.

## Scope

1. Define the supported MVP installer matrix for macOS and Linux.
2. Validate clean install, health check, autostart registration, upgrade,
   uninstall, and purge paths for each supported target.
3. Validate the one-command installer path once TASK-060 is available.
4. Validate release archive installation once TASK-059 is available.
5. Record command output, host details, and any deviations.
6. Add automation where practical and document manual validation where hardware
   or OS access is required.

## Acceptance Criteria

- [ ] The release checklist names the exact supported MVP OS matrix.
- [ ] macOS validation covers the available architecture(s) and LaunchAgent
      behavior.
- [ ] Linux validation covers Ubuntu or Debian plus at least one additional
      modern systemd user environment when available.
- [ ] Install, upgrade, uninstall, purge, and health checks are verified for
      each supported target.
- [ ] Validation evidence is recorded in docs or task completion notes.

## Dependencies

- Should follow TASK-059 and TASK-060 for artifact and one-command validation.

## Notes

- If a matrix target is unavailable locally, document the gap explicitly rather
  than implying it was tested.
