# TASK-078: Published One-Command and CLI Upgrade Validation

**Phase:** MVP release closeout
**Priority:** high
**Status:** todo
**Area:** release / installer / update system

## Description

Validate the public install and upgrade paths against the published GitHub
release URLs rather than locally generated archives.

## Scope

1. Run the documented one-command install command against the published
   `v0.1.0-beta` tag.
2. Run the one-command `--upgrade` path over an existing install.
3. Run `littleimp update install --version 0.1.0-beta` against the published
   release artifacts.
4. Confirm checksums are fetched and verified.
5. Confirm detached signatures are verified when published.
6. Confirm daemon restart and health-version verification complete.
7. Record rollback guidance, failure output, and any publication URL mismatch.

## Acceptance Criteria

- [ ] Public one-command install succeeds from the published release tag.
- [ ] Public one-command upgrade preserves database, settings, backups, and
      logs.
- [ ] Packaged CLI update install succeeds against published assets.
- [ ] Checksum and signature behavior matches `docs/update-system.md`.
- [ ] Any failure keeps the release in draft/prerelease status until corrected
      or explicitly documented.

## Dependencies

- Depends on TASK-076.

## Notes

- This task verifies the URL and release-hosting assumptions that local archive
  tests cannot cover.
