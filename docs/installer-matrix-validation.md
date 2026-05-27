# Installer Matrix Validation

Release target: `0.1.0-beta`
Last updated: May 27, 2026

This document is the evidence log for the MVP native installer matrix. The
release checklist links here so unsupported or unavailable environments are
visible before a beta tag is published.

## Supported MVP Installer Matrix

| Target | Artifact | Autostart mechanism | Validation route | Current evidence |
|---|---|---|---|---|
| macOS 12+ arm64 | `little-imp-0.1.0-beta-macos.tar.gz` | LaunchAgent `com.littleimp.daemon` | Native macOS host or Apple Silicon VM | Current workspace has an existing `com.littleimp.daemon` loaded, so this task used focused LaunchAgent regression coverage instead of mutating the active user service. TASK-048 records the prior isolated macOS install/upgrade/uninstall/purge smoke. |
| macOS 12+ x64 | `little-imp-0.1.0-beta-macos.tar.gz` | LaunchAgent `com.littleimp.daemon` | Intel Mac or x64 macOS VM | Supported for MVP, but not available in this workspace. Record as a manual pre-publish check. |
| Ubuntu 24.04 LTS | `little-imp-0.1.0-beta-linux.tar.gz` | systemd user unit `littleimpd.service` | `npm run installer:matrix:linux -- ubuntu:24.04` | Passed in Docker systemd-user smoke on May 26, 2026. |
| Debian 12 | `little-imp-0.1.0-beta-linux.tar.gz` | systemd user unit `littleimpd.service` | `npm run installer:matrix:linux -- debian:12` | Passed in Docker systemd-user smoke on May 26, 2026. |

## Required Validation Steps

Each matrix target needs the same release-path coverage:

1. Clean install from the packaged release archive or one-command installer.
2. Health check against `http://127.0.0.1:3210/health` with version
   `0.1.0-beta`.
3. Autostart registration through the platform service manager.
4. Upgrade over an existing install with user data preserved.
5. Uninstall with user data preserved by default.
6. Purge removing application data only when explicitly requested.

## Repeatable Linux Smoke

Run all Linux targets:

```bash
npm run installer:matrix:linux
```

Run one Linux target:

```bash
npm run installer:matrix:linux -- ubuntu:24.04
npm run installer:matrix:linux -- debian:12
```

The smoke builds a target-specific systemd container, mounts the local
`release/` directory read-only, extracts the Linux archive matching
`package.json`'s current version as a non-root `smoke` user, and runs:

1. `./install.sh`
2. `curl -fsS http://127.0.0.1:3210/health`
3. `systemctl --user is-enabled littleimpd`
4. `systemctl --user is-active littleimpd`
5. `./install.sh --upgrade`
6. `./install.sh --uninstall`
7. `./install.sh --uninstall --purge`

## Current Workspace Evidence

Validated on May 26, 2026 from macOS 26.5 arm64:

- `uname -s -m`: `Darwin arm64`
- `sw_vers`: `ProductVersion: 26.5`, `BuildVersion: 25F71`
- `bun --version`: `1.3.6`

Completed checks:

- `npm run package:release` passed and regenerated macOS/Linux release archives
  from the current source.
- `npm run release:validate` passed for both release artifacts.
- `cd release && shasum -a 256 -c *.sha256` passed for both archives.
- `tar -tzf release/little-imp-0.1.0-beta-linux.tar.gz` contained no
  `._*`, `.DS_Store`, or `__MACOSX` entries.
- Debian 12 extracted `little-imp-0.1.0-beta-linux.tar.gz` without macOS
  extended-header warnings after the archive was rebuilt with xattrs disabled.
- `cd daemon && bun test src/test/migrations.test.ts` passed, covering
  migration discovery ignoring AppleDouble sidecar files.
- `cd daemon && bun test src/test/integration/installer-static-frontend.test.ts`
  passed, including macOS LaunchAgent rendering and registration command
  coverage with fake platform commands.
- `npx vitest run scripts/release-packager.test.ts` passed, covering release
  payload exclusion of AppleDouble sidecar files.
- `npx vitest run scripts/installer-matrix-docs.test.ts` passed, covering
  release checklist and evidence documentation drift.
- `npm run installer:matrix:linux` passed for Ubuntu 24.04 LTS and Debian 12.
- `npm run check` passed after the matrix, packaging, migration, and
  documentation changes.

Remaining manual pre-publish checks:

- Native macOS arm64 install/upgrade/uninstall/purge smoke in an isolated test
  user or VM if fresh host-level evidence is required beyond TASK-048 and the
  current focused LaunchAgent regression. This workspace already has
  `com.littleimp.daemon` loaded, so the current task did not mutate the active
  user service.
- macOS 12+ x64 install/upgrade/uninstall/purge smoke on Intel hardware or an
  x64 macOS VM.

## Issues Found And Fixed

- The Linux matrix smoke initially exposed macOS AppleDouble files such as
  `._0001_initial.sql` inside the release archive. The daemon tried to apply
  those files as migrations and never reached `/health`.
- Release packaging now skips portable metadata sidecars and creates archives
  with `COPYFILE_DISABLE=1` and `--no-xattrs`.
- Migration discovery now only accepts files matching `NNNN_*.sql`, so hidden
  metadata files cannot be applied even if a future archive includes them.
