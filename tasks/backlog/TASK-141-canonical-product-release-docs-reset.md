# TASK-141: Canonical Product and Release Documentation Reset

**Phase:** Product reset and public beta
**Priority:** high (P1)
**Status:** backlog
**Area:** documentation / API / release governance

## Description

Reduce documentation volume and restore dependable sources of truth. Current
roadmap, PRD, overview, task board, and generated API checks disagree with the
implemented sqlite-vec, GitHub Issues, bookmarklet, release, and CI state.

## Scope

1. Declare a small canonical set for product thesis, current implementation,
   release status, security boundaries, and task priorities.
2. Correct stale vector-index, extractor, browser-capture, release, and CI claims.
3. Archive or clearly label historical plans and reports so they cannot be read
   as current operating truth.
4. Improve API status-code drift checking so high-confidence mismatches fail
   rather than emit a large warning that is routinely ignored.
5. Add link, task-state, release-state, and canonical-document drift checks.
6. Shorten `tasks/README.md` current status to present evidence and active gates;
   keep historical evidence in task files or reports.

## Acceptance Criteria

- [ ] Canonical documents agree with current implementation and release state.
- [ ] Historical documents are clearly separated from current guidance.
- [ ] High-confidence API contract drift fails CI.
- [ ] Documentation and task-board validation commands pass without ignored drift lists.

## Dependencies

- TASK-136 (verified task and CI state).
- TASK-137 (verified security state).
- TASK-138 (final capture behavior).

## Notes

- Prefer deleting duplication over adding another reconciliation document.
