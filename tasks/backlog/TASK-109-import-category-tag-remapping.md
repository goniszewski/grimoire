# TASK-109: Import Category And Tag Remapping

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
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

- [ ] Users can remap imported folders before commit.
- [ ] Users can remap imported tags before commit.
- [ ] Remapping decisions apply to every imported bookmark consistently.
- [ ] Preview and result reports show the chosen mappings.
- [ ] Tests cover existing, new, renamed, skipped, and conflicting mappings.

## Dependencies

- Depends on TASK-108 and TASK-120.
- Coordinates with TASK-107 and TASK-110.
