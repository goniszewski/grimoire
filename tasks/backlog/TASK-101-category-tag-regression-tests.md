# TASK-101: Category And Tag Regression Tests

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
**Area:** QA / categories / tags
**Source:** PAR-020
**Labels:** grimoire-parity, tests, categories, tags

## Description

Add category and tag regression tests for empty rows, counts, drag reparenting,
delete behavior, and filter refresh.

## Scope

1. Cover empty category visibility and full tree navigation.
2. Cover category counts, drag reparenting, delete behavior, and filter refresh.
3. Cover tag list, create, delete, rename, detail, and counts as implemented.
4. Include daemon and frontend focused test coverage.

## Acceptance Criteria

- [ ] Empty categories and tags are covered by regression tests.
- [ ] Counts remain accurate after create, delete, move, and rename actions.
- [ ] Category drag/reparent behavior retains existing constraints.
- [ ] Filters refresh when category or tag state changes.
- [ ] Tests are documented in related task verification notes.

## Dependencies

- Should grow with TASK-095 through TASK-100.
