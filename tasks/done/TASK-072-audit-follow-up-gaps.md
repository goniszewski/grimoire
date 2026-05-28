# TASK-072: Audit Follow-Up Gaps

**Phase:** post-MVP polish
**Priority:** low
**Status:** done
**Area:** frontend / daemon / task-board hygiene

## Description

TASK-058 found a small set of older acceptance criteria that are not MVP
blockers and are not covered by the current MVP-readiness todo queue. Keep them
visible as explicit follow-up work instead of leaving stale unchecked criteria
hidden inside completed task files.

## Scope

1. Decide whether the command palette should force semantic or hybrid search for
   natural-language queries, or expose a mode selector.
2. If semantic command-palette search is still desired, update `AIPalette` to
   call the search endpoint with the selected semantic behavior and add focused
   tests.
3. Decide which manual category mutations should write timeline events.
4. If manual category timeline coverage is desired, record category create,
   rename, delete, and reparent actions consistently from the daemon routes.
5. Update task files and docs so the original TASK-012 and TASK-017 criteria no
   longer need audit notes.

## Acceptance Criteria

- [x] Command palette semantic-search behavior is either implemented and tested
      or explicitly removed from the product requirements.
- [x] Manual category timeline behavior is either implemented and tested or
      explicitly removed from the product requirements.
- [x] `tasks/done/TASK-012-library-timeline.md` and
      `tasks/done/TASK-017-ai-palette-integration.md` no longer carry unresolved
      TASK-058 audit notes.

## Notes

- TASK-064 and TASK-065 already cover the larger provider-change,
  reprocessing, re-embedding, and pipeline retry/recovery gaps found during the
  audit.
- The command palette uses `mode=hybrid` for natural-language searches so
  semantic matches supplement keyword matches, with a keyword fallback when no
  embedding provider is configured.
- Manual category create, rename, reparent, and delete requests write user
  timeline events from the daemon categories route.
- Code review follow-up fixed stale async command-palette results after closing
  and reopening the palette while a search request is still in flight.
- Verification passed with `npm run check`, including lint, frontend tests,
  daemon tests, generated API docs drift checking, and production build.
