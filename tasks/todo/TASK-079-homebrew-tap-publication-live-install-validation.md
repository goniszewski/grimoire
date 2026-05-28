# TASK-079: Homebrew Tap Publication and Live Install Validation

**Phase:** MVP release closeout
**Priority:** medium
**Status:** todo
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

- [ ] Homebrew formula checks and strict audit pass.
- [ ] Live `brew install` succeeds from published archives.
- [ ] Homebrew service starts the daemon and `/health` reports
      `0.1.0-beta`.
- [ ] Uninstall preserves `$(brew --prefix)/var/little-imp` by default.
- [ ] README and release checklist remain accurate for the tap path.

## Dependencies

- Depends on TASK-076.

## Notes

- Homebrew remains the alternate MVP install path. The one-command installer is
  still the primary cross-platform path.
