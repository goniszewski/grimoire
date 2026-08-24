# Install without Docker

Native install on macOS or Linux. There is no native Windows installer; use Docker with WSL2 instead.

## Prerequisites

- [Bun](https://bun.sh/docs/installation) 1.x
- A git clone of this repository (or an unpacked release that includes the frontend build sources)
- macOS or Linux

The installer installs production dependencies, builds the frontend when possible, and registers a user service. You do not need to run `npm install` first.

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

Homebrew formula files may exist in the repo, but live Homebrew install is not a supported user path until it is validated against published release assets.
