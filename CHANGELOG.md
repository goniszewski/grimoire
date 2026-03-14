# Changelog

All notable changes to Little Imp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0-beta] - 2026-03-13

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
- Comprehensive test suite: 87 daemon unit tests, 36 integration tests, Vitest + Playwright frontend tests
