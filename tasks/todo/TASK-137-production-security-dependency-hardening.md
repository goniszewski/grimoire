# TASK-137: Production Security and Dependency Hardening

**Phase:** Product reset and public beta
**Priority:** critical (P0)
**Status:** todo
**Area:** security / daemon / dependencies

## Description

Remove known pre-release dependency risk and close request-boundary gaps. Current
production audits report high-severity advisories in both the frontend and
daemon trees, including direct React Router and Hono dependencies.

## Scope

1. Upgrade direct and transitive dependencies to patched compatible versions,
   prioritizing React Router, Hono, MCP SDK, AWS SDK, and their vulnerable trees.
2. Triage every remaining production advisory for actual Little Imp exposure.
3. Replace declared-`Content-Length`-only request guards with limits that also
   constrain chunked and unknown-length bodies.
4. Verify body limits across JSON, import, capture, backup/restore, Settings,
   reprocess, and token-management routes.
5. Add production dependency audits to CI with a documented exception mechanism
   that requires an owner, applicability note, and review date.
6. Refresh the security boundary and release checklist with verified behavior.

## Acceptance Criteria

- [ ] `npm audit --omit=dev` has no unreviewed high-severity findings.
- [ ] `bun audit --production` has no unreviewed high-severity findings.
- [ ] Oversized declared, chunked, and unknown-length bodies are rejected by focused tests.
- [ ] Dependency and request-limit checks run in CI.
- [ ] `npm run check`, focused security tests, and `npm run test:e2e` pass.

## Dependencies

- None. This task can run in parallel with TASK-136.

## Notes

- Do not claim every advisory is exploitable; record evidence for dismissals.
- Preserve the loopback-only release posture.
