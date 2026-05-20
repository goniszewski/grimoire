# TASK-060: One-Command Installer Entry Point

**Phase:** MVP readiness
**Priority:** high
**Status:** todo
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

- [ ] A user can install Little Imp from a release URL without cloning the repo.
- [ ] Checksum verification happens before installer execution.
- [ ] Signature verification is used when signatures are available, or the
      command refuses to claim signature verification.
- [ ] Install and upgrade paths preserve user data.
- [ ] Failure paths leave no partial active installation.
- [ ] Documentation includes the one-command path and the manual archive path.

## Dependencies

- Depends on TASK-059 for release archive format and checksums.

## Notes

- Keep the installer local-first and explicit. Do not add forced update behavior.
