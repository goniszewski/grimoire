# TASK-075: Release Candidate Freeze and Version Audit

**Phase:** MVP release closeout
**Priority:** high
**Status:** done
**Area:** release / documentation / QA

## Description

Freeze the release-candidate state and verify that version, release target,
changelog, documentation, and task-board status all describe the same
`0.1.0-beta` build before artifacts are published.

## Scope

1. Confirm the intended release commit and working tree state.
2. Audit `package.json`, `README.md`, `CHANGELOG.md`, `SECURITY.md`,
   `tasks/README.md`, `docs/roadmap.md`, `docs/prd.md`,
   `docs/overview.md`, `docs/release-checklist.md`, and
   `docs/update-system.md` for release-target drift.
3. Reconcile the `CHANGELOG.md` `Unreleased` section with the final
   `0.1.0-beta` release notes.
4. Confirm task-board status accurately separates completed product work from
   open release-closeout work.
5. Run API docs drift checking and a local Markdown link audit where available.

## Acceptance Criteria

- [x] Every release-facing document names the same version, tag, and release
      target.
- [x] `CHANGELOG.md` has a coherent final `0.1.0-beta` entry and no MVP-ready
      work stranded under `Unreleased`.
- [x] Task-board status identifies TASK-075 through TASK-084 as the MVP
      release-closeout queue and separates completed TASK-075 work from active
      TASK-076 through TASK-084 work.
- [x] Documentation checks pass or skipped checks are explicitly recorded.

## Dependencies

- Should run before TASK-076.

## Notes

- This task should not introduce product behavior. It is a release consistency
  gate before artifact publication.

## Review Notes

- Intended release version is `0.1.0-beta`; tag-qualified release URLs use
  `v0.1.0-beta`.
- The root `package.json`, daemon `package.json`, and root `install.sh` default
  release version all agree on `0.1.0-beta`.
- The release-candidate freeze started from `develop` at `6762776` with
  user-authored task-board backlog changes already present in the working tree.
- TASK-075 changed release documentation and task-board state only. No product
  runtime behavior changed.
- `CHANGELOG.md` now has no MVP-ready work under `Unreleased`; the final
  `0.1.0-beta` entry includes the full implemented beta surface.
- TASK-076 through TASK-084 remain open because they require signed artifacts,
  published release URLs, Homebrew tap/live install validation, fresh hosts, or
  final go/no-go packaging.

## Verification

- `npm run docs:api:check` passed; generated API documentation is up to date.
- Local Markdown link audit passed across `README.md`, `CONTRIBUTING.md`,
  `tasks/README.md`, and 13 Markdown files under `docs/`.
- Release freeze audit passed for `0.1.0-beta` / `v0.1.0-beta`, including root
  package version, daemon package version, root installer default, release docs,
  changelog freeze state, and TASK-075 task-board location.
- `git diff --check` passed.
