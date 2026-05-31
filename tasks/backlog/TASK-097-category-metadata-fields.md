# TASK-097: Category Metadata Fields

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Approved category metadata persists and validates correctly.
- [ ] Category API responses and update routes include the fields.
- [ ] UI supports editing and rendering metadata without clutter.
- [ ] `public` or visibility fields do not expose data externally.
- [ ] Tests cover migration, API validation, and UI editing.

## Dependencies

- Depends on TASK-087 before any visibility field can affect network behavior.
