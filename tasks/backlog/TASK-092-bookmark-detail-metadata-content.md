# TASK-092: Bookmark Detail Metadata And Content Sections

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Detail view exposes extracted readable content or markdown when available.
- [ ] Author, published date, word count, language, and pipeline metadata render
      when present.
- [ ] Missing metadata does not create noisy empty UI.
- [ ] API types and tests cover newly exposed fields.
- [ ] Desktop and narrow layouts remain readable.

## Dependencies

- Coordinate with extraction pipeline behavior before adding new stored fields.
