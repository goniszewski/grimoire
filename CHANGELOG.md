# Changelog

All notable changes to Grimoire will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-07-20

### Changed
- General-availability release. The `littleimp`/`littleimpd` daemon and CLI
  tooling names are stable on-disk identifiers and remain unchanged.

## [Unreleased]

No unreleased changes.

## [0.1.0-beta] - 2026-05-28

### Added
- Local-first bookmark manager with a React SPA frontend (Vite + Tailwind + shadcn/ui)
- `littleimpd` — a standalone Bun/Hono background daemon that runs at `127.0.0.1:3210`
- SQLite-backed bookmark storage with full-text and semantic (embedding) search
- Content extraction pipeline: fetches page title, description, favicon, and reading time
- AI enrichment: auto-tagging and category suggestions via a local LLM (Ollama-compatible)
- Auto-clustering / category organisation — disabled until library reaches 20 bookmarks
- Browser bookmark import (HTML export format supported by Chrome, Firefox, Safari)
- JSON / CSV export with active-filter support
- Archive, trash, pin, and read-status tracking per bookmark
- Keyboard shortcuts: `⌘N` add, `⌘K` AI palette, `Escape` dismiss selection
- Global paste handler — paste any URL on the main screen to add it instantly
- Dark mode by default; light mode toggle
- macOS LaunchAgent (auto-starts on login) and Linux systemd user unit
- Idempotent `install.sh` with `--upgrade` and `--uninstall [--purge]` modes
- `DaemonOfflineBanner` — shown when the daemon is unreachable
- First-run empty-state screen with prompts to add or import bookmarks
- Timeline, Archive, Trash, Domains, and Review Queue views
- App lock with optional PIN and configurable auto-lock timeout
- Settings page for AI, embeddings, backup destination, scheduled snapshots, and S3-compatible backup targets
- Portable backup/restore snapshots with manifest, checksums, non-secret settings export, rollback directory creation, and restart-required restore responses
- Docker deployment path that serves the frontend and daemon API from one loopback-bound container port
- Streamable HTTP MCP endpoint at `/mcp` with bookmark search, read, create, and category-list tools
- Source-of-truth API contract in `daemon/src/api/contract.ts` with generated `API.md` and `docs/api-contract.json`
- CI and local quality gates for linting, type-checks, frontend tests, daemon tests, API docs drift checks, production build, E2E tests, and Docker health validation
- Packaged `littleimp` CLI backup commands for create, list, restore, verify, encrypted package creation, encrypted package verification, and encrypted package restore.
- In-app local backup verification from Settings without restoring a snapshot.
- Multi-provider LLM settings for Anthropic, OpenRouter, OpenAI-compatible custom endpoints, and DeepSeek, plus custom OpenAI-compatible embeddings.
- Native installer support for installing a prebuilt frontend bundle from packaged release layouts.
- CLI, daemon API, and Settings update checks for GitHub Releases-compatible release sources.
- Packaged `littleimp update install` flow for explicit native upgrades with archive download, local archive support, checksum/signature verification, daemon restart, health-version verification, and rollback guidance.
- Settings backup rows can create encrypted `.littleimp-backup.enc` packages through the daemon `/backup/package` endpoint.
- Settings and daemon API support encrypted package verification and restore for package files under the configured backup folder.
- Homebrew formula for an alternate MVP install path backed by checksum-verified release archives and `brew services`.
- Redacted local diagnostics from Settings, `littleimp diagnostics`, and `GET /diagnostics` for support bundles without telemetry.
- Production browser hardening headers, loopback-only unsafe browser origin handling, and declared body-size guards for expensive local operations.
- Installed-artifact E2E smoke coverage for packaged archive install, daemon health, core user journeys, backup/restore, update checks, upgrade data preservation, and uninstall without purge.

### Changed
- Release documentation now leads with install-without-clone paths, separates shipped MVP behavior from post-MVP ideas, and calls out publication-gated Homebrew validation.
