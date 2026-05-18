# TASK-054: CLI Update Check Foundation

**Phase:** next release distribution polish
**Priority:** medium
**Status:** done

## Summary

Add a manual `littleimp update check` command that checks a configured release
source for newer Little Imp releases. This is the first low-risk slice of the
update-system design: it reports update availability but does not download,
install, or roll back releases.

## Work

1. Add a CLI `update check` command.
2. Read GitHub Releases-compatible JSON from the default source or
   `LITTLEIMP_UPDATE_SOURCE`.
3. Support stable and beta channel filtering.
4. Compare release tags against the packaged app version.
5. Add JSON and human-readable output.
6. Document the command and current update-system scope.

## Acceptance Criteria

- [x] `littleimp update check` reports whether the app is up to date.
- [x] `--channel stable` ignores prereleases.
- [x] Beta builds check the beta channel by default.
- [x] `--source` and `LITTLEIMP_UPDATE_SOURCE` can point at an alternate
      GitHub Releases-compatible endpoint.
- [x] `--json` returns machine-readable status.
- [x] Focused CLI tests and daemon type checks pass.

## Completion Notes

- Added `update check` handling to `daemon/src/cli.ts`.
- Added focused coverage in `daemon/src/test/cli-update.test.ts`, including
  malformed release tags that must not affect update selection.
- Updated README and `docs/update-system.md` with the current CLI-only scope.
- Verified with `bun test src/test/cli-update.test.ts src/test/cli-backup.test.ts`,
  `bun run check` in `daemon/`, `git diff --check`, and the full `npm run check`
  project gate.
