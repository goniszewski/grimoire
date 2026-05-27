# Little Imp Release Checklist

Release target: `0.1.0-beta`

Use this checklist before tagging or publishing a beta build.

## Supported Installer Matrix

The MVP native installer supports this exact OS matrix:

| Target | Architecture | Service manager | Release artifact | Required before publish |
|---|---|---|---|---|
| macOS 12+ arm64 | Apple Silicon | LaunchAgent | `little-imp-0.1.0-beta-macos.tar.gz` | Validate on the available Apple Silicon host or VM. |
| macOS 12+ x64 | Intel | LaunchAgent | `little-imp-0.1.0-beta-macos.tar.gz` | Validate manually on Intel hardware or an x64 macOS VM when available. |
| Ubuntu 24.04 LTS | Host architecture | systemd user unit | `little-imp-0.1.0-beta-linux.tar.gz` | Run the Linux matrix smoke or record why Docker/systemd was unavailable. |
| Debian 12 | Host architecture | systemd user unit | `little-imp-0.1.0-beta-linux.tar.gz` | Run the Linux matrix smoke or record why Docker/systemd was unavailable. |

Record command output, host details, and deviations in
[installer-matrix-validation.md](./installer-matrix-validation.md).

## Install

- From a clean checkout, run `npm run package:release`.
- Confirm `release/` contains:
  - `little-imp-0.1.0-beta-macos.tar.gz`
  - `little-imp-0.1.0-beta-macos.tar.gz.sha256`
  - `little-imp-0.1.0-beta-linux.tar.gz`
  - `little-imp-0.1.0-beta-linux.tar.gz.sha256`
  - `release-manifest.json`
- Run `npm run release:validate`.
- Verify checksums from inside `release/` with `shasum -a 256 -c *.sha256`
  on macOS or `sha256sum -c *.sha256` on Linux.
- Sign each archive before publication:
  `gpg --armor --detach-sign --output release/ARCHIVE.tar.gz.asc release/ARCHIVE.tar.gz`.
- Run `npm run release:validate -- --require-signatures` before publishing
  signed artifacts.
- Confirm root `install.sh` is executable and references the current release
  target.
- Run the one-command installer path against the published release URL:
  `curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash`.
- Run the one-command upgrade path over an existing install:
  `curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash -s -- --upgrade`.
- Run the packaged CLI upgrade path against the published release artifacts:
  `littleimp update install --version 0.1.0-beta`.
- Run the packaged CLI local archive upgrade path against a downloaded archive
  and checksum, adding `--signature` when the detached signature is published.
- Run clean install, health check, autostart registration, upgrade, uninstall,
  and purge validation for every supported installer matrix target.
- On Linux, run `npm run installer:matrix:linux` to validate Ubuntu 24.04 LTS
  and Debian 12 systemd user installs where privileged Docker systemd
  containers are available.
- On macOS, run `cd daemon && ./install.sh` on a clean profile or VM for each
  available architecture, then verify
  `curl http://127.0.0.1:3210/health` returns `version: "0.1.0-beta"`.
- Verify LaunchAgent or systemd user service starts the daemon after login.
- Run `./install.sh --upgrade` over an existing install and confirm data is
  preserved.
- Run `./install.sh --uninstall` and confirm application data remains unless
  `--purge` is used.

## Homebrew Alternate Install

- Confirm `Formula/little-imp.rb` references the current release target and the
  published macOS and Linux archive checksums from `release/release-manifest.json`.
- Run `npx vitest run scripts/homebrew-formula.test.ts`.
- Register the Bun dependency tap with `brew tap oven-sh/bun`.
- Register the checkout as a local tap with `brew tap goniszewski/little-imp "$PWD"`.
- Run `brew audit --strict goniszewski/little-imp/little-imp`.
- Run `brew install goniszewski/little-imp/little-imp`.
- Confirm `littleimp --help` reports `0.1.0-beta`.
- Start the Homebrew service with `brew services start little-imp`, then verify
  `curl http://127.0.0.1:3210/health` reports `version: "0.1.0-beta"`.
- Stop the Homebrew service with `brew services stop little-imp`.
- Run `brew uninstall little-imp` and confirm
  `$(brew --prefix)/var/little-imp` remains unless it is explicitly removed.

## Installed-App Smoke

- Run `npm run test:e2e:installed`; the command packages release artifacts
  before running the smoke.
- Confirm the installed-app smoke validates the packaged archive in an isolated
  temporary home, starts the installed daemon through a controlled test process,
  and covers save, search, import, export, Settings, backup, restore, update
  check, daemon health, upgrade data preservation, and uninstall without purge.
- If the smoke fails, inspect the temp root printed by the command, especially
  `daemon.log` and `daemon.error.log`.

## Docker

- Run `docker compose up -d`.
- Confirm the app opens at `http://127.0.0.1:3210`.
- Confirm `docker compose ps` reports the container as healthy.
- Confirm Compose keeps the host port bound to `127.0.0.1:3210:3210`.
- Run `docker compose down` and confirm the named data volume is preserved.

## Backup And Restore

- Create a local backup from Settings or `POST /backup`.
- Verify the snapshot contains `snapshot.db`, `manifest.json`, `checksums.sha256`, and `data/settings.json`.
- Restore the snapshot from Settings or `POST /restore`.
- Confirm restore creates a rollback directory and returns `restart_required: true`.
- Restart the daemon and confirm bookmarks and non-secret settings are restored while local secrets are preserved.

## CI And Quality Gates

- Run `npm run check`.
- Run `npm run test:e2e`.
- Build the Docker image and run the container health check.
- Confirm GitHub Actions is green for lint, type-checks, tests, API docs drift, build, E2E, and Docker validation.

## Documentation

- Run `npm run docs:api:check`.
- Confirm `README.md`, `docs/roadmap.md`, `docs/prd.md`, `CHANGELOG.md`, `SECURITY.md`, and `tasks/README.md` all name `0.1.0-beta` as the current release target.
- Confirm links in `README.md`, `CONTRIBUTING.md`, and `tasks/README.md` resolve to existing files.
- Confirm backup, Docker, MCP, and API source-of-truth docs match the shipped routes and defaults.
