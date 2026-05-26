# TASK-060: One-Command Installer Entry Point

**Phase:** MVP readiness
**Priority:** high
**Status:** done
**Area:** distribution / installer

## Description

Add a one-command installer path that downloads a published release artifact,
verifies integrity, and runs the existing native install flow without requiring a
manual repository clone.

## Scope

1. Design the installer entry point for macOS and Linux shell environments.
2. Download the correct release archive for the current platform or fail with a
   clear unsupported-platform message.
3. Verify SHA-256 checksum before extraction.
4. Verify signature when signed artifacts are available.
5. Extract to a temporary directory and invoke the existing installer.
6. Preserve the current install, upgrade, uninstall, and purge semantics.
7. Add clear failure messages for missing dependencies, checksum mismatch,
   unsupported OS, and network failures.
8. Document safe install and upgrade commands in `README.md`.

## Acceptance Criteria

- [x] A user can install Little Imp from a release URL without cloning the repo.
- [x] Checksum verification happens before installer execution.
- [x] Signature verification is used when signatures are available, or the
      command refuses to claim signature verification.
- [x] Install and upgrade paths preserve user data.
- [x] Failure paths leave no partial active installation.
- [x] Documentation includes the one-command path and the manual archive path.

## Dependencies

- Depends on TASK-059 for release archive format and checksums.

## Notes

- Keep the installer local-first and explicit. Do not add forced update behavior.

## Completion Notes

- Added root `install.sh` as the one-command release entry point. It detects
  macOS or Linux, downloads the matching release archive and checksum, verifies
  SHA-256 before extraction, verifies a detached `.asc` signature when present,
  and delegates install or `--upgrade` to the verified archive's
  `daemon/install.sh`.
- The installer uses a temporary working directory and refuses to run the native
  installer on unsupported OSes, unsafe version overrides, missing dependencies,
  download failures, invalid checksum files, checksum mismatch, invalid
  signatures, non-404 signature download errors, unsafe archive member paths,
  unsupported archive entry types, or malformed archives.
- Added focused Vitest coverage for successful upgrade delegation, checksum
  mismatch refusal before installer execution, unsafe archive paths, unsafe
  version overrides, unsupported archive entry types, non-404 signature download
  errors, and signature verification when a release publishes a detached
  signature.
- Updated README, release checklist, roadmap, and PRD documentation with the
  one-command install/upgrade path and manual archive verification guidance.
