# TASK-081: Public Artifact Installed-App E2E

**Phase:** MVP release closeout
**Priority:** high
**Status:** done
**Area:** testing / release validation

## Description

Extend or parameterize the installed-app smoke suite so it can validate
published release artifacts in addition to locally packaged archives.

## Scope

1. Review the current `npm run test:e2e:installed` behavior.
2. Add a release-source mode that downloads or consumes published
   `v0.1.0-beta` artifacts, checksums, and optional signatures.
3. Keep the local-package mode available for pre-publication validation.
4. Validate daemon health, save/search/import/export, Settings, backup,
   restore, update check, upgrade data preservation, and uninstall without
   purge from published artifacts.
5. Document how release operators run the public-artifact mode.

## Acceptance Criteria

- [x] Installed-app smoke can run against local release artifacts.
- [x] Installed-app smoke can run against published release artifacts, with
      current live execution recording the TASK-078 public visibility blocker
      before install/runtime mutation.
- [x] Public-artifact mode verifies checksum and signature behavior where
      available.
- [x] Release checklist documents the exact command and expected evidence.
- [x] The smoke passes or records a release-blocking failure.

## Dependencies

- Depends on TASK-076 for live public-artifact validation.

## Notes

- This task closes the gap between "the archive we just built works" and "the
  archive users can download works."

## Work Notes

- May 29, 2026: Started after TASK-078/TASK-079 remained blocked on public
  artifact visibility and TASK-080 remained blocked by the shared native daemon
  on `127.0.0.1:3210`.
- Added a published-source mode to `scripts/installed-app-smoke.ts` via
  `--source published`. It downloads the release archive, `.sha256`, and
  optional `.asc` into the isolated smoke temp root, verifies the downloaded
  archive checksum, verifies the detached signature when present, and then runs
  the existing installed-app smoke journey against the verified archive.
- Kept the existing local package mode and `npm run test:e2e:installed`
  behavior unchanged for pre-publication validation.
- Added `npm run test:e2e:installed:published` as the release-operator command
  for public artifact validation. It runs `bun run
  scripts/installed-app-smoke.ts --source published --require-signature`.
- Documented the published-artifact smoke command in
  `docs/release-checklist.md`.

## Partial Verification

- `npx vitest run scripts/installed-app-smoke.test.ts` passed with 9/9 tests
  after adding coverage for the published-source command, GitHub release URL
  derivation, checksum verification, signature verification wiring, and
  required-signature failure behavior.
- `npm run lint` passed with the existing 9 warnings in shared UI/frontend
  files.
- `npm run test` passed with 154/154 tests.
- `npx tsc --noEmit --skipLibCheck --target ES2022 --module ESNext
  --moduleResolution bundler --lib ES2023,DOM --types node,vitest/globals
  scripts/installed-app-smoke.ts scripts/installed-app-smoke.test.ts` passed.
- Review follow-up verification on May 29, 2026: `npx tsc --noEmit` passed,
  `npm run test` passed with 155/155 tests, `npm run lint` passed with the
  existing 9 warnings, and `npm run test:e2e:installed` passed against freshly
  packaged local artifacts.
- `npm run test:e2e:installed:published` failed before install/runtime work
  because GitHub returned `HTTP 404` for the public macOS archive URL:
  `https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-macos.tar.gz`.

## Recorded Release Blocker

- Live public-artifact installed-app validation is still blocked by the same
  public artifact visibility issue recorded in TASK-078. Once the release
  archive URLs are publicly downloadable, rerun
  `npm run test:e2e:installed:published` to replace the recorded failure with
  passing public-artifact evidence.
