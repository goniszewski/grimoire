# TASK-028: Organization Agent — Full Wiring

**Status:** done
**Priority:** medium
**Phase:** M3
**Area:** backend / frontend

## Description

The organization agent generates suggestions and writes them to `agent_suggestions`, but accepting/rejecting suggestions does not yet trigger the corresponding actions (create category, merge categories, mark duplicate). Timeline event recording for agent actions is also incomplete.

## Backend

**Suggestion acceptance actions:**
- Accept `new_subcategory` suggestion → create the category and move matching bookmarks
- Accept `merge_categories` suggestion → move all bookmarks to target category, delete source
- Accept `duplicate` suggestion → mark one bookmark as trashed (moves to Trash), link to canonical

**Timeline events:**
- Record `timeline_event` for every agent action: category created, category merged, duplicate marked
- Record `timeline_event` when suggestion is manually accepted or rejected

**Auto-apply:**
- Verify auto-apply threshold (confidence ≥ 0.9) is enforced and working
- Auto-applied actions must also record timeline events

**Scheduler:**
- Confirm agent runs on its configured interval (`AGENT_INTERVAL_MS`)
- Confirm it only runs when library has ≥ 20 bookmarks (cold start guard per PRD)

## Frontend

- Review Queue UI already exists — confirm accept/reject buttons call correct endpoints
- `/timeline` page already exists — confirm agent-generated events appear

## Acceptance Criteria

- [x] Accepting a `new_subcategory` suggestion creates the category
- [x] Accepting a `merge_categories` suggestion merges correctly
- [x] Accepting a `duplicate` suggestion moves the duplicate to Trash
- [x] All agent actions are recorded in `timeline_events`
- [x] Auto-apply fires for confidence ≥ 0.9
- [x] Agent does not run with < 20 bookmarks
