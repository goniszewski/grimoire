# Little Imp

A local-first bookmark manager. Save links, extract content, search semantically, and let an AI organise your library — all on your own machine.

Current release target: `0.1.0-beta`.

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
# → {"status":"ok","version":"0.1.0-beta","uptime":...,"queueSize":0}
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
| `~/.local/share/littleimp/.env` | Install-time daemon defaults |
| `~/.local/share/littleimp/logs/` | Daemon stdout / stderr logs |

Runtime user settings are stored separately at `~/.config/littleimp/config.json`.
AI and embedding execution uses those persisted settings first. Environment
variables such as `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDING_API_KEY`,
`EMBEDDING_MODEL`, and provider base URLs are fallback defaults for first
install or unattended deployments. `GET /settings` redacts secrets as `"***"`;
round-tripping that response through `PUT /settings` preserves the stored
secret instead of writing the redacted placeholder.

### Backup and restore

The supported backup flow is the daemon backup API/UI, which creates a portable
snapshot directory under `~/.local/share/littleimp/backups/` by default. Each
snapshot contains `snapshot.db`, `manifest.json`, `checksums.sha256`, and
`data/settings.json`. Settings backups omit secrets such as API keys and PIN
hashes; restoring settings preserves the current local secrets. The Settings
page also supports custom local destinations, scheduled snapshots, and
S3-compatible remote backup targets.

Native installs also include a `littleimp` CLI command at
`~/.local/bin/littleimp`. If that directory is on your `PATH`, you can manage
backups from the shell:

```sh
# Create a backup through the running daemon
littleimp backup create

# List local backups
littleimp backup list

# Include S3-compatible remote backups when configured
littleimp backup list --include-remote

# Verify a local snapshot directory without restoring it
littleimp backup verify --file ~/.local/share/littleimp/backups/BACKUP_DIRECTORY_NAME

# Restore a local backup by directory name
littleimp backup restore BACKUP_DIRECTORY_NAME --yes

# Restore a remote S3 snapshot key
littleimp backup restore --remote-key little-imp-backups/BACKUP_DIRECTORY_NAME/snapshot.db --yes
```

Add `--json` to any backup CLI command for machine-readable output. Set
`LITTLEIMP_DAEMON_URL` or pass `--daemon-url` when the daemon is listening on a
non-default localhost URL.

```sh
# Create a backup through the daemon
curl -X POST http://127.0.0.1:3210/backup

# Restore a named backup snapshot
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"name":"BACKUP_DIRECTORY_NAME"}'
```

Restore verifies checksums before replacing data, creates a rollback directory
under `DATA_DIR/restore-rollbacks/pre-restore-...`, and returns
`restart_required: true`.

For emergency database-only recovery, stop the daemon before copying files:

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

## MCP (Model Context Protocol) integration

Little Imp exposes an MCP server at `http://127.0.0.1:3210/mcp`. This lets AI assistants like Claude Desktop or Cursor query and add bookmarks directly.

### Available tools

| Tool | Description |
|------|-------------|
| `search_bookmarks` | Full-text or hybrid search over your library |
| `get_bookmark` | Fetch full details of a bookmark by ID |
| `list_bookmarks` | List recent bookmarks with optional filters |
| `add_bookmark` | Save a URL and trigger the ingestion pipeline |
| `list_categories` | Return the category tree with bookmark counts |

### Claude Desktop configuration

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "little-imp": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:3210/mcp"]
    }
  }
}
```

> **Note:** `mcp-remote` is only needed because Claude Desktop does not yet support HTTP MCP servers directly. Any MCP client that supports the Streamable HTTP transport (spec 2025-03-26+) can connect to `http://127.0.0.1:3210/mcp` directly.

---

## Documentation

- [API Reference](./API.md) - Generated daemon API documentation
- [API Contract](./docs/api-contract.json) - Machine-readable contract generated from `daemon/src/api/contract.ts`
- [Contributing Guide](./CONTRIBUTING.md) - Development setup and contribution guidelines
- [Product Requirements](./docs/prd.md) - Detailed product specifications
- [Development Roadmap](./docs/roadmap.md) - Future development plans
- [Backup Design](./docs/backup-design.md) - Technical backup/restore documentation
- [Release Checklist](./docs/release-checklist.md) - Final beta validation checklist
- [Security Policy](./SECURITY.md) - Security considerations and vulnerability reporting
- [Update System](./docs/update-system.md) - Update mechanism design and roadmap
- [Docker Deployment](./docs/docker-deployment.md) - Container deployment guide

## Quick Start

### Option 1: Native Installation (Recommended)

```bash
# Clone and install
git clone https://github.com/goniszewski/little-imp.git
cd little-imp/daemon
./install.sh
```

### Option 2: Docker (Alternative)

```bash
# Using Docker Compose (recommended)
git clone https://github.com/goniszewski/little-imp.git
cd little-imp
docker compose up -d

# Or using Docker directly
docker build -t little-imp .
docker run -d -p 127.0.0.1:3210:3210 -v little-imp-data:/data --name little-imp little-imp
```

Access the application at `http://127.0.0.1:3210`. The Docker image serves
the built frontend and daemon API from the same local-only port.

## Development

Little Imp is built with:

- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Bun, Hono, SQLite
- **AI:** Optional local LLM (Ollama) or external providers

For development setup and contribution guidelines, see the [Contributing Guide](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.
