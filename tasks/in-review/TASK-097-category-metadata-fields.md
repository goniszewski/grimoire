# TASK-097: Category Metadata Fields

**Phase:** Grimoire parity
**Priority:** medium
**Status:** in-review
**Area:** categories / daemon / frontend
**Source:** PAR-016
**Labels:** grimoire-parity, categories, api, ui

## Description

Add optional category fields from Grimoire parity: color, icon, description,
slug, archived, and public visibility.

## Scope

1. Confirm field semantics that fit Little Imp's local-first product model.
2. Add migration, repository, API contract, validation, and generated docs.
3. Add category create/edit controls and visible metadata rendering.
4. Treat public visibility as local metadata only unless a sharing mode is
   separately approved.

## Acceptance Criteria

- [x] Approved category metadata persists and validates correctly.
- [x] Category API responses and update routes include the fields.
- [x] UI supports editing and rendering metadata without clutter.
- [x] `public` or visibility fields do not expose data externally.
- [x] Tests cover migration, API validation, and UI editing.

## Dependencies

- Depends on TASK-087 before any visibility field can affect network behavior.

## Work Notes

- May 31, 2026: Implemented as local category metadata only. The `is_public`
  flag persists, validates, appears in API responses, and renders in the UI, but
  does not change daemon bind address, CORS behavior, route exposure, sharing,
  or publication behavior.
- Added append-only migration `0013_category_metadata.sql`, repository support,
  route validation, generated API docs, frontend API types, sidebar metadata
  carriage, and category-detail rendering/editing.
- Verification passed for focused daemon category tests, focused category detail
  UI tests, full frontend tests, full daemon tests, lint, type-check, API docs
  check, production build, and e2e. Visual verification used an isolated
  loopback daemon and Vite dev server with desktop, edit-form, and narrow
  screenshots in
  `docs/task-reports/2026/05/2026-05-31-task-097-category-metadata-fields/`.
- Review pass fixed unset color preservation in the metadata editor, rejected
  non-object JSON category request bodies with 422 responses instead of 500s,
  tightened generated metadata constraints, refreshed the edit-form screenshot,
  and re-ran docs, lint, type-check, frontend, daemon, build, e2e, and
  whitespace verification successfully.
