# TASK-085: Grimoire Parity Scope And Non-Goals

**Phase:** Grimoire parity
**Priority:** critical
**Status:** done
**Area:** documentation / product
**Source:** PAR-002
**Labels:** grimoire-parity, parity-decision, docs

## Description

Lock the current Grimoire parity scope as a local-first, single-user Little Imp
batch and make intentional non-goals visible in the parity report, roadmap, and
release planning.

## Scope

1. Document the locked scope: local-first, single-user, loopback-first, and
   local integrations only.
2. Document non-goals for this batch: multi-user accounts, admin roles, signup,
   login, profile management, per-user backup scoping, public-server deployment
   mode, Grimoire endpoint aliases, and packaged browser-extension/bookmarklet
   clients.
3. Link each non-goal to a rationale, a future reconsideration trigger, or a
   rejected/deferred proposal row.
4. Update the parity report, roadmap, and release docs if they imply a stronger
   parity claim.

## Acceptance Criteria

- [x] Parity docs list explicit non-goals with rationale.
- [x] Current parity scope is explicitly local-first and single-user.
- [x] Deferred multi-user/server behavior is not described as current batch or
      release scope.
- [x] Rejected integration aliases and extension smoke tests are documented as
      intentional omissions.
- [x] Packaged browser extension/bookmarklet clients are documented as deferred.
- [x] Roadmap and release docs no longer imply unsupported Grimoire parity.
- [x] Any future reconsideration criteria are concrete.

## Dependencies

- Should reference the approved and rejected rows in
  `docs/parity/grimoire-parity-task-proposals.md`.

## Notes

- Keep this documentation product-facing and concrete. Avoid vague "not yet"
  language where the decision is deliberate.
- A future multi-user/server mode should be treated as a new product decision,
  not as unfinished work inside this parity batch.

## Work Notes

- May 31, 2026: Started as the next actionable task after TASK-078 and
  TASK-079 remained blocked on public artifact visibility and TASK-080 remained
  blocked on the shared native daemon environment.
- May 31, 2026: Updated the parity report, roadmap, release notes, release
  decision, release checklist, task report index, and task board. Verification
  passed with `npm run docs:api:check` and a local link check over the edited
  markdown/report pages. Moved to in-review for owner review rather than done.
- May 31, 2026: Review pass fixed task-board status wording and made the
  export parity note more concrete. Final verification passed with
  `npm run check`, `git diff --check`, and a local documentation link check.
  Moved to done at owner request.
