# TASK-119: Large Library Performance Tests

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
**Area:** QA / performance
**Source:** PAR-048
**Labels:** grimoire-parity, performance, tests

## Description

Add large-library performance tests for list, search, category filters, tag
filters, import, and pagination.

## Scope

1. Define representative large-library fixtures and performance budgets.
2. Test list, keyword search, semantic/hybrid search where available, category
   filters, tag filters, import preview/commit, and pagination.
3. Keep tests deterministic and practical for local or CI execution.
4. Document how to run heavier performance checks separately if needed.

## Acceptance Criteria

- [ ] Large-library fixtures cover bookmarks, categories, tags, and imported
      files.
- [ ] Performance budgets are explicit and measured by tests or scripts.
- [ ] List, search, filters, import, and pagination checks are covered.
- [ ] Heavy checks are separated from fast default tests if needed.
- [ ] Results are documented in task verification notes.

## Dependencies

- Coordinates with TASK-114, TASK-116, and TASK-118.
