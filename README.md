# Little Imp

A local-first bookmark manager. Save links, extract content, search semantically, and let an AI organise your library — all on your own machine.

## How it works

Little Imp has two parts:

- **Frontend** — a React SPA served by Vite (dev) or any static file server (production).
- **`littleimpd`** — a background daemon (Bun + Hono) that listens on `127.0.0.1:3210`. It stores bookmarks in SQLite, runs the content extraction pipeline, and exposes a REST API the frontend talks to.

---

## Requirements

- [Bun](https://bun.sh) 1.x or later
- macOS 12+ or a modern Linux distribution with systemd

---

## Installation

```sh
# 1. Clone the repository
git clone https://github.com/goniszewski/little-imp.git
cd little-imp/daemon

# 2. Run the installer
./install.sh
```

The installer will:
1. Copy daemon files to `~/.local/share/littleimp/daemon`
2. Install npm dependencies (production only)
3. Create a default config at `~/.local/share/littleimp/.env`
4. Register a LaunchAgent (macOS) or systemd user unit (Linux) so the daemon starts on login
5. Start the daemon and wait for it to become healthy

### Verify the install

```sh
curl http://127.0.0.1:3210/health
# → {"status":"ok","version":"...","uptime":...,"queueSize":0}
```

---

## Daemon management

### macOS (LaunchAgent)

```sh
# Start
launchctl start com.littleimp.daemon

# Stop
launchctl stop com.littleimp.daemon

# Restart
launchctl stop com.littleimp.daemon && launchctl start com.littleimp.daemon

# View logs
tail -f ~/.local/share/littleimp/logs/daemon.log
tail -f ~/.local/share/littleimp/logs/daemon.error.log
```

### Linux (systemd user unit)

```sh
# Start
systemctl --user start littleimpd

# Stop
systemctl --user stop littleimpd

# Restart
systemctl --user restart littleimpd

# Enable auto-start on login
systemctl --user enable littleimpd

# View logs
journalctl --user -u littleimpd -f
# or
tail -f ~/.local/share/littleimp/logs/daemon.log
```

---

## Upgrade

```sh
cd little-imp/daemon
./install.sh --upgrade
```

This stops the daemon, replaces the files, reinstalls dependencies, and restarts.

---

## Uninstall

```sh
# Remove daemon and service file — data is preserved
./install.sh --uninstall

# Remove daemon, service file, AND all data
./install.sh --uninstall --purge
```

---

## Data location

All application data lives in `~/.local/share/littleimp/`:

| Path | Contents |
|------|----------|
| `~/.local/share/littleimp/littleimp.db` | SQLite database (bookmarks, categories, embeddings) |
| `~/.local/share/littleimp/.env` | Runtime configuration |
| `~/.local/share/littleimp/logs/` | Daemon stdout / stderr logs |

### Manual backup

```sh
# Back up the database
cp ~/.local/share/littleimp/littleimp.db ~/Desktop/littleimp-backup-$(date +%Y%m%d).db

# Restore
cp ~/Desktop/littleimp-backup-YYYYMMDD.db ~/.local/share/littleimp/littleimp.db
```

Stop the daemon before restoring to avoid corruption:

```sh
# macOS
launchctl stop com.littleimp.daemon
cp ~/Desktop/littleimp-backup-YYYYMMDD.db ~/.local/share/littleimp/littleimp.db
launchctl start com.littleimp.daemon

# Linux
systemctl --user stop littleimpd
cp ~/Desktop/littleimp-backup-YYYYMMDD.db ~/.local/share/littleimp/littleimp.db
systemctl --user start littleimpd
```

---

## Frontend development

```sh
# Install dependencies
npm install

# Start the dev server (requires daemon running)
npm run dev

# Run frontend unit tests
npm run test

# Run end-to-end tests
npm run test:e2e
```

## Daemon development

```sh
npm run daemon:dev    # hot-reload with bun --watch
npm run daemon:start  # production start (no watch)

# Unit tests
cd daemon && bun test src/test/
```

---

## Configuration

The daemon reads its configuration from `~/.local/share/littleimp/.env` at startup.

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address (keep localhost for security) |
| `PORT` | `3210` | HTTP port |
| `DATA_DIR` | `~/.local/share/littleimp` | Database and log directory |
| `NODE_ENV` | `production` | `development` enables pretty logs |
| `LOG_FORMAT` | `json` | `json` or `pretty` |

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
