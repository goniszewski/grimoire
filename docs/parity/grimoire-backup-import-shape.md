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

- Reads v0.5 `data/db.sqlite` (+ optional `user-uploads/`) or a packed archive.
- Requires `--owner` (or `owner` in the API body) when more than one user exists.
- Supports `--dry-run` / `dryRun` to preview create/merge/skip counts without writing.
- Optional password verification against `user.password_hash` proves ownership
  only — it does **not** create Grimoire 1.x accounts.
- Imports bookmarks, categories, tags, approved parity fields, and local media.
- Rejects private/loopback bookmark URLs, path-traversal media paths, oversized
  media, unsafe archive members (zip-slip), and non-v0.5 / PocketBase-shaped DBs.

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
| `bookmark.url`, `domain`, `title`, `description` | `bookmarks.url`, `domain`, `title`, `description` | Public http(s) URL validation; private/loopback URLs are skipped. |
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
`daemon/src/test/cli-migrate.test.ts`, and
`daemon/src/test/integration/migrate-legacy.test.ts`:

- v0.5 SQLite fixture inspect/normalize/apply
- owner selection + optional password verification
- private URL skip, parity field mapping, media path traversal / size limits
- zip / tar.gz archive apply and zip-slip rejection
- PocketBase-shaped DB rejection
- API contract / docs regeneration for `/migrate/legacy/*`
