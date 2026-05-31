# TASK-111: Export Parity Fields

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] JSON export includes approved bookmark parity fields.
- [ ] CSV export includes stable columns for approved parity fields.
- [ ] Export docs describe the fields and empty/default values.
- [ ] Existing export filters still work.
- [ ] Tests cover notes, read/archive state, pinned/starred mapping, read-later
      state, and open metrics when available.

## Dependencies

- Depends on TASK-089 and TASK-091 for new fields.
