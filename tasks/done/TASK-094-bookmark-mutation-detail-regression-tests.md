# TASK-094: Bookmark Mutation And Detail Regression Tests

**Phase:** Grimoire parity
**Priority:** high
**Status:** done
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

- [x] Daemon tests cover every supported bookmark mutation field.
- [x] Frontend tests cover visible detail controls and optimistic/error states.
- [x] Unsupported fields have explicit validation or no editable affordance.
- [x] New parity fields from related tasks are covered before those tasks close.
- [x] Tests run through documented focused commands.

## Dependencies

- Should be expanded as TASK-089, TASK-091, and TASK-092 land.

## Work Notes

- May 31, 2026: Selected as the next actionable Grimoire parity task because
  TASK-078 and TASK-079 remain blocked on public release artifact visibility,
  and TASK-094 is the first high-priority non-blocked parity task after the
  completed bookmark field/detail work in TASK-089, TASK-091, and TASK-092.
- May 31, 2026: Added daemon integration coverage for supported bookmark
  patches, nullable field clearing, unsupported/immutable patch field
  rejection, and non-object patch bodies. Added frontend coverage for title
  editing, detail controls, supported mutation patches through
  `useBookmarks`, API client serialization, and no URL/summary edit
  affordance in the detail body. Changed `PUT /bookmarks/:id` to reject
  unknown patch keys with `422` and removed unsupported URL/summary edit
  controls from `BookmarkDetailContent`.
- Verification passed:
  `bun test src/test/integration/bookmarks.test.ts`,
  `npm run test -- src/components/BookmarkDetailContent.test.tsx src/components/BookmarkDetail.test.tsx src/hooks/use-bookmarks.test.ts src/lib/api.test.ts`,
  `npm run docs:api:check`, `npm run type-check`, and `npm run lint`
  (lint has existing unrelated warnings only).
- May 31, 2026: Review pass fixed the task-report image lightbox regression,
  restored missing image-preview script coverage across report pages, completed
  the linked lightbox report page, and corrected adjacent parity status drift
  for completed TASK-091 and TASK-092 work. Final verification passed
  `npm run check`, `npm run test:e2e`, `npx tsc --noEmit`, and
  `git diff --check`.
