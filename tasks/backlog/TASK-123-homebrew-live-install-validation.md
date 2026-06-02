# TASK-123: Homebrew Live Install Validation

**Phase:** Release unblocking
**Priority:** critical (P0)
**Status:** backlog (blocked on repository being public)
**Area:** distribution / Homebrew

## Description

Complete the publication-gated Homebrew work from TASK-079 by validating the formula against published release artifacts end-to-end.

## Scope

1. Confirm `Formula/little-imp.rb` still references the final release checksums from `release/release-manifest.json` (regression check).
2. Run `brew fetch --formula goniszewski/little-imp/little-imp` and confirm the archive downloads from the public release URL.
3. Run `brew install goniszewski/little-imp/little-imp`.
4. Verify `littleimp --help` reports `0.1.0-beta`.
5. Start the Homebrew service: `brew services start little-imp`.
6. Confirm `curl http://127.0.0.1:3210/health` reports `version: "0.1.0-beta"`.
7. Stop the service: `brew services stop little-imp`.
8. Uninstall: `brew uninstall little-imp`.
9. Confirm `$(brew --prefix)/var/little-imp` remains unless explicitly removed.

## Acceptance Criteria

- [ ] `brew fetch` succeeds from the public release URL.
- [ ] `brew install` succeeds.
- [ ] Homebrew service starts the daemon and `/health` reports `0.1.0-beta`.
- [ ] Uninstall preserves Homebrew-managed data by default.

## Blocked By

- Making the GitHub repository public so `brew fetch` can download the release archive.

## Dependencies

- TASK-076 (signed release artifact publication) — complete.
- TASK-079 (Homebrew tap publication and live install validation) — in-progress, blocked on same issue.
- TASK-122 (public distribution unblocking) — must complete first.

## Notes

- Homebrew remains the alternate MVP install path. The one-command installer is still the primary cross-platform path.
- Run immediately after TASK-122 since both depend on the same artifact visibility precondition.
