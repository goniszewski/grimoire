# Migrate from Grimoire v0.5

Grimoire 1.1.0 includes an **experimental** migration tool for importing one
owner's library from the legacy Grimoire v0.5 SQLite application into a local
Grimoire 1.x library.

> This guide describes the v0.5 migrator in the 1.1.0 release line. Older
> development builds may not include the `grimoire migrate` command.

The already-published v1.1.0 archive predates the CLI rename and exposes the
same migrator as `littleimp migrate`. Current source installs and future
repackaged releases use `grimoire migrate`; `littleimp` remains a compatibility
alias.

The migrator accepts a v0.5 SQLite data directory, a `db.sqlite` file, or an
archive containing that data. It does not support PocketBase-era backups from
the older 0.3.x line.

## Before you start

1. Stop the old Grimoire v0.5 process so its database is no longer receiving
   writes.
2. Keep the original v0.5 data directory and make a separate backup of it.
   The migrator reads a temporary snapshot and does not write to the source
   database or its WAL sidecars, but the source remains your recovery copy.
3. Install and start Grimoire 1.x, then confirm that its daemon is healthy:

   ```sh
   curl http://127.0.0.1:3210/health
   ```

4. Run the `grimoire` CLI from the same Grimoire installation as the daemon.

If you are working from a source checkout rather than a packaged install, run
the CLI with `bun run cli --` from the `daemon/` directory.

## Supported source formats

| CLI option | Source | Media behavior |
| --- | --- | --- |
| `--data-dir DIR` | v0.5 `data/` directory containing `db.sqlite` | Reads `user-uploads/` automatically when it is present |
| `--db FILE` | A v0.5 `db.sqlite` file | Add `--uploads-dir DIR` when media is stored separately |
| `--archive FILE` | `.zip`, `.tar`, `.tar.gz`/`.tgz`, `.tar.bz2`, or `.tar.xz` | The archive must contain `db.sqlite`; include `user-uploads/` for local media |

The v0.5 source must use the legacy SQLite schema. A PocketBase `data.db`, a
raw PocketBase backup, or an unrelated SQLite database is rejected.

## Migration workflow

### 1. Inspect without writing

Start by listing the source owners and record counts:

```sh
grimoire migrate inspect --data-dir /path/to/grimoire/data
```

For a database file or archive:

```sh
grimoire migrate inspect \
  --db /path/to/grimoire/data/db.sqlite \
  --uploads-dir /path/to/grimoire/data/user-uploads

grimoire migrate inspect --archive /path/to/grimoire-data.tar.gz
```

Inspect is read-only. It reports the number of users, bookmarks, categories,
tags, and referenced media files. Add `--json` for machine-readable output or
`--daemon-url URL` when the daemon is not at `http://127.0.0.1:3210`.

If the source has more than one user, choose one owner with a username, email,
or numeric v0.5 user ID. Only the selected owner's library is imported.

### 2. Run a dry run

Use the same source and owner for a no-write preview:

```sh
grimoire migrate apply \
  --data-dir /path/to/grimoire/data \
  --owner YOUR_USERNAME \
  --dry-run
```

`--dry-run` does not change the Grimoire 1.x database or media cache. Review
the planned counts and warnings before applying. It does not require `--yes`.

### 3. Apply the migration

When the preview is correct, apply it explicitly:

```sh
grimoire migrate apply \
  --data-dir /path/to/grimoire/data \
  --owner YOUR_USERNAME \
  --yes
```

`--yes` is required because apply writes into the local Grimoire library. The
archive form is equivalent:

```sh
grimoire migrate apply \
  --archive /path/to/grimoire-data.tar.gz \
  --owner YOUR_USERNAME \
  --yes
```

By default, existing bookmarks with the same canonical URL are skipped. Add
`--merge` when re-running a migration and you want those existing URLs
reconciled instead of skipped. The apply is additive; it does not wipe the
existing 1.x library.

### Optional owner-password verification

Password verification proves ownership of the selected v0.5 account. It does
not create a Grimoire 1.x account or restore multi-user login behavior.

Prefer a password file or environment variable over putting a password in
shell history:

```sh
grimoire migrate apply \
  --data-dir /path/to/grimoire/data \
  --owner YOUR_USERNAME \
  --password-file /path/to/v05-password.txt \
  --yes
```

```sh
LITTLEIMP_MIGRATE_PASSWORD='your-v05-password' \
  grimoire migrate apply \
    --data-dir /path/to/grimoire/data \
    --owner YOUR_USERNAME \
    --yes
```

The inline `--password` option is also supported. The password is checked
against the selected v0.5 password hash and is never used to create a new
account.

## What is imported

The selected owner's bookmarks, content fields, notes, read/archive/pin state,
open counts, categories, tags, and available local favicon/image/screenshot
files are imported where the source data is valid. Existing categories and tags
are reused when they match the local library.

The migrator also preserves safe private or LAN bookmark URLs as library data,
but it does not enqueue post-migration fetching for those URLs. Remote-only
media is not downloaded. Invalid URLs, missing references, unsafe media paths,
and files that fail media validation appear as skipped items or warnings.

Grimoire 1.x remains a local-first, single-user application. The migration does
not import v0.5 users, password hashes, sessions, or account administration.

## Safety and recovery behavior

- The source database is serialized into a temporary snapshot before reading;
  the v0.5 data directory is not modified.
- Apply adds data to the existing 1.x library and commits database changes in a
  transaction. A crash before commit rolls back the database changes.
- Individual bookmark or media problems are reported as warnings where the
  rest of the migration can continue.
- A partial bookmark apply is reported in the summary. The CLI exits non-zero
  when any bookmarks fail, even if the rest of the transaction committed.
- Archive paths, symlinks, hardlinks, extraction depth, and expanded size are
  checked before archive data is used.

Keep the v0.5 source until you have reviewed the imported library and warnings.
If the 1.x library already contains important data, create a Grimoire backup
before applying the migration.

## Troubleshooting

### `Not a Grimoire v0.5 SQLite database`

Confirm that the source is the v0.5 `data/db.sqlite`, not a PocketBase
`data.db`. The v0.5 directory normally also contains `user-uploads/`.

### Multiple users are listed

Run apply again with a unique `--owner` value. Use the username, email, or ID
shown by `migrate inspect`.

### Media is skipped

For `--db`, pass the matching `--uploads-dir`. For `--data-dir`, keep
`user-uploads/` beside `db.sqlite`. For an archive, include that directory in
the archive. Missing, remote, unsafe, oversized, or non-image files are
reported as skipped by design.

### The CLI cannot connect

Start the Grimoire daemon and check `/health`. If it listens on another local
port, pass `--daemon-url http://127.0.0.1:PORT`.

For the HTTP equivalents and response schemas, see the [migration section of
the API reference](https://github.com/goniszewski/grimoire/blob/main/API.md#migrate).
