<div align="center">
  <img alt="Grimoire Logo" src="public/grimoire_logo_300.webp">
  <h1>Grimoire</h1>
  <p>Save, search, and organize the knowledge that matters to you — all local, all private.</p>
</div>

<br>

[![Quality Gates](https://github.com/goniszewski/grimoire/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/goniszewski/grimoire/actions/workflows/quality.yml)
![Release target](https://img.shields.io/badge/release-1.0.0-7c3aed)
![Bun 1.x](https://img.shields.io/badge/Bun-1.x-black)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Grimoire is a local-first bookmark manager for people who save technical resources and need to find them later. Save links, import browser bookmarks, extract readable content, search by keyword or meaning, and let optional AI providers summarize and organize your library — while your data stays on your machine.

> [!NOTE]
> **Grimoire 1.0** is a complete rewrite — a fresh start for the project. The legacy Grimoire (v0.5.x, SvelteKit-based) is preserved on the [`legacy/v0.x`](https://github.com/goniszewski/grimoire/tree/legacy/v0.x) branch.
> If you are coming from v0.5.x: no direct migration tool exists yet, but it is a **high priority** on the [roadmap](./docs/roadmap.md).
> Everything remains **local-first**, **private**, and **100% open source** under the MIT license.

## Contents

- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
- [What Grimoire Does](#what-grimoire-does)
- [How It Works](#how-it-works)
- [Install And Upgrade Paths](#install-and-upgrade-paths)
- [Data, Privacy, And Security](#data-privacy-and-security)
- [Configuration](#configuration)
- [Backups And Restore](#backups-and-restore)
- [Local Integrations](#local-integrations)
- [Development](#development)
- [Documentation](#documentation)
- [Repository Metadata](#repository-metadata)

## Screenshots

The screenshots below use synthetic/demo data from the local UI audit set.

| Library | Search | Bookmark detail |
| --- | --- | --- |
| ![Grimoire library list with categories, domains, tags, and processing badges](./docs/presentations/ui-ux-audit-assets/library-list-overview.png) | ![Search overlay with a design query against the bookmark library](./docs/presentations/ui-ux-audit-assets/ai-command-palette-search-state.png) | ![Bookmark detail drawer showing notes, tags, category, actions, and related bookmarks](./docs/presentations/ui-ux-audit-assets/bookmark-detail-standard.png) |

| Settings and browser integration | Import flow | Mobile library |
| --- | --- | --- |
| ![Settings browser integration section with token and bookmarklet controls](./docs/task-reports/2026/06/2026-06-02-task-126-browser-bookmarklet-client/assets/02-settings-browser-integration.svg) | ![Import dialog showing a successful browser bookmark import queued for processing](./docs/presentations/ui-ux-audit-assets/import-bookmarks-success.png) | ![Mobile Grimoire library view with compact controls and bookmark cards](./docs/presentations/ui-ux-audit-assets/mobile-library-stack.png) |

## Quick Start

### Source Checkout

This is the recommended development path. It works from a public clone and does not
depend on release assets.

```sh
git clone https://github.com/goniszewski/grimoire.git
cd grimoire

npm install
cd daemon && bun install
cd ..
```

Start the daemon and frontend in separate terminals:

```sh
npm run daemon:dev
```

```sh
npm run dev
```

Open the Vite app at `http://127.0.0.1:8080`. The app talks to the daemon at
`http://127.0.0.1:3210`.

### Docker

Docker serves the built frontend and daemon API from one loopback-bound port.

```sh
docker compose up -d
curl http://127.0.0.1:3210/health
```

Open `http://127.0.0.1:3210`.

## What Grimoire Does

- Saves public `http` and `https` URLs from the app, API, MCP, import flow, or
  browser bookmarklet.
- Extracts readable content from normal web pages, PDFs, GitHub repositories,
  GitHub issues, StackOverflow/StackExchange pages, and YouTube
  metadata/transcripts where available.
- Stores bookmarks, content, tags, categories, jobs, notes, timeline events,
  backups, and settings locally in SQLite and local files.
- Searches with SQLite FTS5 keyword search, semantic embedding search, or a
  hybrid ranking mode.
- Supports archive, trash, read state, read-later flags, pinning, notes,
  category/tag management, import/export, backup/restore, diagnostics, and
  local update checks.
- Runs without AI providers. Optional providers include OpenAI, Ollama,
  Anthropic, OpenRouter, DeepSeek international, and custom OpenAI-compatible
  chat or embeddings endpoints.

## How It Works

Grimoire has two runtime parts:

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, and Radix UI primitives
  under `src/`.
- Daemon: Bun, Hono, and SQLite under `daemon/`, listening on
  `127.0.0.1:3210` by default.

Bookmark ingestion is progressive:

```text
save URL
  -> enqueue durable SQLite job
  -> fetch public content
  -> extract readable text and metadata
  -> enrich with optional AI summary, tags, and category
  -> create optional embeddings
  -> update search indexes
```

Bookmarks are visible immediately after save. Pipeline failures keep the
bookmark usable and expose retry/reprocess controls.

## Install And Upgrade Paths

### Native Source Install

The source installer copies daemon files, installs production dependencies,
builds the frontend, writes a default config, registers the user service, and
starts the daemon.

```sh
cd daemon
./install.sh
```

Upgrade from an unpacked source checkout or release archive:

```sh
cd daemon
./install.sh --upgrade
```

Uninstall while preserving data:

```sh
cd daemon
./install.sh --uninstall
```

Purge data only when you intentionally want to remove the local library:

```sh
cd daemon
./install.sh --uninstall --purge
```

### Homebrew (pending live validation)

The repository includes a Homebrew formula, but public install, service
lifecycle, and data-preservation checks have not passed against release assets.
It is not a supported beta installation path yet. The release decision records
the validation required before these commands are published for users.

## Data, Privacy, And Security

Native installs keep user data under `~/.local/share/littleimp/`.

| Path | Contents |
| --- | --- |
| `~/.local/share/littleimp/littleimp.db` | SQLite database |
| `~/.local/share/littleimp/.env` | Install-time daemon defaults |
| `~/.local/share/littleimp/dist/` | Built frontend served by the daemon |
| `~/.local/share/littleimp/backups/` | Local snapshots and encrypted packages |
| `~/.local/share/littleimp/restore-rollbacks/` | Pre-restore rollback copies |
| `~/.local/share/littleimp/logs/` | Daemon logs |

Runtime user settings live at `~/.config/littleimp/config.json`. Homebrew
installs keep Homebrew-managed data under `$(brew --prefix)/var/little-imp`.

Grimoire is local-first and loopback-first:

- Native daemon default: `127.0.0.1:3210`.
- Docker host port default: `127.0.0.1:3210:3210`.
- General REST routes are intended for first-party loopback use.
- MCP and protected capture endpoints require managed local integration bearer
  tokens.
- Public-network exposure is not a supported mode; put an authenticated tunnel,
  VPN, or reverse proxy in front of it if you deliberately need remote access.

See [SECURITY.md](./SECURITY.md) and
[security-boundaries.md](./docs/security-boundaries.md).

## Configuration

The daemon reads install-time defaults from `~/.local/share/littleimp/.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Bind address. Keep localhost for security. |
| `PORT` | `3210` | Daemon HTTP port. |
| `DATA_DIR` | `~/.local/share/littleimp` | Database, backups, and logs. |
| `NODE_ENV` | `production` | Use `development` for local development logging. |
| `LOG_FORMAT` | `json` | `json` or `pretty`. |

AI and embedding settings are managed in Settings and persisted in
`~/.config/littleimp/config.json`. Secret fields are redacted in API responses,
diagnostics, and portable settings backups.

## Backups And Restore

Settings and the packaged `littleimp` CLI can create, verify, encrypt, and
restore local backup snapshots. Each normal snapshot contains:

- `snapshot.db`
- `manifest.json`
- `checksums.sha256`
- `data/settings.json`

CLI examples:

```sh
littleimp backup create
littleimp backup list
littleimp backup verify --file ~/.local/share/littleimp/backups/BACKUP_NAME
littleimp backup restore BACKUP_NAME --yes
```

Encrypted package examples:

```sh
LITTLEIMP_BACKUP_PASSWORD='use-a-long-unique-password' \
  littleimp backup create --encrypt --output ~/Desktop/little-imp-backup.enc

LITTLEIMP_BACKUP_PASSWORD='use-a-long-unique-password' \
  littleimp backup verify --encrypted --file ~/Desktop/little-imp-backup.enc
```

Restores verify checksums, create a rollback directory, replace local data, and
return a restart command plus `/health` URL. See
[backup-design.md](./docs/backup-design.md).

## Local Integrations

### REST API

The generated API reference is [API.md](./API.md). The source contract is
[docs/api-contract.json](./docs/api-contract.json), generated from
`daemon/src/api/contract.ts`.

```sh
curl http://127.0.0.1:3210/health
```

### MCP

Grimoire exposes Streamable HTTP MCP at `http://127.0.0.1:3210/mcp`. Create
a local integration token first:

```sh
curl -X POST http://127.0.0.1:3210/integration-tokens \
  -H "Content-Type: application/json" \
  -d '{"name":"Local MCP client"}'
```

Use the returned token as `Authorization: Bearer ...`.

### Browser Bookmarklet

Settings -> Browser Integration can create a token-backed bookmarklet. Drag it
to your browser bookmarks bar, then click it on a page to capture the current
URL, title, and selected text into Grimoire.

The bookmarklet embeds an integration token. Treat it like a password.

## Development

```sh
npm install
cd daemon && bun install
cd ..
```

Core commands:

```sh
npm run dev
npm run daemon:dev
npm run lint
npm run type-check
npm run test
npm run test:daemon
npm run test:e2e
npm run build
```

Full local quality gate:

```sh
npm run check
```

If `node`, `npm`, `npx`, or `bun` are missing in a sandboxed environment, run:

```sh
npm run tools:setup
export PATH="$PWD/local/bin:$PATH"
```

Then rerun the normal commands.

## Documentation

- [FAQ](./docs/faq.md)
- [API Reference](./API.md)
- [API Contract](./docs/api-contract.json)
- [Project Overview](./docs/overview.md)
- [Product Requirements](./docs/prd.md)
- [Roadmap](./docs/roadmap.md)
- [Backup Design](./docs/backup-design.md)
- [Diagnostics](./docs/diagnostics.md)
- [Docker Deployment](./docs/docker-deployment.md)
- [Update System](./docs/update-system.md)
- [Release Notes](./docs/release-notes-v0.1.0-beta.md)
- [Release Decision](./docs/release-decision-v0.1.0-beta.md)
- [Release Checklist](./docs/release-checklist.md)
- [Security Policy](./SECURITY.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Task Board](./tasks/README.md)
- [Task Reports](./docs/task-reports/index.html)

## Repository Metadata

Recommended GitHub settings for public visibility:

- Description: `Local-first bookmark manager with content extraction, semantic search, optional AI enrichment, backups, and local integrations.`
- Homepage: leave blank until a product site exists, or use the GitHub repository URL.
- Topics: `bookmark-manager`, `local-first`, `sqlite`, `bun`, `hono`,
  `react`, `vite`, `typescript`, `semantic-search`, `llm`, `mcp`,
  `backup`, `self-hosted`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT. See [LICENSE](./LICENSE).
