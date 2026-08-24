# Grimoire FAQ

Also published at [goniszewski.com/grimoire/faq](https://goniszewski.com/grimoire/faq).

## Can I sync my bookmarks across devices?

Not yet. Grimoire is local-first and single-user for `1.1.0`. Backups are snapshot-based, so you can move or restore a saved backup, but there is no continuous multi-device sync service.

## Is my data private?

Yes, by default. Bookmarks, extracted content, notes, tags, categories, embeddings, settings, backups, and logs are stored locally. External AI providers are optional; if you configure one, the content sent to that provider is governed by that provider's terms. You can use Grimoire without AI providers.

## What happens if the daemon crashes?

Bookmarks and jobs are stored in SQLite with WAL mode. Restart the daemon with your platform service manager or run `npm run daemon:dev` again during development. The durable job queue resumes pending ingestion work after the daemon starts.

## Can I use it without AI providers?

Yes. Saving, importing, keyword search, tags, categories, archive/trash, backup/restore, diagnostics, and local integrations work without AI. The UI shows degraded-mode guidance when summaries, generated tags, semantic search, or embeddings need a configured provider.

## How do I migrate from Grimoire 0.5.x?

The v0.5 migration tools are **experimental**. Review the dry-run output and
keep backups of both the v0.5 data and the Grimoire 1.x library before applying
a migration.

Migration is **non-destructive** for your v0.5 data and **additive** for Grimoire 1.x:

- The migrator reads a snapshot of `db.sqlite` and never writes into the v0.5
  data directory (including WAL sidecars).
- `--dry-run` previews counts without changing the 1.x library or media cache.
- Apply inserts/merges into the existing 1.x library; it does not wipe it.
- Apply commits as one SQLite transaction (individual bookmark failures soft-skip
  inside that transaction; a crash before commit rolls the whole apply back).
- Re-running without `--merge` skips URLs that already exist.
- Stop the old Grimoire v0.5 process first, and take a 1.x backup before apply
  if the local library already has bookmarks you care about.
- Soft-skipped bookmark failures still yield HTTP 207 / CLI exit 1 after a
  successful commit of the rest.

Point the migrator at your v0.5 `data/` directory (the folder that contains
`db.sqlite` and usually `user-uploads/`), install Grimoire 1.x, start the daemon,
then run:

```sh
littleimp migrate inspect --data-dir /path/to/grimoire/data
littleimp migrate apply --data-dir /path/to/grimoire/data --owner YOUR_USERNAME --dry-run
littleimp migrate apply --data-dir /path/to/grimoire/data --owner YOUR_USERNAME --yes
# Or pack the data folder first:
littleimp migrate apply --archive /path/to/grimoire-data.tar.gz --owner YOUR_USERNAME --yes
```

If the database has multiple users, `--owner` is required. You can optionally pass
`--password` / `--password-file` to verify the v0.5 account password before
import. Supported archives: `.zip`, `.tar`, `.tar.gz`/`.tgz`, `.tar.bz2`, `.tar.xz`.
Grimoire 1.x does not recreate multi-user logins — it imports one owner's
library into the local single-user library. PocketBase-era backups (≤0.3.x) are
not supported. See the [migration API reference](../API.md#migrate).

## How do I upgrade?

For source or unpacked release installs, run `daemon/install.sh --upgrade`.
Packaged installs can use `littleimp update install` once a reachable release
source is configured. Settings can also check for update availability.

## Does it work on Windows?

There is no native Windows installer in `1.1.0`. Docker on Windows with WSL2 is the supported path. Keep Docker port publishing bound to loopback, for example `127.0.0.1:3210:3210`.

## Can I run it on a server?

Yes through Docker, but Grimoire itself is not a public-server product in
`1.1.0`. Keep the daemon loopback-bound or put an authenticated tunnel,
VPN, or reverse proxy in front of it before traffic reaches Grimoire. See
[remote access](./06-remote-access.md), [SECURITY.md](../SECURITY.md), and
[docker-deployment.md](./docker-deployment.md).
