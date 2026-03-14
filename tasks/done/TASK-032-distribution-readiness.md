# TASK-032: Distribution Readiness

**Status:** done
**Priority:** low
**Phase:** M5
**Area:** infrastructure

## Description

Ensure Little Imp can be installed and run by someone other than the author on a fresh machine, with no prior knowledge of the codebase.

## Work

**Installer validation**
- Test `install.sh` end-to-end on a clean macOS environment (no existing Node/Bun assumed)
- Test systemd unit file on Linux (Ubuntu/Debian)
- Verify macOS LaunchAgent `.plist` auto-starts the daemon on login
- Document manual `start` / `stop` / `restart` commands in README

**First-run experience**
- Detect empty library state on frontend — show an empty state message with a prompt to add the first bookmark or import
- Confirm cold-start guard: clustering disabled when library < 20 bookmarks
- `DaemonOfflineBanner` shows correctly before daemon starts on first launch

**Packaging**
- Establish changelog format (e.g. Keep a Changelog) and create initial `CHANGELOG.md`
- Document `DATA_DIR` location and manual backup steps in README
- Ensure `install.sh --uninstall` cleanly removes daemon, plist/service, and optionally data

## Acceptance Criteria

- [x] Fresh macOS install: `curl <url> | sh` completes, daemon starts, UI accessible
- [x] Fresh Linux install: systemd unit starts on boot
- [x] Empty state UI visible on first launch
- [x] `--uninstall` removes daemon and service files cleanly
- [x] `CHANGELOG.md` exists with v0-beta entry
- [x] README documents data location and backup
