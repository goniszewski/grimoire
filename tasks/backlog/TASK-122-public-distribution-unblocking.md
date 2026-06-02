# TASK-122: Public Distribution Unblocking and One-Command Validation

**Phase:** Release unblocking
**Priority:** critical (P0)
**Status:** backlog (blocked on repo being made public)
**Area:** release / distribution

## Description

Complete TASK-078 once the repository is made public (or an authenticated distribution path is explicitly chosen and documented). Validate the one-command install, one-command `--upgrade`, and `littleimp update install --version 0.1.0-beta` against publicly reachable release URLs.

## Scope

1. Make `goniszewski/little-imp` public so unauthenticated requests can fetch tag-qualified raw URLs and release assets.
2. Validate the documented one-command install:
   `curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash`
3. Validate the one-command upgrade over an existing install:
   `curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash -s -- --upgrade`
4. Validate the packaged CLI upgrade:
   `littleimp update install --version 0.1.0-beta`
5. Confirm checksums are fetched and verified.
6. Confirm detached signatures are verified when published.
7. Confirm daemon restart and health-version verification complete.
8. Record rollback guidance, failure output, and any publication URL mismatch.

## Acceptance Criteria

- [ ] Repository is public and unauthenticated GET requests to raw.githubusercontent.com and github.com/releases/download succeed for v0.1.0-beta assets.
- [ ] Public one-command install succeeds on macOS arm64 and Linux (Ubuntu 24.04 / Debian 12).
- [ ] Public one-command upgrade preserves database, settings, backups, and logs.
- [ ] Packaged CLI update install succeeds against published assets.
- [ ] Checksum and signature behavior matches `docs/update-system.md`.
- [ ] Any failure keeps the release in draft/prerelease status until corrected or explicitly documented.

## Blocked By

- Making `goniszewski/little-imp` GitHub repository public, or explicitly choosing and documenting an authenticated distribution path.

## Dependencies

- TASK-076 (signed release artifact publication) — complete.
- TASK-078 (published one-command CLI upgrade validation) — in-progress, blocked on same issue.

## Notes

- Once the repo is public, run TASK-123 and TASK-124 in the same release-closeout wave since they share the same artifact visibility precondition.
