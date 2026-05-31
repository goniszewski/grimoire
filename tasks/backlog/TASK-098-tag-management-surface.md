# TASK-098: Tag Management Surface

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
**Area:** tags / frontend
**Source:** PAR-017
**Labels:** grimoire-parity, tags, ui

## Description

Add a dedicated tag management surface for listing, creating, deleting, and
browsing tags outside bookmark detail.

## Scope

1. Add navigation to a tag management view.
2. List tags with counts, loading, empty, and error states.
3. Support tag creation and deletion with validation and conflict handling.
4. Link tags to filtered library results or tag detail pages.

## Acceptance Criteria

- [ ] Users can list all tags independent of current bookmark results.
- [ ] Users can create and delete tags from a dedicated surface.
- [ ] Tag counts do not depend on the currently loaded bookmark page.
- [ ] Deleting a tag has confirmation and clear result feedback.
- [ ] Frontend and daemon tests cover list/create/delete behavior.

## Dependencies

- Coordinates with TASK-099 and TASK-118.
