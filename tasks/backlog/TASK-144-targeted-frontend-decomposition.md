# TASK-144: Targeted Frontend Decomposition and Loading

**Phase:** Post-beta maintainability
**Priority:** medium (P2)
**Status:** backlog
**Area:** frontend / architecture / performance

## Description

Reduce the clearest frontend maintenance hotspots without starting a broad
rewrite. Current Settings, API client, library-state hook, and application bundle
are disproportionately large for the core user journey.

## Scope

1. Split `Settings.tsx` into cohesive operational sections with clear ownership.
2. Split the API client and bookmark-state coordination by domain while keeping
   one shared HTTP/error/contract layer.
3. Lazy-load non-core routes and heavy Settings/reporting dependencies.
4. Remove unused UI dependencies and dead code, including any remaining duplicate
   capture implementation.
5. Establish bundle budgets and report route-level chunk sizes.
6. Preserve visible behavior and capture desktop/narrow screenshots if layout changes.

## Acceptance Criteria

- [ ] No new feature behavior is introduced.
- [ ] Major Settings, API, and state modules have cohesive boundaries and focused tests.
- [ ] The initial production JS payload is materially smaller than the current baseline.
- [ ] `npm run check`, `npm run test:e2e`, and the real-daemon E2E pass.

## Dependencies

- TASK-143 (beta evidence review), unless maintenance risk blocks TASK-142 delivery.

## Notes

- User evidence may change which surfaces deserve decomposition first.
