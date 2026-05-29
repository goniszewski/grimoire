# TASK-076: Signed Release Artifact Publication

**Phase:** MVP release closeout
**Priority:** high
**Status:** done
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

- [x] macOS and Linux release archives are generated from the intended release
      commit.
- [x] Archive checksums and detached signatures are present.
- [x] Signature-required release validation passes.
- [x] GitHub release artifacts are published or staged in a draft release with
      exact asset inventory recorded.
- [x] Published asset URLs match the URLs consumed by the one-command installer,
      Homebrew formula, and packaged update flow.

## Dependencies

- Depends on TASK-075.
- Unblocks TASK-078, TASK-079, and TASK-081.

## Notes

- If signing keys are unavailable, record the blocker rather than publishing a
  release that claims signature coverage.

## Review Notes

- Started from audited release-candidate commit
  `50333cab0bc28edbfa26a81c0542510a357a1605` on `develop`.
- The working tree contained only task-board documentation changes while
  packaging; the release payload copies runtime files, frontend build output,
  daemon sources, README, and release metadata, not `tasks/`.
- Created the GitHub `v0.1.0-beta` release as a prerelease, not a draft:
  https://github.com/goniszewski/little-imp/releases/tag/v0.1.0-beta
- The remote tag `v0.1.0-beta` points at
  `50333cab0bc28edbfa26a81c0542510a357a1605`.
- Release signing used GPG key
  `DB04AD8F2F2CB7753F0DFA3FED72EFB58D928945` for
  `Robert Goniszewski <robertgoniszewski@outlook.com>`.
- Required GitHub release assets are present:
  - `little-imp-0.1.0-beta-macos.tar.gz`
  - `little-imp-0.1.0-beta-macos.tar.gz.sha256`
  - `little-imp-0.1.0-beta-macos.tar.gz.asc`
  - `little-imp-0.1.0-beta-linux.tar.gz`
  - `little-imp-0.1.0-beta-linux.tar.gz.sha256`
  - `little-imp-0.1.0-beta-linux.tar.gz.asc`
  - `release-manifest.json`
- Artifact checksums from `release/release-manifest.json`:
  - macOS:
    `d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59`
  - Linux:
    `a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098`
- GitHub release asset URLs match the installer, Homebrew formula, and packaged
  update flow URL pattern:
  `https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/ASSET`.
- Visibility caveat for follow-up public install tasks: the GitHub repository is
  currently private. Authenticated `gh release download` succeeds, but
  unauthenticated `curl` checks against the tag-qualified raw installer and
  release asset URLs return `404`. TASK-078, TASK-079, and TASK-081 should keep
  public-path validation blocked until the repository is public or an
  authenticated distribution path is explicitly chosen.

## Verification

- `npm run package:release` passed and regenerated macOS/Linux archives,
  checksum files, and `release/release-manifest.json`.
- `npm run release:validate` passed.
- `shasum -a 256 -c *.sha256` passed inside `release/`.
- `gpg --verify` passed for both detached archive signatures.
- `npm run release:validate -- --require-signatures` passed.
- `gh release view v0.1.0-beta --repo goniszewski/little-imp` confirmed the
  prerelease, target commit, seven uploaded assets, and archive digests.
