# TASK-078: Published One-Command and CLI Upgrade Validation

**Phase:** MVP release closeout
**Priority:** high
**Status:** in-progress
**Area:** release / installer / update system

## Description

Validate the public install and upgrade paths against the published GitHub
release URLs rather than locally generated archives.

## Scope

1. Run the documented one-command install command against the published
   `v0.1.0-beta` tag.
2. Run the one-command `--upgrade` path over an existing install.
3. Run `littleimp update install --version 0.1.0-beta` against the published
   release artifacts.
4. Confirm checksums are fetched and verified.
5. Confirm detached signatures are verified when published.
6. Confirm daemon restart and health-version verification complete.
7. Record rollback guidance, failure output, and any publication URL mismatch.

## Acceptance Criteria

- [ ] Public one-command install succeeds from the published release tag.
- [ ] Public one-command upgrade preserves database, settings, backups, and
      logs.
- [ ] Packaged CLI update install succeeds against published assets.
- [ ] Checksum and signature behavior matches `docs/update-system.md`.
- [ ] Any failure keeps the release in draft/prerelease status until corrected
      or explicitly documented.

## Dependencies

- Depends on TASK-076.

## Notes

- This task verifies the URL and release-hosting assumptions that local archive
  tests cannot cover.

## Work Notes

- May 29, 2026: Selected as the next logical release-closeout task because it
  is the first remaining high-priority task and depends only on completed
  TASK-076.
- Authenticated GitHub state is healthy: `gh repo view goniszewski/little-imp`
  reports the repository as private, and `gh release view v0.1.0-beta --repo
  goniszewski/little-imp` reports a non-draft prerelease with the expected
  macOS archive, Linux archive, `.sha256`, `.asc`, and
  `release-manifest.json` assets.
- Public unauthenticated validation is currently blocked because the repository
  is private. A fresh unauthenticated check of the documented installer URL
  returned `HTTP/2 404`:
  `https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh`.
- A fresh unauthenticated check of the published Linux archive URL also
  returned `HTTP/2 404`:
  `https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-linux.tar.gz`.
- Because the root installer and packaged CLI upgrade path both download from
  the same unauthenticated release asset URL pattern, the one-command install,
  one-command `--upgrade`, and `littleimp update install --version
  0.1.0-beta` acceptance checks cannot pass until the repository is made public
  or an authenticated distribution path is explicitly chosen.
- No install or upgrade command was allowed to proceed on the active macOS user
  because the public download precondition failed and a successful run would
  mutate the current user's `com.littleimp.daemon` LaunchAgent.

## Blocker

TASK-078 remains release-blocked until one of these is true:

1. `goniszewski/little-imp` is made public and unauthenticated `curl` requests
   can fetch the tag-qualified root installer plus release archive assets.
2. The release process explicitly chooses and documents an authenticated
   distribution path for first users, then the installer and CLI validation
   commands are adjusted to use that path.
