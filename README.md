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

### One-command release install

```sh
curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash
```

For an in-place upgrade that preserves your database, settings, backups, and
logs:

```sh
curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash -s -- --upgrade
```

The one-command installer downloads the release archive for your platform,
verifies the published SHA-256 checksum before extraction, verifies the detached
signature when the release publishes one, and then runs the native installer.
If no `.asc` signature is published, it prints a checksum-only warning and does
not claim signature verification.

### Homebrew alternate install

Homebrew is an alternate MVP install path for macOS and Linux users who prefer
`brew services`. The recommended MVP path remains the one-command installer
above because it is the cross-platform baseline.

```sh
brew tap oven-sh/bun
brew tap goniszewski/little-imp
brew install little-imp
brew services start little-imp
```

The formula consumes the same release archive as the manual install path and
Homebrew verifies the archive SHA-256 before installation. It installs the
daemon, built frontend bundle, CLI wrappers, and service assets from the
archive instead of rebuilding from the repository.

```sh
# Upgrade and restart the Homebrew service
brew update
brew upgrade little-imp
brew services restart little-imp

# Stop and remove the Homebrew-managed app files
brew services stop little-imp
brew uninstall little-imp
```

Data is preserved by default under `$(brew --prefix)/var/little-imp` when
running `brew uninstall little-imp`. Remove that directory explicitly only when
you intend to purge the Homebrew-managed database, settings, backups, and logs.

### Release archive

Download the archive and matching checksum for your platform from the release:

```sh
# macOS example
shasum -a 256 -c little-imp-0.1.0-beta-macos.tar.gz.sha256
tar -xzf little-imp-0.1.0-beta-macos.tar.gz
cd little-imp-0.1.0-beta-macos/daemon
./install.sh
```

Use `little-imp-0.1.0-beta-linux.tar.gz` on Linux. Each archive includes the
daemon runtime files, installer assets, packaged `littleimp` CLI entry point,
built frontend bundle, version metadata, payload checksums, and signing
instructions. If the release includes `little-imp-0.1.0-beta-macos.tar.gz.asc`
or `little-imp-0.1.0-beta-linux.tar.gz.asc`, verify it before extraction:

```sh
gpg --verify little-imp-0.1.0-beta-macos.tar.gz.asc little-imp-0.1.0-beta-macos.tar.gz
```

### Source checkout

```sh
# 1. Clone the repository
git clone https://github.com/goniszewski/little-imp.git
cd little-imp/daemon

# 2. Run the installer
./install.sh
```

The installer will:

1. Copy daemon files to `~/.local/share/littleimp/daemon`
2. Install daemon dependencies (production only)
3. Build the frontend and install it to `~/.local/share/littleimp/dist`
4. Create a default config at `~/.local/share/littleimp/.env`
5. Register a LaunchAgent (macOS) or systemd user unit (Linux) so the daemon starts on login
6. Start the daemon and wait for it to become healthy

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
# One-command release upgrade
curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash -s -- --upgrade

# From the installed packaged CLI, selecting a release version to download
littleimp update install --version 0.1.0-beta

# From an unpacked release archive or source checkout
cd little-imp-0.1.0-beta-macos/daemon
./install.sh --upgrade
```

The CLI upgrade command downloads the selected platform archive, verifies its
published checksum, verifies a detached signature when one is available, runs
the packaged native installer with `--upgrade`, restarts the daemon, and checks
that `/health` reports the upgraded version. The native upgrade path stops the
daemon, replaces application files, reinstalls dependencies, rebuilds the
frontend when source files are present or reuses the bundled frontend archive,
and restarts. User data under `~/.local/share/littleimp`, runtime settings,
backups, and logs are preserved.

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
| `~/.local/share/littleimp/dist/` | Built frontend served by the daemon |
| `~/.local/share/littleimp/logs/` | Daemon stdout / stderr logs |

Homebrew installs keep Homebrew-managed data under
`$(brew --prefix)/var/little-imp` instead. The native installer, release
archive installer, and source checkout installer continue to use
`~/.local/share/littleimp/`.

Runtime user settings are stored separately at `~/.config/littleimp/config.json`.
AI and embedding execution uses those persisted settings first. Environment
variables such as `LLM_API_KEY`, `LLM_MODEL`, `EMBEDDING_API_KEY`,
`EMBEDDING_MODEL`, and provider base URLs are fallback defaults for first
install or unattended deployments. `GET /settings` redacts secrets as `"***"`;
round-tripping that response through `PUT /settings` preserves the stored
secret instead of writing the redacted placeholder.
Supported LLM providers are OpenAI, Ollama, Anthropic, OpenRouter, custom
OpenAI-compatible chat endpoints, DeepSeek international, and `none`.

### Backup and restore

The supported backup flow is the daemon backup API/UI, which creates a portable
snapshot directory under `~/.local/share/littleimp/backups/` by default. Each
snapshot contains `snapshot.db`, `manifest.json`, `checksums.sha256`, and
`data/settings.json`. Settings backups omit secrets such as API keys and PIN
hashes; restoring settings preserves the current local secrets. The Settings
page also supports custom local destinations, scheduled snapshots, and
S3-compatible remote backup targets. Local backups in Settings can be verified
without restoring them or wrapped as encrypted `.littleimp-backup.enc` package
files. Settings can verify or restore encrypted packages by daemon-local
absolute path when the package is under the configured backup folder. Browser
file pickers cannot provide arbitrary absolute paths, so use the packaged CLI
for encrypted packages stored elsewhere.

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

# Create an encrypted package from a new local snapshot
LITTLEIMP_BACKUP_PASSWORD='use-a-long-unique-password' \
  littleimp backup create --encrypt --output ~/Desktop/little-imp-backup.enc

# Verify an encrypted package without restoring it
LITTLEIMP_BACKUP_PASSWORD='use-a-long-unique-password' \
  littleimp backup verify --encrypted --file ~/Desktop/little-imp-backup.enc

# Restore a local backup by directory name
littleimp backup restore BACKUP_DIRECTORY_NAME --yes

# Restore an encrypted package
LITTLEIMP_BACKUP_PASSWORD='use-a-long-unique-password' \
  littleimp backup restore --encrypted-file ~/Desktop/little-imp-backup.enc --yes

# Restore a remote S3 snapshot key
littleimp backup restore --remote-key little-imp-backups/BACKUP_DIRECTORY_NAME/snapshot.db --yes
```

Add `--json` to any backup CLI command for machine-readable output. Set
`LITTLEIMP_DAEMON_URL` or pass `--daemon-url` when the daemon is listening on a
non-default localhost URL. Encrypted package commands can also read the password
from `--password-file`; keep that password separately because an encrypted
package cannot be restored without it. The `--output` file must not already
exist; this avoids overwriting an earlier backup by accident.

Every successful restore prints or returns the rollback directory, a
platform-specific restart command, and the `/health` URL to check after
restarting. Settings blocks the recovery screen until the daemon becomes
healthy again.

### Update checks and manual upgrades

The Settings page, daemon, and packaged `littleimp` CLI can manually check a
GitHub Releases-compatible source for newer releases with semver-style tags
such as `v0.2.0` or `v0.2.0-beta.1`. `littleimp update check` is read-only: it
only reports availability and never downloads or installs updates.

```sh
# Check the default release source
littleimp update check

# Check only stable releases and print machine-readable output
littleimp update check --channel stable --json

# Use an alternate release source
littleimp update check --source https://updates.example.com/little-imp/releases

# Download and install the latest compatible update found by the release source
littleimp update install

# Download and install a selected release from a release artifact base URL
littleimp update install --version 0.2.0-beta.1 \
  --release-base-url https://github.com/goniszewski/little-imp/releases/download/v0.2.0-beta.1

# Upgrade from an already downloaded archive, checksum, and optional signature
littleimp update install \
  --archive ~/Downloads/little-imp-0.2.0-beta.1-macos.tar.gz \
  --checksum ~/Downloads/little-imp-0.2.0-beta.1-macos.tar.gz.sha256 \
  --signature ~/Downloads/little-imp-0.2.0-beta.1-macos.tar.gz.asc

# Check through the daemon API
curl 'http://127.0.0.1:3210/updates/check?channel=stable'
```

Set `LITTLEIMP_UPDATE_SOURCE` to change the default source for scripted
environments. Beta builds check the beta channel by default; stable builds check
the stable channel by default. The daemon API rejects private and loopback
source hosts; use the CLI for explicit local mirrors in controlled offline
environments. When `update install` selects a release from a GitHub-compatible
`html_url`, it derives the matching artifact download URL. Set
`LITTLEIMP_RELEASE_BASE_URL` or pass `--release-base-url` when archives are
hosted somewhere else. Failed upgrades print rollback guidance; rerun the
previous verified release installer with `--upgrade` to revert application files
while preserving local data.

```sh
# Create a backup through the daemon
curl -X POST http://127.0.0.1:3210/backup

# Restore a named backup snapshot
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"name":"BACKUP_DIRECTORY_NAME"}'

# Verify a named local backup without restoring it
curl -X POST http://127.0.0.1:3210/backup/verify \
  -H "Content-Type: application/json" \
  -d '{"name":"BACKUP_DIRECTORY_NAME"}'

# Create an encrypted package from a named local backup
curl -X POST http://127.0.0.1:3210/backup/package \
  -H "Content-Type: application/json" \
  -d '{"name":"BACKUP_DIRECTORY_NAME","password":"use-a-long-unique-password"}'

# Verify an encrypted package without restoring it
curl -X POST http://127.0.0.1:3210/backup/package/verify \
  -H "Content-Type: application/json" \
  -d '{"path":"/absolute/path/inside/backups/BACKUP_DIRECTORY_NAME.littleimp-backup.enc","password":"use-a-long-unique-password"}'

# Restore an encrypted package
curl -X POST http://127.0.0.1:3210/restore \
  -H "Content-Type: application/json" \
  -d '{"source":"encrypted_package","path":"/absolute/path/inside/backups/BACKUP_DIRECTORY_NAME.littleimp-backup.enc","password":"use-a-long-unique-password"}'
```

Restore verifies checksums before replacing data, creates a rollback directory
under `DATA_DIR/restore-rollbacks/pre-restore-...`, and returns
`restart_required: true`, `restart_command`, `health_url`, and
`rollback_instructions`.

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
# Install the current release
curl -fsSL https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh | bash
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
- **AI:** Optional local LLM (Ollama), OpenAI, Anthropic, OpenRouter, DeepSeek, or custom OpenAI-compatible providers

For development setup and contribution guidelines, see the [Contributing Guide](./CONTRIBUTING.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.
