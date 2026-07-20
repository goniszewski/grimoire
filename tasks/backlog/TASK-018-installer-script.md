# TASK-018: Shell Installer Script

**Status:** backlog
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

- [ ] Script detects macOS vs Linux and branches accordingly
- [ ] Script is idempotent (re-running doesn't break existing install)
- [ ] Upgrade path: stops old daemon, replaces binary, restarts
- [ ] Uninstaller script available: `--uninstall` flag
- [ ] Works on macOS 13+ and Ubuntu 22.04+, Fedora 38+
- [ ] Clear error messages if prerequisites missing
