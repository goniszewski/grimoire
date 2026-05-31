# TASK-094: Bookmark Mutation And Detail Regression Tests

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
**Area:** QA / bookmarks
**Source:** PAR-013
**Labels:** grimoire-parity, tests, bookmarks

## Description

Add regression tests for bookmark field mutations and visible detail controls.

## Scope

1. Cover title, summary, tags, category, notes, pin/starred mapping, archive,
   trash, read state, read-later flag, and open metrics as applicable.
2. Cover frontend detail controls and daemon update validation.
3. Include conflict and fallback cases for unsupported or immutable fields.
4. Keep tests focused around the central API client and route behavior.

## Acceptance Criteria

- [ ] Daemon tests cover every supported bookmark mutation field.
- [ ] Frontend tests cover visible detail controls and optimistic/error states.
- [ ] Unsupported fields have explicit validation or no editable affordance.
- [ ] New parity fields from related tasks are covered before those tasks close.
- [ ] Tests run through documented focused commands.

## Dependencies

- Should be expanded as TASK-089, TASK-091, and TASK-092 land.
