# TASK-125: macOS x64 Validation or Documented Acceptance

**Phase:** Release unblocking
**Priority:** high (P1)
**Status:** done
**Area:** distribution / installer-matrix

## Description

The release checklist lists macOS 12+ x64 (Intel) as a supported target, but no Intel Mac or x64 macOS VM is available in this workspace to validate it. Either validate the native installer on Intel hardware, or promote the current "manual validation gap" status to an explicit accepted limitation with a documented timeline.

## Scope

1. If Intel hardware or an x64 macOS VM becomes available:
   - Run `cd daemon && ./install.sh` on a clean profile or VM.
   - Verify `curl http://127.0.0.1:3210/health` returns `version: "0.1.0-beta"`.
   - Verify LaunchAgent starts the daemon after login.
   - Run `./install.sh --upgrade` over an existing install and confirm data preservation.
   - Run `./install.sh --uninstall` and confirm data remains unless `--purge`.
   - Run `./install.sh --uninstall --purge` and confirm cleanup.
2. If no Intel hardware is available:
   - Update `docs/release-decision-v0.1.0-beta.md` to move macOS x64 from "skipped validation" to "explicit accepted limitation."
   - Update `docs/release-checklist.md` and `docs/installer-matrix-validation.md` to reflect the documented gap.
   - Add a note to `docs/release-notes-v0.1.0-beta.md` listing macOS arm64 as the validated Mac target and macOS x64 as a best-effort target.

## Acceptance Criteria

- [ ] macOS x64 is either validated with documented evidence, or the release documentation explicitly accepts it as a known limitation with a timeline for resolution.
- [ ] README, release notes, and installer matrix docs agree on the x64 support claim.

## Dependencies

- No code dependencies. Hardware availability is the only dependency.

## Notes

- The universal binary (`little-imp-0.1.0-beta-macos.tar.gz`) works on both arm64 and x64 — the gap is installer validation, not the archive itself.
- If validated, record the host OS version, architecture, Bun version, and command output in `docs/installer-matrix-validation.md`.
