# TASK-111: Export Parity Fields

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** export / bookmarks
**Source:** PAR-040
**Labels:** grimoire-parity, export, bookmarks

## Description

Expand JSON and CSV export to include approved parity fields such as notes, read
state, archive state, pinned/starred mapping, read-later state, and opened
metrics.

## Scope

1. Inventory current export fields and approved parity fields.
2. Add missing fields to JSON and CSV exports with stable column names.
3. Document export schema changes and backward compatibility expectations.
4. Add focused tests for filters and field presence.

## Acceptance Criteria

- [x] JSON export includes approved bookmark parity fields.
- [x] CSV export includes stable columns for approved parity fields.
- [x] Export docs describe the fields and empty/default values.
- [x] Existing export filters still work.
- [x] Tests cover notes, read/archive state, pinned/starred mapping, read-later
      state, and open metrics when available.

## Dependencies

- Depends on TASK-089 and TASK-091 for new fields.

## Work Notes

- June 1, 2026: Completed export parity fields by adding `is_archived`,
  `read_at`, and `notes` to `GET /export` JSON rows and CSV output while
  preserving the active-bookmarks-only export behavior.
- Appended the new CSV fields after the existing export columns to avoid
  reordering earlier columns for consumers that still read CSV positionally.
- Kept existing `is_pinned`, `read_later`, `opened_count`, and
  `last_opened_at` fields as the pinned/starred, read-later, and open-metric
  mappings.
- Updated the source API contract and regenerated `API.md`,
  `docs/api-contract.json`, and `docs/openapi.json` so exported null/default
  behavior is documented for integration and migration clients.
- Added focused daemon integration coverage for JSON field presence, CSV
  headers, CSV note escaping, and the existing export filters.
- Added visual task report:
  `docs/task-reports/2026/06/2026-06-01-task-111-export-parity-fields/`.
- Verification passed with focused export integration tests, the full daemon
  test suite, daemon type-checking, generated API docs drift checking, and
  OpenAPI-only drift checking, plus whitespace checks.
