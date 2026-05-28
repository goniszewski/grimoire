# TASK-081: Public Artifact Installed-App E2E

**Phase:** MVP release closeout
**Priority:** high
**Status:** todo
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

- [ ] Installed-app smoke can run against local release artifacts.
- [ ] Installed-app smoke can run against published release artifacts.
- [ ] Public-artifact mode verifies checksum and signature behavior where
      available.
- [ ] Release checklist documents the exact command and expected evidence.
- [ ] The smoke passes or records a release-blocking failure.

## Dependencies

- Depends on TASK-076 for live public-artifact validation.

## Notes

- This task closes the gap between "the archive we just built works" and "the
  archive users can download works."
