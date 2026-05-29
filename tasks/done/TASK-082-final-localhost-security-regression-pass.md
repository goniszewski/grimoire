# TASK-082: Final Localhost Security Regression Pass

**Phase:** MVP release closeout
**Priority:** high
**Status:** done
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

- [x] Localhost-only native and Docker network claims are verified.
- [x] Browser origin and CSP behavior match `SECURITY.md`.
- [x] SSRF/private-network protections still reject unsafe fetch targets.
- [x] Backup, restore, encrypted package, and diagnostics path handling remain
      traversal-safe.
- [x] Diagnostics output is free of known secret and content classes.
- [x] Any security regression is fixed or explicitly marked release-blocking.

## Dependencies

- Should run after any release-closeout code or packaging changes.

## Notes

- Optional authentication and public-network mode remain post-MVP unless the
  product scope changes.

## Work Notes

- May 29, 2026: Selected as the next actionable high-priority release-closeout
  task because TASK-078/TASK-079 remain gated on public artifact visibility and
  TASK-080 remains gated on a fresh-data installed UX environment.
- Added diagnostics regression coverage proving `/diagnostics` does not expose
  stored bookmark URLs, titles, descriptions, notes, extracted raw HTML,
  markdown, summaries, authors, or embedding vector values.
- `docker compose config` renders the daemon port as `host_ip: 127.0.0.1`,
  `published: "3210"`, `target: 3210`; the container-internal
  `HOST=0.0.0.0` remains documented as Docker forwarding configuration, not a
  public host bind.
- The currently running user daemon on port `3210` is bound to
  `127.0.0.1:3210`, but it is an older local install at
  `/Users/robert/.local/share/littleimp/daemon` and does not include current
  `/diagnostics` or browser hardening headers. It was not used as release
  evidence.
- Started the current source daemon in an isolated local data/config directory
  on `127.0.0.1:39210`. It reported version `0.1.0-beta`, listened only on
  `127.0.0.1:39210`, returned the documented CSP and browser security headers,
  exposed diagnostics with the documented omitted secret classes, and rejected
  `Origin: https://evil.example` unsafe writes with `403`.
- Refreshed the gitignored local `release/` artifact directory from the
  authenticated `v0.1.0-beta` GitHub release before signature validation so
  local archives, checksums, signatures, and manifest matched the uploaded
  release assets.
- Review follow-up strengthened the diagnostics redaction regression with an
  explicit embedding model sentinel and exact vector values so failures are not
  hidden by floating-point serialization differences.

## Verification

- `bun test ./src/test/integration/diagnostics.test.ts`
- `npx tsc --noEmit`
- `bun test ./src/test/integration/security-hardening.test.ts ./src/test/integration/updates.test.ts ./src/test/pipeline/fetch.test.ts ./src/test/integration/diagnostics.test.ts ./src/test/integration/backup.test.ts ./src/test/integration/import.test.ts ./src/test/integration/reprocess.test.ts ./src/test/backup-package.test.ts ./src/test/cli-update.test.ts ./src/test/restore-recovery.test.ts`
- `npm run test:daemon`
- `npm run check`
- `docker compose config`
- `npm run release:validate -- --require-signatures`
- `gpg --verify release/little-imp-0.1.0-beta-macos.tar.gz.asc release/little-imp-0.1.0-beta-macos.tar.gz`
- `gpg --verify release/little-imp-0.1.0-beta-linux.tar.gz.asc release/little-imp-0.1.0-beta-linux.tar.gz`
- `npx vitest run scripts/release-artifacts-validator.test.ts scripts/install-release.test.ts scripts/installed-app-smoke.test.ts`
- `git diff --check`
