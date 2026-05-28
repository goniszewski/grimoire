# TASK-077: Fresh-Host Installer Matrix Evidence

**Phase:** MVP release closeout
**Priority:** high
**Status:** todo
**Area:** QA / installer / release validation

## Description

Rerun the supported MVP installer matrix on fresh hosts, test users, or VMs and
record release-path evidence for install, health, autostart, upgrade, uninstall,
and purge behavior.

## Scope

1. Validate macOS 12+ arm64 on a fresh profile, test user, or VM when
   available.
2. Validate macOS 12+ x64 on Intel hardware or an x64 macOS VM when available.
3. Rerun Ubuntu 24.04 LTS and Debian 12 Linux systemd-user matrix validation.
4. Confirm each target can install from release artifacts, report
   `version: "0.1.0-beta"` from `/health`, register autostart, upgrade over an
   existing install, uninstall while preserving data, and purge only when
   explicitly requested.
5. Update `docs/installer-matrix-validation.md` with host details, commands,
   output summaries, deviations, and skipped targets.

## Acceptance Criteria

- [ ] Every supported matrix target has fresh evidence or an explicit hardware
      availability note.
- [ ] macOS x64 is validated or remains clearly documented as unavailable.
- [ ] Linux Ubuntu 24.04 and Debian 12 matrix checks pass from release
      artifacts.
- [ ] Upgrade and uninstall validation preserve user data by default.
- [ ] `docs/installer-matrix-validation.md` reflects the new evidence.

## Dependencies

- Should follow TASK-076 when validating published artifacts.

## Notes

- This task may require hardware outside the current workspace. Record exact
  blockers instead of silently narrowing the support claim.
