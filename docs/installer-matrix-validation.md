# Installer Matrix Validation

Release target: `0.1.0-beta`
Last updated: May 29, 2026

This document is the evidence log for the MVP native installer matrix. The
release checklist links here so unsupported or unavailable environments stay
visible during release closeout and go/no-go review.

## Supported MVP Installer Matrix

| Target | Artifact | Autostart mechanism | Validation route | Current evidence |
|---|---|---|---|---|
| macOS 12+ arm64 | `little-imp-0.1.0-beta-macos.tar.gz` | LaunchAgent `com.littleimp.daemon` | Native macOS host or Apple Silicon VM | May 29, 2026 non-mutating host check confirmed Darwin arm64 on macOS 26.5 with the LaunchAgent already running. Fresh release-path install was skipped because no separate test user or VM was available and mutating the shared LaunchAgent label would affect the active user service. TASK-048 records the prior isolated macOS install/upgrade/uninstall/purge smoke. |
| macOS 12+ x64 | `little-imp-0.1.0-beta-macos.tar.gz` | LaunchAgent `com.littleimp.daemon` | Intel Mac or x64 macOS VM | No Intel Mac or x64 macOS VM was available on May 29, 2026. Keep as an explicit manual validation gap. |
| Ubuntu 24.04 LTS | `little-imp-0.1.0-beta-linux.tar.gz` | systemd user unit `littleimpd.service` | `npm run installer:matrix:linux -- ubuntu:24.04` | Passed in Docker systemd-user smoke on May 29, 2026 after signature-required artifact validation. |
| Debian 12 | `little-imp-0.1.0-beta-linux.tar.gz` | systemd user unit `littleimpd.service` | `npm run installer:matrix:linux -- debian:12` | Passed in Docker systemd-user smoke on May 29, 2026 after signature-required artifact validation. |

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

Validated on May 29, 2026 from macOS 26.5 arm64:

- `uname -s -m`: `Darwin arm64`
- `sw_vers`: `ProductVersion: 26.5`, `BuildVersion: 25F71`
- `arch`: `arm64`
- `bun --version`: `1.3.6`
- `docker --version`: `Docker version 29.4.0, build 9d7ad9f`
- `release/release-manifest.json`: generated at
  `2026-05-29T06:58:39.662Z`
- macOS artifact SHA-256:
  `d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59`
- Linux artifact SHA-256:
  `a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098`

Completed May 29 release-closeout checks:

- `npm run release:validate -- --require-signatures` passed and validated both
  signed release archives before installer validation.
- `npm run installer:matrix:linux` passed for Ubuntu 24.04 LTS and Debian 12
  systemd-user containers. The script mounted `release/` read-only and consumed
  `little-imp-0.1.0-beta-linux.tar.gz`.
- Ubuntu 24.04 output summary: clean install found Bun `1.3.14`, installed the
  frontend bundle and CLI, created the default config, enabled and started
  `littleimpd.service`, returned
  `{"status":"ok","version":"0.1.0-beta",...}` from `/health`, reported the
  service as `enabled` and `active`, preserved
  `~/.local/share/littleimp/matrix-preserve.txt` across `./install.sh
  --upgrade`, preserved `~/.local/share/littleimp` after `./install.sh
  --uninstall`, and removed it only after `./install.sh --uninstall --purge`.
- Debian 12 output summary: clean install found Bun `1.3.14`, installed the
  frontend bundle and CLI, created the default config, enabled and started
  `littleimpd.service`, returned
  `{"status":"ok","version":"0.1.0-beta",...}` from `/health`, reported the
  service as `enabled` and `active`, preserved
  `~/.local/share/littleimp/matrix-preserve.txt` across `./install.sh
  --upgrade`, preserved `~/.local/share/littleimp` after `./install.sh
  --uninstall`, and removed it only after `./install.sh --uninstall --purge`.

macOS availability and skipped targets:

- `launchctl print gui/$(id -u)/com.littleimp.daemon` showed the active
  workspace user already has `com.littleimp.daemon` loaded from
  `~/Library/LaunchAgents/com.littleimp.daemon.plist`, state `running`, with
  `HOST=127.0.0.1`, `PORT=3210`, and
  `DATA_DIR=~/.local/share/littleimp`.
- The May 29 task did not run a fresh macOS arm64 install/upgrade/uninstall
  cycle because a fresh test user or Apple Silicon VM was not available, and
  reusing the current GUI user would mutate the active LaunchAgent label.
- macOS 12+ x64 remains unvalidated because this workspace has no Intel Mac or
  x64 macOS VM.

Historical May 26 checks:

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

## Issues Found And Fixed

- The Linux matrix smoke initially exposed macOS AppleDouble files such as
  `._0001_initial.sql` inside the release archive. The daemon tried to apply
  those files as migrations and never reached `/health`.
- Release packaging now skips portable metadata sidecars and creates archives
  with `COPYFILE_DISABLE=1` and `--no-xattrs`.
- Migration discovery now only accepts files matching `NNNN_*.sql`, so hidden
  metadata files cannot be applied even if a future archive includes them.
