# TASK-069: Production Security Headers and Local Hardening

**Phase:** MVP readiness
**Priority:** medium
**Status:** todo
**Area:** security / daemon / frontend

## Description

Harden the local production server without changing the single-user,
localhost-only trust model. The app has no daemon authentication by design, but
the production frontend and local API should still use conservative browser
headers and avoid avoidable local exposure.

## Scope

1. Add production security headers for static frontend responses where
   compatible with the app.
2. Define and test a Content Security Policy that permits the app's required
   local behavior and blocks unnecessary script/object/embed sources.
3. Review CORS and origin handling for localhost development and production.
4. Review request body limits and file/path validation for user-facing import,
   backup, restore, and package endpoints.
5. Add minimal local rate limiting or abuse guards only where it protects
   expensive operations without breaking local workflows.
6. Update `SECURITY.md` with the final hardening posture and known limitations.

## Acceptance Criteria

- [ ] Production static responses include appropriate security headers.
- [ ] CSP does not break the built frontend or documented local workflows.
- [ ] CORS/origin behavior is documented and tested for local use.
- [ ] Expensive or sensitive endpoints have documented limits or safeguards.
- [ ] Security documentation matches the implemented local-first model.

## Notes

- Do not add public-network auth in this task. Public or multi-user deployment
  remains post-MVP unless the product scope changes.
