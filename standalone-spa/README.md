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

### Performance
- **Client-side cache** — 5-minute localStorage cache with instant render on revisit
- **Silent background refresh** — stale cache shown immediately, fresh data fetched silently
- **Debounced search** — 250ms debounce prevents excessive API calls while typing
- **Cache age indicator** — shows data freshness in the header ("cached 2m")
- **Lazy image loading** — all thumbnails use `loading="lazy"`
- **SRI integrity** — Chart.js loaded with subresource integrity hash (see [PERFORMANCE.md](PERFORMANCE.md) for nginx config)

### Security
- All user content escaped via `escapeHtml()` (textContent-based, XSS-safe)
- No inline event handlers in generated HTML
- `crypto.getRandomValues()` for random selection (not `Math.random()`)
- CDN resources loaded with SRI integrity hashes

## Usage

1. Serve `index.html` via any HTTP server (nginx, Caddy, etc.)
2. See [PERFORMANCE.md](PERFORMANCE.md) for recommended nginx config
3. Log in with your Grimoire credentials
4. That's it — no build step, no framework, no server-side changes

## Architecture

- **~62KB single-file SPA** — zero build step, no framework dependency
- **Vanilla DOM** — all rendering via template literals with explicit escaping
- **Chart.js** — loaded from CDN for visualization (4 chart types)
- **Grimoire REST API** — cookie-based auth via Lucia/SvelteKit sessions
- **localStorage** — for client-side cache and saved collections

All features work with an **unmodified Grimoire backend** — no server-side changes needed.
