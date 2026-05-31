# TASK-120: Import Duplicate Handling Policy

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Import preview classifies active, archived, trashed, new, invalid, and
      private URL rows.
- [ ] Active duplicates default to skip and can merge tags/category/notes.
- [ ] Archived duplicates can be restored and merged.
- [ ] Trashed duplicates can be restored and merged or left skipped.
- [ ] Invalid and private URLs are skipped and included in the report.
- [ ] Tests cover duplicate detection, default choices, merge behavior, restore
      behavior, and skipped rows.

## Dependencies

- Should be implemented before TASK-108, TASK-109, and TASK-110 so preview,
  remapping, and result reports use the same duplicate semantics.
