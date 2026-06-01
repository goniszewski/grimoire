# TASK-100: Tag Rename API And UI

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** tags / daemon / frontend
**Source:** PAR-019
**Labels:** grimoire-parity, tags, api, ui

## Description

Add tag rename API and UI so existing tags can be renamed without editing each
bookmark manually.

## Scope

1. Define rename semantics, duplicate handling, and validation.
2. Add daemon route, repository operation, API contract, and generated docs.
3. Add tag rename controls in the management and detail surfaces.
4. Refresh bookmark lists, filters, and tag counts after rename.

## Acceptance Criteria

- [x] Renaming a tag updates all affected bookmark tag references atomically.
- [x] Duplicate target names are rejected or merged according to documented
      behavior.
- [x] API contract and docs include the rename flow.
- [x] UI handles success, validation errors, and refreshes.
- [x] Tests cover daemon rename behavior and frontend controls.

## Dependencies

- Depends on TASK-098.

## Work Notes

- May 31, 2026: Started from the Grimoire parity queue after TASK-078 and
  TASK-079 remained blocked on public artifact visibility, TASK-090 was already
  rejected, and TASK-101 depended on the rename behavior from this task.
  Rename semantics are conservative: the API rejects duplicate target names
  instead of merging tags implicitly.
- May 31, 2026: Added `PUT /tags/:id`, repository-level rename support,
  generated API docs, shared frontend rename controls on tag management and tag
  detail pages, focused daemon/frontend tests, e2e verification, and a visual
  task report. Moved to in review after local verification passed.
- June 1, 2026: Completed review hardening for tag rename cache consistency,
  duplicate-name race handling, FTS search verification, generated API docs, and
  full local verification. Moved to done.
