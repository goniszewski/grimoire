# TASK-109: Import Category And Tag Remapping

**Phase:** Grimoire parity
**Priority:** medium
**Status:** done
**Area:** import / categories / tags
**Source:** PAR-037
**Labels:** grimoire-parity, import, categories, tags

## Description

Add category and tag remapping before committing imported bookmarks.

## Scope

1. Let users map imported folders to existing or new categories.
2. Let users map imported tags to existing, new, renamed, or skipped tags.
3. Apply remapping consistently during the import commit.
4. Include remapping decisions in import preview and result data.
5. Apply remapping together with the duplicate policy selected in TASK-120.

## Acceptance Criteria

- [x] Users can remap imported folders before commit.
- [x] Users can remap imported tags before commit.
- [x] Remapping decisions apply to every imported bookmark consistently.
- [x] Preview and result reports show the chosen mappings.
- [x] Tests cover existing, new, renamed, skipped, and conflicting mappings.

## Dependencies

- Depends on TASK-108 and TASK-120.
- Coordinates with TASK-107 and TASK-110.

## Work Notes

- June 1, 2026: Implemented daemon-owned import remapping for folders and tags.
  Preview and commit now accept a multipart `remapping` JSON field, normalize
  folder mappings to existing category IDs or create/reuse target paths, and
  normalize tag mappings to existing, new, renamed, or skipped target tags.
- Commit applies remapping together with the selected duplicate policy so new
  rows, active duplicate merges, and archived/trashed restore-merge rows use
  the same mapped category and tag targets shown in preview.
- Import preview rows now include `targetCategoryId`, `targetCategoryPath`, and
  `targetTags`; preview and import-accepted responses include the normalized
  remapping plan for result data consumers.
- Added import dialog remapping controls and preview refresh behavior for
  category and tag mapping changes.
- Review hardening: nested folder paths now inherit remapped parent category
  targets unless explicitly overridden, explicit new/renamed tag targets are
  validated against the tag API format and length cap, import completion now
  refreshes category aggregates, and API docs now include the remapping request
  JSON shape.
- Regenerated `API.md`, `docs/api-contract.json`, and `docs/openapi.json`.
- Added visual report:
  `docs/task-reports/2026/06/2026-06-01-task-109-import-category-tag-remapping/index.html`.
- Verification passed:
  `bun test daemon/src/test/integration/import.test.ts`,
  `npx vitest run src/components/ImportDialog.test.tsx src/lib/api.test.ts src/hooks/use-bookmarks.test.ts`,
  `npm run lint`, `npm run type-check`, `npm run docs:api:check`,
  `npm run build`, `npm run test:e2e -- e2e/business-requirements.spec.ts`,
  `npm run check`, and `git diff --check`.
- June 1, 2026: Review completed and TASK-109 moved to done after the full
  `npm run check` gate and whitespace diff check passed.
