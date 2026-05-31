# TASK-113: Import Export Regression Tests

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
**Area:** QA / import / export
**Source:** PAR-042
**Labels:** grimoire-parity, tests, import, export

## Description

Add import/export regression tests with large files, folder nesting, duplicates,
invalid URLs, and parity fields.

## Scope

1. Add focused daemon tests for import parser, preview, commit, and export
   serialization.
2. Add frontend tests for duplicate handling, preview, remapping, progress, and
   result report states.
3. Include large-file fixtures that stay reasonable for local and CI runtime.
4. Cover parity fields as they are added.

## Acceptance Criteria

- [ ] Large import fixtures are covered without excessive test runtime.
- [ ] Nested folders, duplicates, invalid URLs, and private URLs are tested.
- [ ] Import duplicate policy, preview, commit, and result report states are
      tested.
- [ ] JSON and CSV parity fields are tested.
- [ ] Test commands are documented in related implementation notes.

## Dependencies

- Should expand with TASK-107 through TASK-111 and TASK-120.
