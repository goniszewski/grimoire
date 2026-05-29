# TASK-080: MVP First-User UX Smoke Pass

**Phase:** MVP release closeout
**Priority:** medium
**Status:** in-progress
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

## Work Notes

- May 29, 2026: Started after TASK-078 was documented as publication-blocked.
  TASK-079 and TASK-081 share the same public artifact dependency, so this is
  the next actionable release-closeout task.
- Real fresh-data browser validation is currently blocked in this shared
  workspace because `127.0.0.1:3210` is already occupied by an installed native
  daemon at `/Users/robert/.local/share/littleimp/daemon/src/index.ts`.
- The active daemon reports `version: "0.1.0-beta"` and has existing user data
  (`/bookmarks?limit=1` reports `pagination.total: 7`), so mutating first-user
  flows such as add, import, backup, package, and restore were not run against
  it.
- The frontend API base is hardcoded to `http://127.0.0.1:3210` in
  `src/lib/api.ts`, so starting an isolated daemon on a different port would
  not provide a real fresh-data frontend smoke without code changes or stopping
  the active native daemon.
- As partial non-mutating evidence, ran the existing Playwright smoke specs
  that mock daemon responses for first-run, degraded AI, add bookmark, import,
  search, Settings backup verification, restore, and update-check messaging:
  `npx playwright test e2e/first-run.spec.ts e2e/business-requirements.spec.ts
  --reporter=list`.

## Partial Verification

- `npx playwright test e2e/first-run.spec.ts e2e/business-requirements.spec.ts
  --reporter=list` passed on May 29, 2026 with 11/11 tests passing.
- Covered non-mutating mocked UX evidence for:
  - first-run empty library CTAs;
  - add bookmark and keyword search;
  - browser import and JSON export;
  - degraded AI banner, dismissal persistence, configured-provider state;
  - review-queue cold-start guard;
  - daemon-offline banner;
  - Settings update-check copy;
  - backup verification, backup creation, and restore confirmation.
- The command printed a Browserslist `caniuse-lite` age warning from the Vite
  web server. This did not fail the smoke, but should remain a maintenance
  follow-up rather than an MVP UX blocker.

## Remaining Blocker

- The acceptance criteria still require a real fresh local data directory or
  isolated install. That pass is not complete because the shared workspace has
  an active native daemon on `127.0.0.1:3210` with existing data, and the
  frontend cannot target an alternate daemon port without code changes.
