# TASK-063: Homebrew Formula or Tap

**Phase:** MVP readiness
**Priority:** medium
**Status:** done
**Area:** distribution / developer experience

## Description

Provide a Homebrew install path for the developer audience. This should consume
the signed or checksum-verified release archive instead of rebuilding from the
repository in the formula.

## Scope

1. Decide whether MVP uses an in-repository formula, a tap repository, or both.
2. Create a formula that installs the packaged daemon, frontend bundle, CLI, and
   installer/service assets from a release archive.
3. Wire Homebrew service instructions to the supported LaunchAgent behavior.
4. Add formula validation through `brew audit` and `brew install` where
   available.
5. Document install, upgrade, uninstall, and troubleshooting steps.

## Acceptance Criteria

- [x] A Homebrew-based install is wired to run the same app version as the
      signed release archive; final live install validation is tracked in the
      release checklist until artifacts are published.
- [x] The formula verifies archive integrity through checksum.
- [x] The formula does not require users to clone the repository.
- [x] Homebrew install and uninstall instructions preserve user data by default.
- [x] Documentation states whether Homebrew is the recommended or alternate MVP
      install path.

## Dependencies

- Depends on TASK-059.
- Should follow TASK-060 unless Homebrew is chosen as the primary one-command
  install path.

## Notes

- This is useful for MVP, but the signed archive plus one-command installer is
  the stronger cross-platform baseline.

## Review Notes

- Status is `done` for implementation because the formula, docs, audit, and
  dry-run work are complete. Full `brew install` against published
  `v0.1.0-beta` artifacts remains a post-publish release validation item.
- Added an in-repository `Formula/little-imp.rb` for a future
  `goniszewski/little-imp` tap. The formula consumes the published macOS or
  Linux release archive, verifies the archive SHA-256, installs the daemon,
  frontend bundle, CLI wrappers, metadata, and service assets under Homebrew,
  and exposes a `brew services` daemon wrapper.
- The formula declares the external `oven-sh/bun/bun` runtime dependency and
  installs daemon production dependencies during `brew install`; it does not
  clone the repository or rebuild the frontend.
- Added `scripts/homebrew-formula.test.ts` to keep formula URLs and checksums in
  sync with `release/release-manifest.json` and to assert the documented
  Homebrew install, upgrade, service, and uninstall guidance.
- Updated README, release checklist, roadmap, and changelog documentation to
  describe Homebrew as an alternate MVP install path. The one-command installer
  remains the recommended MVP path.
- Verified `ruby -c Formula/little-imp.rb`, `brew style Formula/little-imp.rb`,
  `brew audit --strict goniszewski/little-imp/little-imp` through a temporary
  local tap, `brew audit --strict --os=all --arch=all
  goniszewski/little-imp/little-imp`, `brew info
  goniszewski/little-imp/little-imp`, `npx vitest run
  scripts/homebrew-formula.test.ts`, and `npm run check`.
- `brew install --dry-run goniszewski/little-imp/little-imp` first confirmed
  that Homebrew requires `brew tap oven-sh/bun` before install planning can
  resolve the Bun dependency; after tapping it, dry-run resolved Little Imp and
  Bun successfully. Release validation docs now include that prerequisite.
- Full `brew install goniszewski/little-imp/little-imp` validation remains
  gated on publishing `v0.1.0-beta` GitHub release artifacts. On May 28, 2026,
  the GitHub release page and both canonical archive URLs returned HTTP 404, and
  `gh release view v0.1.0-beta --repo goniszewski/little-imp` reported
  `release not found`.
