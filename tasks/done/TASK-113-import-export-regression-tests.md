# TASK-113: Import Export Regression Tests

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
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

- [x] Large import fixtures are covered without excessive test runtime.
- [x] Nested folders, duplicates, invalid URLs, and private URLs are tested.
- [x] Import duplicate policy, preview, commit, and result report states are
      tested.
- [x] JSON and CSV parity fields are tested.
- [x] Test commands are documented in related implementation notes.

## Dependencies

- Should expand with TASK-107 through TASK-111 and TASK-120.

## Work Notes

- June 1, 2026: Started as the next logical local task because TASK-078 and
  TASK-079 remain blocked on public artifact visibility, while TASK-113 is the
  remaining high-priority Grimoire parity QA task whose import/export
  dependencies are complete.
- Added daemon regression coverage for a 90-bookmark Netscape parser fixture,
  a 67-row import preview/commit fixture with active merge, archived/trashed
  restore, source duplicates, invalid/private URLs, nested folders, and final
  progress/result counts, plus JSON/CSV export serialization for summary,
  category, tags, notes, read state, pinned state, read-later state, and open
  metrics.
- Added frontend import dialog coverage for large preview row caps so aggregate
  counts stay visible while only the first 50 rows render.
- Verification passed:
  - `bun test src/test/netscape-parser.test.ts src/test/integration/import.test.ts src/test/integration/bookmarks.test.ts`
  - `npm run test -- src/components/ImportDialog.test.tsx`
  - `npm run lint` with existing Fast Refresh warnings only
  - `npm run type-check`
  - `git diff --check`
- June 1, 2026: Review pass found no crucial code defect in the added
  regression coverage. Task hygiene was corrected and broader validation passed:
  `npx tsc --noEmit`, `npm test`, `npm run test:daemon`, `npm run lint`, and
  `git diff --check`.
- Task report added at
  `docs/task-reports/2026/06/2026-06-01-task-113-import-export-regression-tests/index.html`.
