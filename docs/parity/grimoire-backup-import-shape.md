# Grimoire Backup Import Shape

Status: future implementation handoff
Last updated: June 2, 2026

Direct Grimoire or PocketBase backup import is not part of the current
`0.1.0-beta` batch. This document records the source data shape and Little Imp
field mapping so a future task can start from known inputs instead of
rediscovering the Grimoire migration model.

## Sources Inspected

- Local Grimoire checkout:
  `/Users/robert/Documents/repos/goniszewski/grimoire-project/grimoire`
- Grimoire commit: `adc57cba9d3f8e35ec9a2e1785b5bbbd11c537b2`
- Grimoire package version: `0.5.0`
- Source files:
  - `src/lib/utils/data-migration/pb-schema.ts`
  - `src/lib/utils/data-migration/migrate-data.ts`
  - `src/lib/utils/data-migration/download-migration-backup.ts`
  - `src/lib/database/schema.ts`
  - `grimoire-website/docs/migration-tool/migration-tool.md`

## Scope Boundary

Future import tooling should reuse Little Imp's existing import review model:
preview first, explicit duplicate policy, category/tag remapping, commit, result
report, and regression fixtures. It should not bypass those flows with a direct
database restore.

The current local-first batch still excludes:

- Grimoire-compatible endpoint aliases.
- Browser-extension or bookmarklet compatibility tests.
- Multi-user account, session, admin, or per-user backup behavior.
- Manual bookmark importance fields.
- Direct runtime support for PocketBase as a dependency.

## Source Shapes

### Legacy PocketBase Backup

Grimoire's migration tool accepts a PocketBase admin backup ZIP. The inspected
code extracts the ZIP into a temporary directory, opens `data.db` at the
extracted root, and looks for uploaded files under `storage/`.

The legacy collections modeled by `pb-schema.ts` are:

| Collection | Important fields |
| --- | --- |
| `users` | `id`, `name`, `username`, `email`, `passwordHash`, `avatar`, `settings`, `verified`, `disabled`, `created`, `updated` |
| `categories` | `id`, `name`, `slug`, `description`, `color`, `icon`, `initial`, `archived`, `public`, `parent`, `owner`, `created`, `updated` |
| `tags` | `id`, `name`, `slug`, `owner`, `created`, `updated` |
| `bookmarks` | `id`, `url`, `domain`, `title`, `description`, `author`, `content_html`, `content_text`, `content_type`, `note`, `main_image`, `main_image_url`, `icon`, `icon_url`, `screenshot`, `importance`, `flagged`, `read`, `archived`, `opened_last`, `opened_times`, `owner`, `category`, `tags`, `created`, `updated` |

Uploaded bookmark files are referenced by filename in `bookmarks.icon`,
`bookmarks.main_image`, and `bookmarks.screenshot`. Grimoire's migration code
searches `storage/<collection>/<bookmark-id>/<filename>` without hardcoding the
collection directory name.

### Current Grimoire SQLite Data

After Grimoire's own migration, the current SQLite schema has these tables:

| Table | Import-relevant fields |
| --- | --- |
| `user` | `id`, `name`, `username`, `email`, `settings`, `verified`, `disabled`, `is_admin`, `avatar_id`, `created`, `updated` |
| `category` | `id`, `name`, `slug`, `description`, `color`, `icon`, `initial`, `archived`, `public`, `parent_id`, `owner_id`, `created`, `updated` |
| `tag` | `id`, `name`, `slug`, `owner_id`, `created`, `updated` |
| `bookmark` | `id`, `url`, `domain`, `title`, `description`, `author`, `content_text`, `content_html`, `content_type`, `content_published_date`, `note`, `main_image_url`, `main_image_id`, `icon_url`, `icon_id`, `screenshotId`, `importance`, `flagged`, `read`, `archived`, `opened_last`, `opened_times`, `owner_id`, `category_id`, `created`, `updated` |
| `bookmarks_to_tags` | `bookmark_id`, `tag_id` |
| `file` | `id`, `file_name`, `storage_type`, `relative_path`, `size`, `mime-type`, `source`, `owner_id`, `created`, `updated` |

Future tooling should decide whether it supports legacy PocketBase backups,
current Grimoire SQLite data, or both. Supporting both will need separate source
readers that normalize into one Little Imp import preview model.

## Little Imp Field Mapping

| Source data | Little Imp target | Notes |
| --- | --- | --- |
| `bookmarks.url`, `domain`, `title`, `description` | `bookmarks.url`, `domain`, `title`, `description` | Reuse current URL validation and duplicate classification before commit. |
| `bookmarks.author` | `bookmark_content.author` | Preserve when content metadata is imported. |
| `bookmarks.content_text` | `bookmark_content.markdown` | Store imported plain text as searchable content, or transform it to Markdown before commit if richer formatting is required. |
| `bookmarks.content_html` | `bookmark_content.raw_html` | Sanitize or treat as imported source content; do not render unchecked HTML directly. |
| `bookmarks.content_type` | No direct target | Little Imp has no content type column today, and `bookmark_content.language` is not a safe substitute. Keep this in preview/result metadata unless a schema change is approved. |
| `bookmarks.content_published_date` | `bookmark_content.published_at` | Available in current Grimoire SQLite data, not the inspected legacy PocketBase schema. |
| `bookmarks.note` | `bookmarks.notes` | Same note-like parity field used by browser import descriptions. |
| `bookmarks.flagged` | `bookmarks.is_pinned` | Map any non-empty timestamp to `1`; this follows the approved starred/favorite to pinned decision. |
| Future read-later source field, if present | `bookmarks.read_later` | The inspected Grimoire schemas do not expose a read-later field; default to `0` unless a future source shape has one. |
| `bookmarks.read` | `bookmarks.read_at` | Preserve timestamp when present. |
| `bookmarks.archived` | `bookmarks.is_archived` | Preserve archived state. Do not import trashed state unless a future source shape defines it. |
| `bookmarks.opened_times` | `bookmarks.opened_count` | Preserve as a non-negative integer. |
| `bookmarks.opened_last` | `bookmarks.last_opened_at` | Preserve timestamp when present. |
| `bookmarks.importance` | No target | Manual importance remains rejected for this batch. Keep it out of schema, UI, filters, sorting, import, and export unless a future ranking design reopens it. |
| `categories.name`, `slug`, `description`, `color`, `icon` | `categories.name`, `slug`, `description`, `color`, `icon` | Reuse existing category metadata fields. |
| `categories.archived`, `public` | `categories.is_archived`, `is_public` | Treat public as local metadata only; it must not imply network sharing. |
| `categories.parent` or `parent_id` | `categories.parent_id` | Preserve all parent relationships after IDs are mapped. Do not repeat Grimoire's legacy migration bug that updates only the first parented category. |
| `tags.name`, `slug` | `tags.name` plus import mapping metadata | Little Imp stores tag names, not slugs. Use slugs only for collision handling or result details. |
| `bookmarks.tags` or `bookmarks_to_tags` | `bookmark_tags` | Apply after tag IDs and bookmark IDs are mapped. |
| `bookmarks.icon`, `icon_url` | `bookmark_media` kind `favicon`, plus `bookmarks.favicon_url` when useful | Copy local files through Little Imp media cache rules; never trust archive paths directly. |
| `bookmarks.main_image`, `main_image_url` | `bookmark_media` kind `image` | Preserve source URL and cached file when available. |
| `bookmarks.screenshot` or `screenshotId` | `bookmark_media` kind `screenshot`, plus `bookmarks.screenshot_url` when useful | Keep path traversal, content type, size, and local-only media checks. |
| `created`, `updated` timestamps | Matching Little Imp timestamp fields | Requires a dedicated import insertion path; the normal URL create path currently uses current timestamps. |
| `users` and owner fields | Import owner selection or explicit merge policy | Current Little Imp is single-user. Future tooling must not silently import multi-user account semantics. |

## Required Future Decisions

Before implementing a direct importer, decide:

1. Whether the first implementation supports legacy PocketBase backups, current
   Grimoire SQLite data, or both.
2. Whether a multi-user source can be imported only after selecting one owner,
   or whether an explicit "merge all owners into this local library" mode is
   acceptable.
3. Whether imported `content_html` is stored as raw source data only or
   transformed before display.
4. Whether media import preserves all source files or only favicon, main image,
   and screenshot references.
5. Whether source timestamps should be preserved through a new repository
   method instead of the normal bookmark create path.

## Verification Requirements

A future implementation should include:

- Parser tests for legacy PocketBase backup ZIP shape and/or current Grimoire
  SQLite shape.
- Daemon import preview tests covering categories, tags, duplicate URL classes,
  invalid/private URLs, archived state, read state, pinned mapping, notes, open
  metrics, and media references.
- Commit tests proving preview decisions, duplicate policy, remapping, and
  result rows match the imported data.
- Regression tests that export imported rows and confirm approved parity fields
  survive JSON and CSV export.
- Media safety tests for path traversal, missing files, unsupported media types,
  and bounded file sizes.
- Performance fixtures for large source databases before the importer is
  exposed in normal user flows.
- API docs drift checks if new daemon routes or response shapes are added.
- A visual task report if any UI is added or changed.
