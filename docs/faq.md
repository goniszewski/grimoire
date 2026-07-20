# Grimoire FAQ

## Can I sync my bookmarks across devices?

Not yet. Grimoire is local-first and single-user for `1.0.0`. Backups
are snapshot-based, so you can move or restore a saved backup, but there is no
continuous multi-device sync service.

## Is my data private?

Yes, by default. Bookmarks, extracted content, notes, tags, categories,
embeddings, settings, backups, and logs are stored locally. External AI
providers are optional; if you configure one, the content sent to that provider
is governed by that provider's terms. You can use Grimoire without AI
providers.

## What happens if the daemon crashes?

Bookmarks and jobs are stored in SQLite with WAL mode. Restart the daemon with
your platform service manager or run `npm run daemon:dev` again during
development. The durable job queue resumes pending ingestion work after the
daemon starts.

## Can I use it without AI providers?

Yes. Saving, importing, keyword search, tags, categories, archive/trash,
backup/restore, diagnostics, and local integrations work without AI. The UI
shows degraded-mode guidance when summaries, generated tags, semantic search,
or embeddings need a configured provider.

## How do I upgrade?

For source or unpacked release installs, run `daemon/install.sh --upgrade`.
Packaged installs can use `littleimp update install` once a reachable release
source is configured. Settings can also check for update availability. See
[update-system.md](./update-system.md).

## Does it work on Windows?

There is no native Windows installer in `1.0.0`. Docker on Windows with
WSL2 is the supported path. Keep Docker port publishing bound to loopback, for
example `127.0.0.1:3210:3210`.

## Can I run it on a server?

Yes through Docker, but Grimoire itself is not a public-server product in
`1.0.0`. Keep the daemon loopback-bound or put an authenticated tunnel,
VPN, or reverse proxy in front of it before traffic reaches Grimoire. See
[security-boundaries.md](./security-boundaries.md) and
[docker-deployment.md](./docker-deployment.md).
