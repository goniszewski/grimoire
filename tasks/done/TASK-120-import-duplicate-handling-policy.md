# TASK-120: Import Duplicate Handling Policy

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** import / daemon / frontend
**Source:** PAR-038
**Labels:** grimoire-parity, import, duplicates

## Description

Add explicit duplicate handling choices for browser/Netscape imports before
pre-import review and remapping work commits data.

## Scope

1. Detect duplicate URLs across active, archived, and trashed bookmarks during
   import preview.
2. Default active duplicate handling to skip, with an option to merge imported
   tags, category, and notes.
3. For archived duplicates, offer restore plus merge.
4. For trashed duplicates, offer restore plus merge or keep skipped.
5. Keep invalid URLs and private URLs skipped and reported, not created.
6. Apply the selected duplicate policy consistently during import commit.

## Acceptance Criteria

- [x] Import preview classifies active, archived, trashed, new, invalid, and
      private URL rows.
- [x] Active duplicates default to skip and can merge tags/category/notes.
- [x] Archived duplicates can be restored and merged.
- [x] Trashed duplicates can be restored and merged or left skipped.
- [x] Invalid and private URLs are skipped and included in the report.
- [x] Tests cover duplicate detection, default choices, merge behavior, restore
      behavior, and skipped rows.

## Dependencies

- Should be implemented before TASK-108, TASK-109, and TASK-110 so preview,
  remapping, and result reports use the same duplicate semantics.

## Work Notes

- June 1, 2026: Started as the next logical actionable task because TASK-108
  depends on this duplicate policy and earlier open release-validation tasks are
  blocked on public artifact visibility.
- Added `POST /import/preview` as a non-mutating multipart preview endpoint that
  returns row classifications, selected duplicate policy, summary estimates,
  detected folder paths, tags, warnings, and row-level actions.
- Added shared daemon import analysis so preview and commit use the same
  classification and duplicate policy semantics. Defaults skip active,
  archived, and trashed duplicates; selected policies can merge active
  duplicates and restore-merge archived or trashed duplicates, including
  imported tags, folder category, and note-like metadata.
- Review follow-up: repeated new URLs inside the same import file are now
  previewed as duplicates and committed as skip/merge actions instead of
  attempting duplicate inserts. Netscape `<DD>` descriptions are also imported
  as note-like metadata.
- Moved to done after review hardening, full local verification, and owner
  request to commit and push the completed task.
- Import progress now reports queued, skipped, merged, and restored counts so
  clients can track commit progress across create, merge, restore, and skip
  actions.
- Regenerated `API.md`, `docs/api-contract.json`, and `docs/openapi.json`;
  added frontend API helpers for preview and policy commit fields; and updated
  the import progress calculation to include merged/restored rows.
- Verification passed: `bun test daemon/src/test/integration/import.test.ts`,
  `npm run test:daemon`, `npm run test`, `npm run lint` (existing Fast Refresh
  warnings only), `npm run type-check`, `npm run docs:api:check`,
  `npm run build` (existing Browserslist/chunk-size warnings only), and
  `git diff --check`.
- Task report:
  `docs/task-reports/2026/06/2026-06-01-task-120-import-duplicate-handling-policy/index.html`.
