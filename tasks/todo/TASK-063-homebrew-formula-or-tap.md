# TASK-063: Homebrew Formula or Tap

**Phase:** MVP readiness
**Priority:** medium
**Status:** todo
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

- [ ] A Homebrew-based install can run the same app version as the signed
      release archive.
- [ ] The formula verifies archive integrity through checksum.
- [ ] The formula does not require users to clone the repository.
- [ ] Homebrew install and uninstall instructions preserve user data by default.
- [ ] Documentation states whether Homebrew is the recommended or alternate MVP
      install path.

## Dependencies

- Depends on TASK-059.
- Should follow TASK-060 unless Homebrew is chosen as the primary one-command
  install path.

## Notes

- This is useful for MVP, but the signed archive plus one-command installer is
  the stronger cross-platform baseline.
