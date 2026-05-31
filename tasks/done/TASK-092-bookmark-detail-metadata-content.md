# TASK-092: Bookmark Detail Metadata And Content Sections

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** bookmarks / frontend
**Source:** PAR-011
**Labels:** grimoire-parity, bookmark-detail, ui

## Description

Expand bookmark detail with richer content and metadata sections for extracted
markdown/content, author, published date, word count, language, and pipeline
metadata.

## Scope

1. Inventory stored metadata and extraction outputs that can be shown now.
2. Add missing daemon fields only where extraction can populate them reliably.
3. Design dense detail sections for content, source metadata, and pipeline state.
4. Keep empty or unavailable fields quiet and understandable.

## Acceptance Criteria

- [x] Detail view exposes extracted readable content or markdown when available.
- [x] Author, published date, word count, language, and pipeline metadata render
      when present.
- [x] Missing metadata does not create noisy empty UI.
- [x] API types and tests cover newly exposed fields.
- [x] Desktop and narrow layouts remain readable.

## Dependencies

- Coordinate with extraction pipeline behavior before adding new stored fields.

## Work Notes

- May 31, 2026: Started as the next actionable Grimoire parity task after the
  remaining release-closeout tasks stayed blocked on public artifact visibility.
  Initial inventory found the daemon already stores and exposes
  `bookmark_content` metadata through `GET /bookmarks/:id`, so this pass should
  focus on frontend detail loading/rendering and regression coverage rather than
  adding a migration.
- May 31, 2026: Implemented detail endpoint loading, source metadata and
  extracted content rendering, focused frontend and daemon regression tests,
  desktop/mobile visual verification, and a task report.
- May 31, 2026: Review pass blocked extracted Markdown from hotlinking remote
  images, forced extracted links to open as safe external links, reran the
  focused and broad verification suite, and moved the task to done.
