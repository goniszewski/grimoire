# TASK-117: Persist Library View Preferences

**Phase:** Grimoire parity
**Priority:** medium
**Status:** backlog
**Area:** library / frontend
**Source:** PAR-046
**Labels:** grimoire-parity, preferences, library

## Description

Persist saved filter, sort, view, and page-size preferences locally.

## Scope

1. Define which library preferences are local-only versus daemon settings.
2. Persist filter, sort, view mode, and page-size choices.
3. Do not persist the current page across app sessions unless an explicit route
   already encodes it.
4. Restore preferences on app load without surprising first-run users.
5. Provide reset behavior for saved preferences.

## Acceptance Criteria

- [ ] Filter, sort, view, and page-size preferences persist locally.
- [ ] Current page is not silently restored across sessions.
- [ ] Preferences restore consistently across reloads.
- [ ] Saved state does not break shared links or explicit route filters.
- [ ] Users can reset preferences.
- [ ] Tests cover persistence, reset, and precedence rules.

## Dependencies

- Coordinates with TASK-114, TASK-115, and TASK-116.
