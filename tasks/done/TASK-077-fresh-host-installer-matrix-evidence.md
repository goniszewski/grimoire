# TASK-077: Fresh-Host Installer Matrix Evidence

**Phase:** MVP release closeout
**Priority:** high
**Status:** done
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

- [x] Every supported matrix target has fresh evidence or an explicit hardware
      availability note.
- [x] macOS x64 is validated or remains clearly documented as unavailable.
- [x] Linux Ubuntu 24.04 and Debian 12 matrix checks pass from release
      artifacts.
- [x] Upgrade and uninstall validation preserve user data by default.
- [x] `docs/installer-matrix-validation.md` reflects the new evidence.

## Dependencies

- Should follow TASK-076 when validating published artifacts.

## Notes

- This task may require hardware outside the current workspace. Record exact
  blockers instead of silently narrowing the support claim.

## Completion Notes

- Updated `docs/installer-matrix-validation.md` with May 29, 2026
  release-closeout evidence, host facts, release artifact checksums, Linux
  output summaries, and skipped macOS target notes.
- Verified signed local `0.1.0-beta` artifacts with
  `npm run release:validate -- --require-signatures` before running installer
  matrix validation.
- Reran `npm run installer:matrix:linux`; Ubuntu 24.04 LTS and Debian 12 both
  passed from `little-imp-0.1.0-beta-linux.tar.gz` mounted read-only from
  `release/`.
- Linux validation covered clean install, `/health` with
  `version: "0.1.0-beta"`, systemd user autostart enablement and active state,
  upgrade with a preserved marker file, uninstall with data preserved, and
  explicit purge removing the data directory.
- macOS arm64 fresh install was not rerun in this workspace because the active
  user already has `com.littleimp.daemon` loaded and no separate test user or
  Apple Silicon VM was available. Reusing the current GUI user would mutate the
  active LaunchAgent label. TASK-048 remains the prior isolated macOS
  install/upgrade/uninstall/purge evidence.
- macOS 12+ x64 remains an explicit hardware gap because no Intel Mac or x64
  macOS VM is available in this workspace.

## Verification

- `npm run release:validate -- --require-signatures` passed.
- `npm run installer:matrix:linux` passed.
