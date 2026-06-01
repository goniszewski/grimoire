# TASK-107: Preserve Import Folder Hierarchy

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
**Area:** import / categories
**Source:** PAR-035
**Labels:** grimoire-parity, import, categories

## Description

Preserve Netscape folder hierarchy as Little Imp categories during import using
the parser's existing `folders` data.

## Scope

1. Inspect current Netscape import parser folder output.
2. Map nested folders to Little Imp categories with stable parent relationships.
3. Assign imported bookmarks to the matching category.
4. Handle duplicate folder names under different parents.

## Acceptance Criteria

- [x] Netscape folder hierarchy imports as nested categories.
- [x] Imported bookmarks retain their source folder category.
- [x] Duplicate folder names under different parents do not collide.
- [x] Import progress and result data include category creation.
- [x] Tests cover nested folders, empty folders, duplicates, re-import, and
      category route limits.

## Dependencies

- Coordinates with TASK-108, TASK-109, TASK-113, and TASK-120.

## Work Notes

- June 1, 2026: Implemented Netscape folder-path preservation for imports.
  The parser now emits unique folder paths in document order, including empty
  folders, while keeping bookmark-level folder paths.
- Added parent-scoped category lookup and import category path resolution so
  same-named folders under different parents become distinct Little Imp
  categories and re-imports reuse existing paths.
- Imported bookmarks are created with the deepest matching category id, and
  import summary/progress data now includes parsed folder count plus category
  creation/reuse counters.
- Import category resolution mirrors category route limits by capping source
  paths to the supported three levels and capping category names to 100
  characters before lookup or creation.
- Regenerated `API.md`, `docs/api-contract.json`, and `docs/openapi.json` from
  the source API contract.
- Verification passed: `bun test daemon/src/test/integration/import.test.ts`
  with 9/9 tests, `npm run docs:api:check`, `npm run lint` (existing Fast
  Refresh warnings only), `npm run type-check`, `npm run test:daemon`, and
  `npm run check`, and `git diff --check`.
- Moved to `done` on June 1, 2026 after review hardening, full local
  verification, and owner request to commit and push the completed task.
- Task report:
  `docs/task-reports/2026/06/2026-06-01-task-107-preserve-import-folder-hierarchy/index.html`.
