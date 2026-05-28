# TASK-076: Signed Release Artifact Publication

**Phase:** MVP release closeout
**Priority:** high
**Status:** todo
**Area:** release / distribution

## Description

Create the final signed release artifacts from a clean checkout, validate them
with the signature-required release gate, and publish the GitHub
`v0.1.0-beta` draft or prerelease with all required assets.

## Scope

1. Start from the audited release-candidate commit.
2. Run `npm run package:release`.
3. Verify `release/` contains the macOS and Linux archives, checksums, and
   `release-manifest.json`.
4. Create detached `.asc` signatures for each archive.
5. Run `npm run release:validate -- --require-signatures`.
6. Create or update the GitHub `v0.1.0-beta` release with archives,
   checksums, signatures, and release manifest attached.
7. Record artifact names, SHA-256 values, signature status, release URL, and
   any skipped publication steps.

## Acceptance Criteria

- [ ] macOS and Linux release archives are generated from the intended release
      commit.
- [ ] Archive checksums and detached signatures are present.
- [ ] Signature-required release validation passes.
- [ ] GitHub release artifacts are published or staged in a draft release with
      exact asset inventory recorded.
- [ ] Published asset URLs match the URLs consumed by the one-command installer,
      Homebrew formula, and packaged update flow.

## Dependencies

- Depends on TASK-075.
- Unblocks TASK-078, TASK-079, and TASK-081.

## Notes

- If signing keys are unavailable, record the blocker rather than publishing a
  release that claims signature coverage.
