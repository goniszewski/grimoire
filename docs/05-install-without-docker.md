# Install without Docker

Native install on macOS or Linux. There is no native Windows installer; use Docker with WSL2 instead.

## Prerequisites

- [Bun](https://bun.sh/docs/installation) 1.x
- A git clone of this repository (or an unpacked release that includes the frontend build sources)
- macOS or Linux

The installer installs production dependencies, builds the frontend when possible, and registers a user service. It installs the `grimoire` CLI under `~/.local/bin` and keeps `littleimp` as a compatibility alias. You do not need to run `npm install` first.

The published v1.1.0 archive predates this CLI rename and exposes `littleimp`
when used directly. The `grimoire` name is available from the current source
installer and future repackaged releases.

## Install

```sh
cd daemon
./install.sh
```

Then check:

```sh
curl http://127.0.0.1:3210/health
```

Open [http://127.0.0.1:3210](http://127.0.0.1:3210) when health succeeds.

If the checkout has no frontend build output and cannot build one, the installer can leave the API running **without a UI**. Prefer a full source clone for first installs.

## Data locations

| Path | Contents |
| --- | --- |
| `~/.local/share/littleimp/` | Database, built UI, backups, logs |
| `~/.config/littleimp/config.json` | Runtime settings (including AI) |

## Linux note

The service is a **systemd user** unit. If the daemon stops after you log out, enable lingering for your user so the unit can keep running:

```sh
loginctl enable-linger "$USER"
```

## Upgrade / uninstall

```sh
cd daemon
./install.sh --upgrade
```

```sh
cd daemon
./install.sh --uninstall          # keep data
./install.sh --uninstall --purge  # also delete the library
```

## Development without the installer

For day-to-day coding, prefer [Development](./04-development.md) (`npm run daemon:dev` + `npm run dev`) instead of reinstalling.

The Homebrew formula is prepared in the repo, but live Homebrew install is not a supported user path until the public tap and published release assets are validated. Current Homebrew releases require explicit trust for non-official taps, so trust only this formula. The intended command after publication is:

```sh
brew tap goniszewski/grimoire
brew trust --formula goniszewski/grimoire/grimoire
brew install grimoire
brew services start grimoire
```

Use `brew upgrade grimoire` for Homebrew upgrades. Homebrew stores its data
under `$(brew --prefix)/var/little-imp`, separately from native-install data.
