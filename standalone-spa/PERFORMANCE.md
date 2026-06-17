# Performance tuning for serving the standalone SPA via nginx

## Gzip compression
Reduces the SPA from ~61KB to ~21KB over the wire.

```nginx
gzip on;
gzip_types text/html text/css application/javascript application/json image/svg+xml;
gzip_min_length 256;
gzip_proxied any;
gzip_comp_level 5;
```

## Client-side caching
The SPA already implements:
- **5-minute localStorage cache** — full bookmark list + categories cached, instant render on revisit
- **Silent background refresh** — stale cache is shown immediately while a fetch runs in background
- **Cache indicator** — shows "cached 2m" in the header so you know data freshness
- **Force refresh** — the refresh button clears cache and fetches fresh data

## Proxy configuration (when behind nginx reverse proxy)

```nginx
location / {
    root /path/to/standalone-spa;
    try_files $uri /index.html;
    
    # Cache the SPA itself aggressively (it's version-pinned)
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }
    
    # API proxy to Grimoire backend
    location /api/ {
        proxy_pass http://grimoire:5173;
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 16k;
        proxy_busy_buffers_size 32k;
    }
}
```

## What's in the SPA

| Optimization | Detail |
|-------------|--------|
| localStorage cache | Full bookmark list cached for 5 minutes |
| Background refresh | Stale data shown instantly, fresh data fetched silently |
| Debounced search | 250ms debounce on keystrokes, avoids excessive API calls |
| Cache age indicator | Shows "cached 2m" in header |
| Force refresh button | Clears cache, fetches fresh data |
| Image lazy loading | `loading="lazy"` on all card thumbnails |
| SRI integrity | Chart.js loaded with integrity hash for secure CDN use |
| Minified inline SPA | Single ~61KB file with no external build step |
