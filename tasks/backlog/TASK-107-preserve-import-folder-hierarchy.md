# TASK-107: Preserve Import Folder Hierarchy

**Phase:** Grimoire parity
**Priority:** high
**Status:** backlog
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

- [ ] Netscape folder hierarchy imports as nested categories.
- [ ] Imported bookmarks retain their source folder category.
- [ ] Duplicate folder names under different parents do not collide.
- [ ] Import progress and result data include category creation.
- [ ] Tests cover nested folders, empty folders, duplicates, and re-import.

## Dependencies

- Coordinates with TASK-108, TASK-109, TASK-113, and TASK-120.
