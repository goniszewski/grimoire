# TASK-079: Homebrew Tap Publication and Live Install Validation

**Phase:** MVP release closeout
**Priority:** medium
**Status:** in-progress
**Area:** distribution / Homebrew / developer experience

## Description

Complete the publication-gated Homebrew work by validating the formula against
published release artifacts and recording the tap/install evidence.

## Scope

1. Confirm `Formula/little-imp.rb` references the final release URLs and
   checksums from `release/release-manifest.json`.
2. Run `npx vitest run scripts/homebrew-formula.test.ts`.
3. Run `brew audit --strict goniszewski/little-imp/little-imp`.
4. Publish or register the tap path needed for user-facing installation.
5. Run `brew install goniszewski/little-imp/little-imp` against published
   artifacts.
6. Verify `littleimp --help`, `brew services start little-imp`,
   `/health`, `brew services stop little-imp`, and `brew uninstall little-imp`.
7. Confirm Homebrew-managed data remains unless explicitly removed.

## Acceptance Criteria

- [x] Homebrew formula checks and strict audit pass.
- [ ] Live `brew install` succeeds from published archives.
- [ ] Homebrew service starts the daemon and `/health` reports
      `0.1.0-beta`.
- [ ] Uninstall preserves `$(brew --prefix)/var/little-imp` by default.
- [x] README and release checklist remain accurate for the tap path.

## Dependencies

- Depends on TASK-076.

## Notes

- Homebrew remains the alternate MVP install path. The one-command installer is
  still the primary cross-platform path.

## Work Notes

- May 29, 2026: Started after TASK-078 remained blocked on public artifact
  visibility. The Homebrew work is partially actionable because the formula can
  still be checked against the signed local release manifest before public
  downloads are available.
- Found that `Formula/little-imp.rb` still pinned older archive checksums while
  `release/release-manifest.json` contains the final signed artifact checksums.
  Added release-manifest-aware and clean-checkout-safe coverage to
  `scripts/homebrew-formula.test.ts` and confirmed it failed against the stale
  macOS checksum before updating the formula.
- Updated the in-repository formula to the final `release/release-manifest.json`
  checksums:
  - macOS:
    `d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59`
  - Linux:
    `a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098`
- `npx vitest run scripts/homebrew-formula.test.ts` now passes with the formula
  checksum assertions in place.
- `brew audit --strict goniszewski/little-imp/little-imp` passes for the
  registered tap formula shape. Homebrew 5.1 rejects direct path audit with
  `Calling brew audit [path ...] is disabled`, so the edited formula's
  release-specific checksum guard lives in the Vitest check.
- `brew style Formula/little-imp.rb` passes for the edited in-repository
  formula file.
- `brew install --dry-run goniszewski/little-imp/little-imp` reports the
  registered tap path would install `little-imp` and the `bun` dependency.
- Live Homebrew artifact fetching remains blocked by the same public visibility
  issue as TASK-078: `brew fetch --formula goniszewski/little-imp/little-imp`
  fails before install/runtime work because GitHub returns `HTTP 404` for
  `https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-macos.tar.gz`.

## Remaining Blocker

TASK-079 remains in progress until the release archive URLs are publicly
downloadable or an authenticated Homebrew distribution path is explicitly
chosen. Once artifact fetching succeeds, rerun the live `brew install`, service
start, `/health`, service stop, uninstall, and data-preservation checks before
moving the task to `done`.
