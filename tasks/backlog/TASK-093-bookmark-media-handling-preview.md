# TASK-093: Bookmark Media Handling And Preview

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Favicons, screenshots, and extracted images have explicit storage/cache
      limits.
- [ ] Detail preview renders favicon, screenshot, and extracted images only when
      available.
- [ ] Screenshots and extracted images are excluded from normal backups unless a
      future explicit include-media setting is added.
- [ ] Missing media after restore is handled as unavailable or regenerable.
- [ ] Permanent delete purges associated media cache.
- [ ] Private or unsafe media fetches respect existing URL safety rules.
- [ ] Tests cover storage decisions and UI fallback states.

## Dependencies

- Depends on the security boundaries in TASK-087 if media fetching expands
  network behavior.
