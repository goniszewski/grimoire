# TASK-018: Shell Installer Script

**Status:** done
**Priority:** medium
**Phase:** v0-alpha
**Area:** infrastructure

## Description

Create a shell script installer that sets up `littleimpd` on macOS and Linux.

## Installer Steps

1. Check Node.js / Bun version requirement
2. Download or build the daemon binary
3. Install daemon to `~/.local/share/littleimp/` or `/usr/local/lib/littleimp/`
4. Create initial config directory `~/.config/littleimp/`
5. Initialize SQLite database
6. Install autostart config:
   - macOS: `~/Library/LaunchAgents/com.littleimp.daemon.plist`
   - Linux: `~/.config/systemd/user/littleimp.service`
7. Load and start the daemon
8. Verify daemon is responding at `127.0.0.1:3210`
9. Print success message with UI URL

## Acceptance Criteria

- [x] Script detects macOS vs Linux and branches accordingly
- [x] Script is idempotent (re-running doesn't break existing install)
- [x] Upgrade path: stops old daemon, replaces binary, restarts (`--upgrade` flag)
- [x] Uninstaller script available: `--uninstall` flag
- [x] Works on macOS 13+ and Ubuntu 22.04+, Fedora 38+
- [x] Clear error messages if prerequisites missing

## Implementation Notes

- Enhanced `daemon/install.sh` (was partially implemented)
- Added `check_curl()` for curl prerequisite with clear error message
- Added `check_bun()` with minimum version check (Bun 1.x+) and upgrade hint
- Added `stop_daemon()` for graceful pre-upgrade stop (macOS: launchctl, Linux: systemctl)
- Added `--upgrade` flag: stops daemon → replaces files → reinstalls deps → restarts
- Added `--help` flag
- rsync now uses `--delete` to remove stale files on upgrade
- Fallback `.env` written inline if `.env.example` not present
- SQLite DB auto-initializes via `runMigrations()` on first daemon start — no manual step needed
- Health check timeout bumped to 15s (from 10s) to accommodate cold start
