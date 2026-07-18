# TASK-136: Restore CI and Acceptance Integrity

**Phase:** Product reset and public beta
**Priority:** critical (P0)
**Status:** todo
**Area:** quality / delivery / task governance

## Description

Restore a trustworthy definition of done. The current `develop` head has a
failing Playwright job, while several tasks under `tasks/done/` retain unchecked
acceptance criteria or explicitly state that verification was not run.

## Scope

1. Diagnose and fix the current Playwright failures, including guided-tour
   interception of existing core-flow tests.
2. Audit TASK-125, TASK-126, TASK-128, and TASK-129 against their acceptance
   criteria and current implementation.
3. Reopen, correct, or explicitly document any criterion that is not satisfied.
4. Add a task-board validation script that rejects `done` task files containing
   unchecked acceptance criteria unless the file records an explicit accepted
   limitation.
5. Add the validation to the canonical local check and CI workflow.
6. Update current-status documentation so historical passing evidence is not
   represented as the state of the current head.

## Acceptance Criteria

- [ ] The current GitHub `Quality Gates` workflow passes on `develop`.
- [ ] `npm run test:e2e` passes all current Playwright tests.
- [ ] TASK-125, TASK-126, TASK-128, and TASK-129 have evidence-backed status and acceptance criteria.
- [ ] A repeatable task-board check prevents unverified work from being marked done.
- [ ] `npm run check`, `npm run test:e2e`, and `git diff --check` pass.

## Dependencies

- None. This is the first task in the reset tranche.

## Notes

- Do not weaken or delete failing tests merely to restore green CI.
- A task is complete only when behavior and acceptance evidence agree.
