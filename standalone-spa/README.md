# Grimoire Standalone SPA Frontend

An alternative frontend for the [Grimoire](https://github.com/goniszewski/grimoire) bookmark manager — a single-file SPA that talks to the same backend API.

## Features

### Core UX
- **Always-on-top search bar** — two-row fixed header with instant search. `Ctrl+K` or `/` to focus, filtered results in 250ms.
- **Categories button + drawer** — bottom-sheet category browser for mobile, sidebar for desktop
- **Quick Peek modal** — click any bookmark card to preview title, description, tags, domain, date, and source without leaving the page. Escape to dismiss.
- **Saved Collections** — save search filters as named collections in localStorage. Restore with one click.
- **Random Bookmark 🎲** — discovers forgotten gems with a single button. Auto-dismissing toast.
- **Mobile bottom nav** — Grid / List / Categories / Random on all mobile viewports.

### Graphify Dashboard
- **Always visible** (collapsible) — 4 metric cards (Total, Categories, Top Category, Domains)
- **4 interactive charts** — Category distribution (horizontal bar), Top Domains (doughnut), Timeline (line), Import Sources (pie)
- **Click charts to filter** — click a category bar to see only those bookmarks, click a domain slice to search that domain, click a timeline point to filter by date
- **Smart insights bar** — auto-generated stats like "Top category: AI & Agents (51.8%)", "Main source: X/Twitter"
- **Chart filter indicator** — shows active filter with "✕ Clear" button
- **Cache & background refresh** — 5-minute localStorage cache with silent background refresh

### Auto-Categorization Import Script
`scripts/nightly-sync.py` — a Python script that:
- Syncs new bookmarks from X/Twitter (via `bird` CLI) and Raindrop API
- Deduplicates against existing Grimoire bookmarks
- Auto-categorizes into 13 content categories using two-pass heuristics (domain match → keyword match)
- Tags with `#x` or `#raindrop` for source provenance
- Fetches secrets from 1Password vault
- Designed to run as a nightly cron job

## Usage

### Frontend
1. Serve `standalone-spa/index.html` via any HTTP server (nginx, Caddy, etc.)
2. Set the `API` endpoints to point at your Grimoire backend
3. Log in with your Grimoire credentials

### Sync Script
```bash
pip install -r scripts/requirements.txt
source /creds/op/op_env  # if using 1Password
python3 scripts/nightly-sync.py
```

## Architecture

This is a **single-page application** (~60KB) with zero build step. It uses:
- Vanilla DOM manipulation (no framework)
- Chart.js for visualizations (CDN-loaded)
- The Grimoire REST API directly (cookie-based auth via Lucia/SvelteKit)

All features work with an **unmodified Grimoire backend** — no server-side changes needed.
