# TASK-082: Final Localhost Security Regression Pass

**Phase:** MVP release closeout
**Priority:** high
**Status:** todo
**Area:** security / QA / release validation

## Description

Run a final security-focused regression pass over the local-first trust model,
browser hardening, release artifact verification, safe file handling, and
diagnostics redaction before declaring the MVP build ready.

## Scope

1. Verify native daemon binding remains `127.0.0.1`.
2. Verify Docker publishes `127.0.0.1:3210:3210`, not a public interface.
3. Verify unsafe browser origins are rejected and allowed loopback origins still
   work.
4. Verify CSP and browser security headers on static frontend and API
   responses.
5. Recheck private-host and loopback URL blocking for content fetching and
   update-check source restrictions.
6. Recheck request body limits and path validation for import, backup,
   encrypted packages, restore, diagnostics, and reprocessing.
7. Recheck diagnostics redaction for secrets, URL credentials, query strings,
   notes, content, and embeddings.

## Acceptance Criteria

- [ ] Localhost-only native and Docker network claims are verified.
- [ ] Browser origin and CSP behavior match `SECURITY.md`.
- [ ] SSRF/private-network protections still reject unsafe fetch targets.
- [ ] Backup, restore, encrypted package, and diagnostics path handling remain
      traversal-safe.
- [ ] Diagnostics output is free of known secret and content classes.
- [ ] Any security regression is fixed or explicitly marked release-blocking.

## Dependencies

- Should run after any release-closeout code or packaging changes.

## Notes

- Optional authentication and public-network mode remain post-MVP unless the
  product scope changes.
