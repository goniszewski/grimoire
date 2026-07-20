# TASK-001: littleimpd Daemon Setup

**Status:** backlog
**Priority:** high
**Phase:** v0-alpha
**Area:** backend / infrastructure

## Description

Create the `littleimpd` local daemon that serves as the runtime core of Little Imp.

## Requirements

- Node.js or Bun runtime
- Hono-based HTTP API server bound to `http://127.0.0.1:3210`
- Background worker queue for processing pipeline jobs
- Scheduler for periodic AI agent tasks
- macOS LaunchAgent config for autostart
- Linux systemd unit file for autostart
- Shell script installer

## Acceptance Criteria

- [ ] Daemon starts and serves API at `127.0.0.1:3210`
- [ ] API responds to health check endpoint
- [ ] Background job worker processes queue
- [ ] Scheduler runs periodic tasks
- [ ] LaunchAgent plist installs and autoloads on macOS
- [ ] systemd unit installs and enables on Linux
- [ ] Shell installer script handles both platforms
- [ ] Daemon can be stopped/restarted gracefully
