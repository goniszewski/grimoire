# Little Imp 0.1.0-beta

Little Imp is a local-first bookmark manager for saving, extracting, searching,
organizing, backing up, and restoring a personal knowledge library on your own
machine.

This prerelease includes signed release archives, an installer, an alternate
Homebrew formula, a Docker path, explicit update checks, packaged backup
commands, and local diagnostics for support.

> **Release status.** This is a prerelease record, not a public-install
> announcement. Source checkout and Docker are the supported evaluation paths.
> Public installer, archive, Homebrew, and published-artifact validation must
> pass before those routes are offered as supported beta installs.

## Supported Evaluation Paths

### Source checkout

```sh
git clone https://github.com/goniszewski/little-imp.git
cd little-imp
npm install
cd daemon && bun install
cd ..
npm run daemon:dev
```

In another terminal, start the frontend at `http://127.0.0.1:8080`:

```sh
npm run dev
```

### Docker

```sh
docker compose up -d
curl http://127.0.0.1:3210/health
```

Open `http://127.0.0.1:3210`. See the [Docker deployment guide](./docker-deployment.md)
for configuration and backup guidance.

## Release Package Paths (not yet supported)

The installer, release archives, and Homebrew formula are retained for
validation. Do not use them as a public beta path until the release decision's
required public checks have been rerun successfully.

## Artifacts

| Platform | Archive | SHA-256 |
|---|---|---|
| macOS | `little-imp-0.1.0-beta-macos.tar.gz` | `d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59` |
| Linux | `little-imp-0.1.0-beta-linux.tar.gz` | `a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098` |

Published assets:

- `little-imp-0.1.0-beta-macos.tar.gz`
- `little-imp-0.1.0-beta-macos.tar.gz.sha256`
- `little-imp-0.1.0-beta-macos.tar.gz.asc`
- `little-imp-0.1.0-beta-linux.tar.gz`
- `little-imp-0.1.0-beta-linux.tar.gz.sha256`
- `little-imp-0.1.0-beta-linux.tar.gz.asc`
- `release-manifest.json`

## Supported Environments

| Target | Service manager | Release artifact | Current validation status |
|---|---|---|---|
| macOS 12+ arm64 | LaunchAgent | macOS archive | Historical isolated native install/upgrade/uninstall/purge smoke passed; May 29 non-mutating host check confirmed the active LaunchAgent path. |
| macOS 12+ x64 | LaunchAgent | macOS archive | Best-effort target; validated when Intel hardware or an x64 macOS VM is available. macOS arm64 is the validated Mac target for this beta. |
| Ubuntu 24.04 LTS | systemd user unit | Linux archive | Signed archive matrix smoke passed. |
| Debian 12 | systemd user unit | Linux archive | Signed archive matrix smoke passed. |

Docker is also supported for local-only use with the host port bound to
`127.0.0.1:3210:3210`.

## What's Included

- Local bookmark capture through the app, API, import flow, global paste, MCP
  tools, and protected local capture integrations.
- Content extraction for web pages, PDFs, GitHub repositories, StackOverflow
  and StackExchange pages, and YouTube metadata/transcripts where available.
- SQLite storage with keyword, semantic, and hybrid search.
- Optional AI enrichment through OpenAI, Ollama, Anthropic, OpenRouter,
  DeepSeek, or custom OpenAI-compatible providers.
- Category management, tags, archive, trash, pinning, read status, personal
  notes, and bookmark detail editing.
- First-run empty states, daemon-offline messaging, degraded AI/embedding
  states, review queue, and pipeline retry/reprocess controls.
- Portable local backups, backup verification, encrypted backup packages,
  restore rollback directories, and post-restore restart guidance.
- Explicit update checks and `littleimp update install` for verified manual
  upgrades.
- Redacted local diagnostics from Settings, `littleimp diagnostics`, and
  `GET /diagnostics`.
- Loopback-only native and Docker defaults, browser hardening headers, checksum
  validation, and optional detached signature verification.

## Validation Summary

Historical release evidence for this beta includes:

- `npm run check`
- `npm run test:e2e`
- `npm run release:validate -- --require-signatures`
- checksum verification for both release archives
- detached GPG signature verification for both release archives
- Linux installer matrix smoke on Ubuntu 24.04 LTS and Debian 12
- local installed-app smoke against packaged artifacts
- Docker Compose loopback binding and health validation
- final localhost security regression coverage
- API documentation drift and local Markdown link audits

This evidence predates the current head and must be refreshed before any public
promotion. The GitHub release remains a prerelease until the public installer,
Homebrew, and published-artifact smoke checks are successful.

## Known Limitations

- Little Imp is a local-first, single-user app. It does not include an
  authentication layer and should not be exposed on a public network without an
  authenticated tunnel, VPN, or reverse proxy in front of it.
- macOS x64 is a best-effort target for this beta. macOS arm64 is the validated
  Mac target. Revisit when Intel hardware or an x64 macOS VM is available.
- Homebrew live install validation depends on the release archive URLs being
  publicly downloadable.
- Public one-command install, public CLI update install, and published-artifact
  E2E validation also depend on public access to the tag and release assets.
- Update checks are explicit and user-controlled. Automatic updates,
  background update notifications, and automatic rollback are not shipped in
  this release.
- Restore intentionally requires a daemon restart after data replacement.
- Settings can verify or restore encrypted backup packages from any local path
  the daemon can read.
- Multi-device sync, packaged browser extension clients, multi-user support,
  optional authentication, and public-network deployment modes are post-MVP
  work.
- Grimoire parity follow-up work is scoped to local-first, single-user,
  loopback-first, local-integration compatibility. It does not include
  multi-user accounts/admin, public-server mode, Grimoire endpoint aliases,
  packaged browser-extension/bookmarklet clients, extension smoke tests, or
  direct Grimoire/PocketBase backup import in the current batch.

## Support And Troubleshooting

Start with the health endpoint and local diagnostics:

```sh
curl http://127.0.0.1:3210/health
littleimp diagnostics
```

Useful support references:

- Install verification, daemon health, and service restart commands:
  [README daemon management](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/README.md#daemon-management)
- Homebrew release gate and live-validation status:
  [README Homebrew status](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/README.md#homebrew-pending-live-validation)
- General troubleshooting, including offline daemon checks, restore recovery,
  Homebrew Bun resolution, and encrypted package fallback behavior:
  [README troubleshooting](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/README.md#troubleshooting)
- Diagnostics contents and redaction:
  [docs/diagnostics.md](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/docs/diagnostics.md)
- Update behavior and rollback guidance:
  [docs/update-system.md](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/docs/update-system.md)
- Docker loopback-only deployment:
  [docs/docker-deployment.md](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/docs/docker-deployment.md)
- Backup/restore recovery model:
  [docs/backup-design.md](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/docs/backup-design.md)
- Installer matrix evidence:
  [docs/installer-matrix-validation.md](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/docs/installer-matrix-validation.md)
- Security posture and vulnerability reporting:
  [SECURITY.md](https://github.com/goniszewski/little-imp/blob/v0.1.0-beta/SECURITY.md)

Diagnostics are local support bundles, not telemetry. Nothing is sent unless
you choose to copy, export, or share the output.

Use public GitHub issues for normal bugs and support requests. Do not disclose
security vulnerabilities in public issues; report them through the security
contact described in `SECURITY.md`.
