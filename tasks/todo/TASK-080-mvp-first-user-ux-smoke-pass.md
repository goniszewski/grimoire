# TASK-080: MVP First-User UX Smoke Pass

**Phase:** MVP release closeout
**Priority:** medium
**Status:** todo
**Area:** QA / frontend / product

## Description

Run a human first-user smoke pass over the critical MVP flows to catch confusing
states, stale copy, broken links, and recovery dead ends that automated tests
are unlikely to notice.

## Scope

1. Start from a fresh local data directory or isolated install.
2. Exercise first-run state, add bookmark, import, keyword search, filters, and
   bookmark detail.
3. Exercise degraded AI and embedding states with no provider configured.
4. Exercise pipeline retry/reprocess controls and failed-stage guidance.
5. Exercise Settings backup creation, local verification, encrypted package
   creation, encrypted package verification, restore, and post-restore recovery
   screen.
6. Exercise diagnostics generation and update check messaging.
7. Record UX issues as fixes, follow-up tasks, or explicit non-blockers.

## Acceptance Criteria

- [ ] Fresh-user flow has no dead ends for core save, search, import, and
      backup/restore journeys.
- [ ] Degraded AI and embeddings states are understandable and non-blocking.
- [ ] Recovery and restart instructions are clear during restore and update
      flows.
- [ ] Diagnostics and update-check copy do not overclaim telemetry, signing, or
      automatic update behavior.
- [ ] Findings are fixed, captured as follow-up tasks, or documented as
      acceptable MVP limitations.

## Dependencies

- Can run before publication, but should be repeated after TASK-076 if release
  artifacts alter installed behavior.

## Notes

- This is intentionally a product confidence pass, not a replacement for
  automated Playwright or installed-artifact smoke tests.
