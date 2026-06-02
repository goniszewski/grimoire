# TASK-119: Large Library Performance Tests

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
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

- [x] Large-library fixtures cover bookmarks, categories, tags, and imported
      files.
- [x] Performance budgets are explicit and measured by tests or scripts.
- [x] List, search, filters, import, and pagination checks are covered.
- [x] Heavy checks are separated from fast default tests if needed.
- [x] Results are documented in task verification notes.

## Dependencies

- Coordinates with TASK-114, TASK-116, and TASK-118.

## Work Notes

- June 2, 2026: Started as the next logical actionable task. TASK-078 and
  TASK-079 remain blocked on public artifact visibility, TASK-097 and TASK-098
  are already in review, and the other backlog records are deferred or rejected.
- Added a separate `npm run test:performance` command so large-library checks do
  not slow the default daemon suite. The script builds an in-memory daemon app
  with 2,000 bookmarks, 12 categories, 24 tags, searchable content, open/read
  metadata, and a 240-row Netscape import fixture.
- Explicit budgets are documented in `docs/performance.md` and enforced for
  first-page listing, deep pagination, keyword search, category filtering, tag
  filtering, import preview, and import commit/progress completion/background
  persistence.
- Semantic and hybrid search are documented as excluded from this deterministic
  local budget script because they require provider-backed availability.
- Verification passed:
  - `npm run test:performance`
  - `npm run type-check:daemon`
  - `npm run test:daemon`
  - `npm run lint` with the existing Fast Refresh warnings and no errors
  - `git diff --check`
- Review hardening updated the import performance check to wait for the progress
  stream to report completion, verify zero failed rows, verify all 240 ingest
  jobs were queued, and then check final bookmark persistence.
