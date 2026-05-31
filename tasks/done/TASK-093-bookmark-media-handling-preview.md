# TASK-093: Bookmark Media Handling And Preview

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** bookmarks / extraction / frontend
**Source:** PAR-012
**Labels:** grimoire-parity, media, bookmark-detail

## Description

Implement local media handling for favicon, screenshot, and extracted images,
then add a bookmark detail media preview with conservative cache and backup
rules.

## Scope

1. Store or cache favicons as lightweight bookmark metadata.
2. Add local cached screenshots and extracted images with size, count, and total
   cache limits.
3. Do not hotlink remote media from the app when doing so could leak user
   browsing behavior.
4. Fetch only safe public `http` and `https` media that passes existing private
   host and URL safety rules.
5. Treat screenshots and extracted images as rebuildable cache by default;
   favicons/small metadata can be included in normal backups.
6. Purge cached media when a bookmark is permanently deleted.
7. Add a compact detail preview for available media.

## Acceptance Criteria

- [x] Favicons, screenshots, and extracted images have explicit storage/cache
      limits.
- [x] Detail preview renders favicon, screenshot, and extracted images only when
      available.
- [x] Screenshots and extracted images are excluded from normal backups unless a
      future explicit include-media setting is added.
- [x] Missing media after restore is handled as unavailable or regenerable.
- [x] Permanent delete purges associated media cache.
- [x] Private or unsafe media fetches respect existing URL safety rules.
- [x] Tests cover storage decisions and UI fallback states.

## Dependencies

- Depends on the security boundaries in TASK-087 if media fetching expands
  network behavior.

## Work Notes

- May 31, 2026: Added local bookmark media cache metadata and bounded file
  storage under `media-cache/`, with limits for favicons, page preview images,
  extracted images, per-bookmark image count, and total cache size.
- Media candidates are extracted from favicon links, Open Graph/Twitter preview
  metadata, and article images. The daemon fetches only safe public HTTP(S)
  media, validates redirects before following them, rejects private hosts,
  rejects SVG and non-image responses, enforces byte limits, and serves cached
  files from `/media/bookmarks/:bookmarkId/:mediaId`. Candidates that resolve to
  the same final URL are deduplicated before insert.
- Bookmark detail responses now include a `media` set. The frontend normalizes
  local daemon media paths, removes the Google favicon fallback, uses a local
  generated favicon when no cache exists, and hides missing media files after
  restore or cache loss.
- Permanent delete and expired trash purge remove associated cache files when a
  data directory is available. Normal backups continue to include the SQLite
  snapshot and settings only, so screenshot/extracted-image files remain
  rebuildable cache outside the portable backup payload.
- Review pass hardened media fetching against private-host redirects, remote SVG
  cache serving, and duplicate final media URLs before moving the task to done.
