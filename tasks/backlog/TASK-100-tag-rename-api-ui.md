# TASK-100: Tag Rename API And UI

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Renaming a tag updates all affected bookmark tag references atomically.
- [ ] Duplicate target names are rejected or merged according to documented
      behavior.
- [ ] API contract and docs include the rename flow.
- [ ] UI handles success, validation errors, and refreshes.
- [ ] Tests cover daemon rename behavior and frontend controls.

## Dependencies

- Depends on TASK-098.
