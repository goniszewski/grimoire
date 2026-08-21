# Grimoire Backup Import Shape

Status: implemented for Grimoire **v0.5 SQLite** via `littleimp migrate` and
`POST /migrate/legacy/*` (TASK-146). PocketBase-era backups (≤0.3.x) are
intentionally out of scope.
Last updated: August 21, 2026

Point the migrator at a v0.5 `data/` directory (`db.sqlite` + optional
`user-uploads/`), or at a compressed archive of that layout
(`.zip`, `.tar`, `.tar.gz`/`.tgz`, `.tar.bz2`, `.tar.xz`). Prefer those entry
points over restoring data directly into SQLite.

## Sources Inspected

- Local Grimoire checkout (legacy/v0.x):
  `/Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire`
- Grimoire commit: `adc57cba9d3f8e35ec9a2e1785b5bbbd11c537b2`
- Grimoire package version: `0.5.0`
- Source files:
  - `src/lib/database/schema.ts` (v0.5 Drizzle/SQLite schema)
  - Historical PocketBase migration helpers under
    `src/lib/utils/data-migration/` (reference only; not used by 1.x migrate)

## Scope Boundary

Shipped behavior:

- Reads v0.5 `data/db.sqlite` (+ optional `user-uploads/`) or a packed archive
  via a temp DB snapshot so the source directory is not written.
- Requires `--owner` (or `owner` in the API body) when more than one user exists.
- Supports `--dry-run` / `dryRun` to preview create/merge/skip counts without writing
  to the 1.x library or media cache.
- Apply is additive (never wipes the destination library) and commits as one
  SQLite transaction; concurrent apply on the same daemon is rejected with HTTP 409.
- Optional password verification against `user.password_hash` proves ownership
  only — it does **not** create Grimoire 1.x accounts.
- Imports bookmarks, categories, tags, approved parity fields, and local media.
- Rejects credential and non-http bookmark URLs, path-traversal media paths,
  oversized media, unsafe archive members (zip-slip / symlinks / hardlinks
  refused before extract), and non-v0.5 / PocketBase-shaped DBs.
- Imports private/LAN http(s) URLs into SQLite for data fidelity; skips
  post-migrate ingest for those hosts (SSRF). IPv4-mapped/compatible IPv6
  literals (`::ffff:…`, `::7f00:1`) and FQDN forms like `localhost.` are
  treated as private the same way.

Still excluded:

- PocketBase-era admin backup ZIPs / `data.db`.
- Multi-user account recreation or “merge all owners” mode.
- Manual bookmark importance fields.
- Direct runtime support for PocketBase as a dependency.
- Grimoire-compatible endpoint aliases / browser-extension compatibility tests.

## Source Shape (v0.5 SQLite)

On-disk layout: `data/db.sqlite` + optional `data/user-uploads/`.

| Table | Import-relevant fields |
| --- | --- |
| `user` | `id`, `name`, `username`, `email`, `password_hash`, `settings`, `initial` (verified), `disabled`, `is_admin`, `avatar_id`, `created`, `updated` |
| `category` | `id`, `name`, `slug`, `description`, `color`, `icon`, `initial`, `archived`, `public`, `parent_id`, `owner_id`, `created`, `updated` |
| `tag` | `id`, `name`, `slug`, `owner_id`, `created`, `updated` |
| `bookmark` | `id`, `url`, `domain`, `title`, `description`, `author`, `content_text`, `content_html`, `content_type`, `content_published_date`, `note`, `main_image_url`, `main_image_id`, `icon_url`, `icon_id`, `screenshotId`, `importance`, `flagged`, `read`, `archived`, `opened_last`, `opened_times`, `owner_id`, `category_id`, `created`, `updated` |
| `bookmarks_to_tags` | `bookmark_id`, `tag_id` |
| `file` | `id`, `file_name`, `storage_type`, `relative_path`, `size`, `mime-type`, `source`, `owner_id`, `created`, `updated` |

Local media is resolved from `file.relative_path` under `user-uploads/`. Path
traversal (`..`), absolute escape, and symlink escape are rejected.

### Historical note: PocketBase backups

Older Grimoire releases used PocketBase collections (`users`, `bookmarks`, …)
and admin backup ZIPs with `data.db` + `storage/`. Those shapes are **not**
accepted by `littleimp migrate`. The PocketBase collection field list is retained
only as historical research context in older revisions of this document.

## Little Imp Field Mapping

| Source data | Little Imp target | Notes |
| --- | --- | --- |
| `bookmark.url`, `domain`, `title`, `description` | `bookmarks.url`, `domain`, `title`, `description` | http(s) URL validation; private/LAN hosts are imported with a warning (ingest skipped); credential URLs are skipped. |
| `bookmark.author` | `bookmark_content.author` | Preserved when content metadata is imported. |
| `bookmark.content_text` | `bookmark_content.markdown` | Stored as searchable text. |
| `bookmark.content_html` | `bookmark_content.raw_html` | Stored as imported source content. |
| `bookmark.content_type` | No direct target | Kept out of schema; may appear in warnings/metadata only. |
| `bookmark.content_published_date` | `bookmark_content.published_at` | Preserved when present. |
| `bookmark.note` | `bookmarks.notes` | Same note-like parity field used by browser import. |
| `bookmark.flagged` | `bookmarks.is_pinned` | Any non-zero / non-null value maps to pinned. |
| (no v0.5 read-later field) | `bookmarks.read_later` | Defaults to unset/`0`. |
| `bookmark.read` | `bookmarks.read_at` | Unix seconds → ISO timestamp when present. |
| `bookmark.archived` | `bookmarks.is_archived` | Preserved. |
| `bookmark.opened_times` | `bookmarks.opened_count` | Non-negative integer. |
| `bookmark.opened_last` | `bookmarks.last_opened_at` | Unix seconds → ISO timestamp when present. |
| `bookmark.importance` | No target | Skipped with a warning; not imported. |
| `category.name`, `slug`, `description`, `color`, `icon` | `categories.*` | Reuses existing category metadata fields. |
| `category.archived`, `public` | `categories.is_archived`, `is_public` | Local metadata only; not network sharing. |
| `category.parent_id` | nested category path → `parent_id` | Paths rebuilt from parent links (max depth aligned with import limits). |
| `tag.name`, `slug` | `tags.name` | Slugs are not stored; names are upserted. |
| `bookmarks_to_tags` | `bookmark_tags` | Applied after tag upsert. |
| `file` via `icon_id` / `main_image_id` / `screenshotId` | `bookmark_media` (+ favicon/screenshot URLs) | Local cache copy with size/type checks. |
| `created`, `updated` | matching bookmark timestamps | Applied after create via parity update. |
| `user` / owner fields | owner selection only | Multi-user sources require an explicit owner; accounts are not recreated. |

## Implementation Decisions (TASK-146)

1. **Source:** v0.5 SQLite only (not PocketBase backups).
2. **Multi-user:** select one owner; merge-all is deferred.
3. **Content HTML:** stored as `raw_html` without display transformation.
4. **Media:** favicon, main image, and screenshot references only.
5. **Timestamps:** preserved via post-create parity updates.

## Verification

Covered by daemon tests under `daemon/src/test/legacy-migrate.test.ts`,
`daemon/src/test/legacy-migrate-dirty.test.ts`,
`daemon/src/test/cli-migrate.test.ts`, and
`daemon/src/test/integration/migrate-legacy.test.ts`:

- v0.5 SQLite fixture inspect/normalize/apply
- owner selection + optional password verification (argon2 + bcrypt)
- private/credential/non-http URL skip, parity field mapping, media path traversal / size limits
- zip / tar.gz / tar.bz2 archive apply and zip-slip rejection
- WAL-mode source DB open, corrupt DB rejection, S3 media skip, deep categories, cycles
- re-run skip / `--merge` note append + activity preservation
- concurrent apply on the same daemon returns 409; whitespace/NUL title sanitization
- merge preserves local archive; cross-owner media skip; other-owner residual warning
- failed bookmark rollback + orphan media cleanup; missing uploadsDir soft-skip
- extensionless ICO magic-byte sniff; in-tree hardlinks allowed (symlink escape still rejected); dry-run media after apply
- dry-run category/tag counts match apply skip order (no inflate on existing-URL skip)
- media I/O failures soft-skip without aborting the bookmark savepoint
- FTS reindex preserves bookmark description in `summary` (not wiped to '')
- host-case matching against existing 1.x URLs (mixed-case hosts merge/skip correctly)
- --merge takes older created_at and newer updated_at; IDN hosts; nested zip data/ layouts
- --merge leaves local archive/unarchive untouched (no MAX re-archive)
- --merge leaves local pin/unpin untouched (no MAX re-pin)
- --merge fill-blanks favicon_url/screenshot_url (no clobber of local primaries)
- curated local favicon preferred over remote icon_url on fresh apply
- remote icon_url kept when curated favicon media is soft-skipped
- category metadata + large notes/HTML; tar.xz; prefer data/db.sqlite in archives
- in-library URL collapse; timestamp preserve; merge keeps local description/content
- CLI non-zero exit on bookmarksFailed; stderr “Partial apply” on 207; unresolved category parent warnings
- rolled-back create clears urlIndex (no phantom merge); null mergeImportDuplicate fails bookmark
- dry-run skips unreadable media (no extension fallthrough over-count)
- assertExtractTreeSafe fails closed on depth overflow / unreadable dirs (no skipped safety walk)
- findDbSqliteInTree walks to same depth as extract safety; prefers shallowest data/db.sqlite
- soft-skipped media (remote/cross-owner/missing file/uploads) counted in mediaSkipped
- post-migrate ingest preserveExistingContent also preserves non-blank description from LLM enrich
- post-ingest FTS summary falls back to bookmarks.description (migrate text stays searchable)
- FTS summary concatenates description + LLM summary so enrich does not drop migrate tokens
- migrate content upsert keeps bookmark_content.summary in FTS (same combineFtsSummary)
- bookmark pin/status updates no longer wipe LLM summary from FTS (migration 0018)
- description-only migrate rebuilds FTS after parity (0018 title-only trigger regression)
- extract-failure ingest rebuilds FTS; content FTS triggers keep description (migration 0019)
- --merge fills blank (whitespace) local descriptions from legacy
- --merge replaces URL-stub / blank local markdown (extract-failure leftovers) with legacy HTML/text
- --merge also replaces title-only extract-failure markdown stubs with legacy HTML/text
- truncated deep category paths do not overwrite real ≤3-level category metadata (archive/public/color)
- default Retry preserves author/published_at-only migrated content rows (same as description-only)
- dry-run media sniff uses the same 64-byte AVIF brand window as apply (no under-count)
- legacy:// media source_url keys use v0.5 relative_path (stable across remount/re-extract)
- category cache drops only keys touched by a failed bookmark (no categoriesReused inflation)
- Retry/reprocess preserves description-only migrated bookmarks (not only legacy media/HTML)
- PocketBase-shaped DB rejection
- API contract / docs regeneration for `/migrate/legacy/*`

### Real-data evidence (open)

Local `data/db.sqlite` is a valid v0.5 schema but wiped (0 users / 0 bookmarks).
Evidence so far:

- Leftover `user-uploads/` (~44 bookmark dirs) reconstructed + kitchen-sink adversarial mix: migrate OK
- Exact clone of real empty v0.5 `db.sqlite` schema (FKs/indexes/session) + argon2id user + real media slice: inspect / password-verify / apply OK (`legacy-migrate-exact-schema.test.ts`)
- Live `goniszewski/grimoire:latest` volume populated then migrated: nested categories, content HTML, media, host-case URL merge, private URL skip, password verify OK
- Live v0.5 **UI form actions** (signup + `addNewBookmark` / `addNewCategory`) produced a real library that migrated cleanly; uncovered and fixed duplicate-URL title preference (keep first real title)

An intact original *user* populated `db.sqlite` backup has still not been located —
that remains the strongest missing proof for production join fidelity on a
library that was never reconstructed. Local wiped DBs have freelist_count=0 (no
recoverable rows); running Docker volumes checked empty.
