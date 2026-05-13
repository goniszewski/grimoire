# TASK-046: Adopt the Shared API Contract in the Frontend

**Status:** todo
**Priority:** medium
**Phase:** v0-beta hardening
**Area:** frontend, daemon, TypeScript

## Description

The frontend API client and daemon schemas have drifted. The Settings page currently casts `getSettings()` through `unknown` because `ApiSettings` in `src/lib/api.ts` does not match the daemon's actual settings schema. E2E mocks also use stale shapes for settings. This increases the chance of UI features passing tests while failing against the real daemon.

This task consumes the contract produced by TASK-045 in the frontend and test mocks. It should not create a competing schema source.

## Current evidence

- `src/lib/api.ts` defines `ApiSettings` with a top-level `embedding` object, while the daemon uses `ai.embeddings`.
- `src/pages/Settings.tsx` casts `getSettings()` through `unknown` to work around the drift.
- The Settings page still uses `as any` for S3 settings saves.
- Playwright mocks define their own settings payloads instead of using shared builders.

## Dependencies / sequencing

- Depends on TASK-045 for the daemon-owned contract or generated DTOs.
- Coordinate with TASK-041 for runtime capability fields used by degraded-mode UI.

## Work

1. Update `src/lib/api.ts` to derive request and response types from the contract generated or exported by TASK-045.
2. Replace frontend-local DTOs for settings, backup, bookmark list/detail, search, suggestions, timeline, categories, and tags where the contract covers them.
3. Remove `unknown` casts in Settings and replace with typed query/mutation functions.
4. Remove `as any` from Settings S3 saves by using typed partial settings patches.
5. Update E2E mocks to use current shared response builders or contract-derived fixtures.
6. Add type tests or compile checks that prevent frontend and daemon contract drift.
7. Keep runtime behavior unchanged except where typing exposes an existing mismatch that must be fixed.

## Acceptance Criteria

- [ ] `ApiSettings` matches the daemon settings schema without local overrides.
- [ ] Settings page no longer casts `getSettings()` through `unknown`.
- [ ] Settings page no longer uses `as any` for S3 settings writes.
- [ ] E2E mocks use current API response shapes.
- [ ] Frontend types cover settings, backup, bookmark list/detail, search, suggestions, and timeline from the shared contract.
- [ ] Frontend and daemon type checks catch contract changes.
- [ ] No user-facing behavior regresses.
