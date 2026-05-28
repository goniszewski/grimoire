# Little Imp Update System

## Overview

This document describes the update behavior shipped for the `0.1.0-beta`
release target and separates it from post-MVP update-management ideas.

Little Imp updates are explicit and user-controlled. The shipped system can
check for newer releases, download or consume a selected release archive, verify
the archive, run the native installer in upgrade mode, restart the daemon, and
verify the daemon reports the upgraded version. It does not perform automatic
updates.

## Shipped In 0.1.0-beta

Implemented update paths:

- Settings can run a manual update availability check.
- `GET /updates/check` exposes the same read-only check through the daemon API.
- `littleimp update check` exposes a scriptable read-only CLI check.
- `littleimp update install` and the alias `littleimp update upgrade` perform
  explicit native upgrades.
- `daemon/install.sh --upgrade` upgrades from an unpacked release archive or
  source checkout.
- The one-command installer supports `--upgrade` after downloading and
  verifying the current release archive.

Update checks read GitHub Releases-compatible JSON from the default GitHub
Releases API or an operator-provided source, filter by `stable` or `beta`
channel, ignore malformed release tags, and report whether a newer semver
release exists. The daemon API rejects private and loopback source hosts to
preserve the local network safety posture. The user-invoked CLI can still target
explicit local mirrors in controlled offline environments.

`update check` is always read-only. It never downloads or installs updates.

## Manual Upgrade Flow

The packaged CLI supports three explicit upgrade modes:

```bash
# Install the latest compatible release found by the update source
littleimp update install

# Download and install a selected release version
littleimp update install --version 0.2.0-beta.1 \
  --release-base-url https://github.com/goniszewski/little-imp/releases/download/v0.2.0-beta.1

# Upgrade from an already downloaded archive, checksum, and optional signature
littleimp update install \
  --archive ~/Downloads/little-imp-0.2.0-beta.1-macos.tar.gz \
  --checksum ~/Downloads/little-imp-0.2.0-beta.1-macos.tar.gz.sha256 \
  --signature ~/Downloads/little-imp-0.2.0-beta.1-macos.tar.gz.asc
```

For downloaded release upgrades, the CLI derives artifact URLs from a
GitHub-compatible release `html_url` when possible. Set
`LITTLEIMP_RELEASE_BASE_URL` or pass `--release-base-url` when archives are
hosted somewhere else.

The upgrade process:

1. Download or read the selected platform archive, `.sha256`, and optional
   `.asc` signature.
2. Verify the SHA-256 checksum.
3. Verify the detached signature when one is present or explicitly provided.
4. Reject unsafe archive layouts before extraction.
5. Run the packaged `daemon/install.sh --upgrade`.
6. Restart the daemon through LaunchAgent or systemd user service behavior.
7. Verify `http://127.0.0.1:3210/health` reports the upgraded version.

Local data, settings, backups, and logs remain under
`~/.local/share/littleimp`. Homebrew-managed installs keep data under
`$(brew --prefix)/var/little-imp`.

## One-Command Upgrade

The root installer downloads the current platform archive from the release URL,
verifies the published checksum, verifies a detached signature when published,
and delegates to the native installer:

```bash
curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash -s -- --upgrade
```

If no detached signature is published, the installer prints a checksum-only
warning and does not claim signature verification.

## Rollback

Rollback is manual in `0.1.0-beta`.

Failed upgrades after installer execution print rollback guidance that directs
the user to rerun the previous verified release installer with `--upgrade`.
Because user data lives outside the daemon application files, this reverts the
installed app version while preserving the database, settings, backups, and
logs.

Full version history, one-command rollback, and automatic rollback are deferred.

## Configuration

Current shipped configuration:

| Variable | Used by | Purpose |
|---|---|---|
| `LITTLEIMP_UPDATE_SOURCE` | CLI and daemon update check | Override the default GitHub Releases-compatible source. |
| `LITTLEIMP_RELEASE_BASE_URL` | CLI upgrade and one-command installer | Override the base URL that contains archive, checksum, and optional signature files. |
| `LITTLEIMP_VERSION` | One-command installer | Select the release version to download. Defaults to `0.1.0-beta`. |

Beta builds check the beta channel by default. Stable builds check the stable
channel by default.

## Deferred Update Management

These ideas are not shipped in `0.1.0-beta`:

- Automatic scheduled update checks.
- System tray notifications or critical-update banners.
- One-click in-app installation.
- Auto-download.
- Nightly channel management.
- Certificate pinning beyond normal HTTPS verification.
- Automatic rollback and version history.
- Delta updates.
- Enterprise update policies.
- Analytics for update adoption.

Post-MVP work should keep the same principles: no forced updates, local data
preservation, checksum/signature verification, and explicit user control.
