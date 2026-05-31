# TASK-085: Grimoire Parity Scope And Non-Goals

**Phase:** Grimoire parity
**Priority:** critical
**Status:** backlog
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
   mode, Grimoire endpoint aliases, and browser-extension/bookmarklet capture.
3. Link each non-goal to a rationale, a future reconsideration trigger, or a
   rejected/deferred proposal row.
4. Update the parity report, roadmap, and release docs if they imply a stronger
   parity claim.

## Acceptance Criteria

- [ ] Parity docs list explicit non-goals with rationale.
- [ ] Current parity scope is explicitly local-first and single-user.
- [ ] Deferred multi-user/server behavior is not described as current batch or
      release scope.
- [ ] Rejected integration aliases and extension smoke tests are documented as
      intentional omissions.
- [ ] One-click browser extension/bookmarklet capture is documented as deferred.
- [ ] Roadmap and release docs no longer imply unsupported Grimoire parity.
- [ ] Any future reconsideration criteria are concrete.

## Dependencies

- Should reference the approved and rejected rows in
  `docs/parity/grimoire-parity-task-proposals.md`.

## Notes

- Keep this documentation product-facing and concrete. Avoid vague "not yet"
  language where the decision is deliberate.
- A future multi-user/server mode should be treated as a new product decision,
  not as unfinished work inside this parity batch.
