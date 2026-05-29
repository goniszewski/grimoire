# TASK-083: Release Notes and Support Readiness

**Phase:** MVP release closeout
**Priority:** medium
**Status:** done
**Area:** documentation / support / release

## Description

Prepare the public-facing release notes and support material needed for first
MVP users to install, verify, troubleshoot, and report issues.

## Scope

1. Draft final GitHub release notes from `CHANGELOG.md`, README, roadmap, and
   release validation evidence.
2. Call out recommended install path, alternate Homebrew path, manual archive
   path, supported OS matrix, and known limitations.
3. Include checksum/signature verification guidance and the no-telemetry,
   local-first support posture.
4. Include troubleshooting links for daemon health, Homebrew Bun dependency,
   Docker port binding, backup/restore recovery, update checks, and diagnostics.
5. Confirm issue/security reporting guidance is clear.

## Acceptance Criteria

- [x] GitHub release notes are ready to publish with the final release.
- [x] Notes include supported install paths and supported OS matrix.
- [x] Known limitations are explicit and match `SECURITY.md` and
      `docs/roadmap.md`.
- [x] Troubleshooting guidance points to existing docs instead of duplicating
      stale instructions.
- [x] Security reporting avoids public vulnerability disclosure.

## Dependencies

- Should follow TASK-075.
- Should incorporate evidence from TASK-076 through TASK-082 before final
  publication.

## Notes

- This task is user-facing release communication, not marketing copy.

## Work Notes

- May 29, 2026: Selected after TASK-078, TASK-079, and TASK-080 remained
  blocked by public artifact visibility or shared-workspace fresh-data
  constraints, and before final TASK-084 go/no-go packaging.
- Added `docs/release-notes-v0.1.0-beta.md` with publish-ready notes covering
  the recommended one-command installer, Homebrew alternate path, manual
  archive path, artifact checksums, signature verification, supported MVP OS
  matrix, shipped product surface, validation evidence, known limitations,
  diagnostics, topic-specific troubleshooting links, and security reporting
  guidance.
- Treated `docs/release-notes-v0.1.0-beta.md` as the tracked source of truth
  because the generated `release/` artifact directory is intentionally ignored.
- Kept the remaining publication-gated checks visible: public one-command
  install, public CLI update install, Homebrew live install, and
  published-artifact E2E validation still depend on unauthenticated access to
  the tag-qualified installer and release assets.
- Updated `README.md` and `docs/release-checklist.md` so the tracked release
  notes are discoverable and future release operators verify them directly
  before claiming public installer/Homebrew validation.

## Verification

- `npx tsc --noEmit` passed.
- `npm test` passed with 23 test files and 155 tests.
- `npm run check` passed, including lint, frontend/daemon type-checks,
  frontend tests, daemon tests, API docs drift check, and production build.
- `npm run docs:api:check` passed.
- `git diff --check` passed.
- Trailing-whitespace scan passed for the new release-notes and task files.
- Local Markdown link audit passed across `README.md`, `CONTRIBUTING.md`,
  `tasks/README.md`, and Markdown files under `docs/`.
