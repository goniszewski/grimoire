# Little Imp 0.1.0-beta Release Decision

Decision date: May 29, 2026

Recommendation: **No-go for public MVP promotion.**

The implemented product, signed local artifacts, local quality gates, Linux
installer matrix, local installed-app smoke, security regressions, and support
documentation are strong enough for a beta release candidate. The release
should not be promoted or announced as publicly installable yet because the
documented unauthenticated install and artifact URLs still return `404` while
the GitHub repository is private.

Keep the GitHub release as a prerelease until the public distribution path is
reachable and the publication-gated validation tasks pass.

May 31, 2026 update: TASK-080 is complete after a real fresh-data
first-user UX smoke pass against an isolated daemon using a loopback-only
frontend API override. The no-go recommendation remains because public
distribution artifacts are still the gating release risk.

## Release Identity

| Field | Value |
|---|---|
| Release target | `0.1.0-beta` |
| Release tag | `v0.1.0-beta` |
| Release-control branch | `develop` |
| Release commit | `50333cab0bc28edbfa26a81c0542510a357a1605` |
| GitHub release | <https://github.com/goniszewski/little-imp/releases/tag/v0.1.0-beta> |
| GitHub release state | Non-draft prerelease, published 2026-05-29T07:00:24Z |
| Repository visibility at decision time | Private |
| Decision-package pre-edit evidence refresh | Local `develop` at `2bec19077d5a063caec31bfc9e3fa3d52cfce8e4` before TASK-084 documentation edits |

Authenticated GitHub release inspection confirms the prerelease and expected
assets exist. Unauthenticated checks on May 29, 2026 still returned `404` for:

- `https://raw.githubusercontent.com/goniszewski/little-imp/v0.1.0-beta/install.sh`
- `https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-macos.tar.gz`
- `https://github.com/goniszewski/little-imp/releases/download/v0.1.0-beta/little-imp-0.1.0-beta-linux.tar.gz`

## Artifact Inventory

`release/release-manifest.json` was generated at
`2026-05-29T06:58:39.662Z`. The GitHub prerelease has the archive, checksum,
detached signature, and manifest assets attached.

| Platform | Archive | SHA-256 | Signature |
|---|---|---|---|
| macOS | `little-imp-0.1.0-beta-macos.tar.gz` | `d27e19b85a55a0316e9e2700312e919223c1b4ce88262b74c11bd8e2f3ebaf59` | `little-imp-0.1.0-beta-macos.tar.gz.asc` |
| Linux | `little-imp-0.1.0-beta-linux.tar.gz` | `a1ffb52c12ed0a292ce58562ed322698b8ed43690e8260bec7dc59ea87ca8098` | `little-imp-0.1.0-beta-linux.tar.gz.asc` |

Signature-required validation passed in TASK-076 and was refreshed during
TASK-082:

- `npm run release:validate -- --require-signatures`
- `gpg --verify release/little-imp-0.1.0-beta-macos.tar.gz.asc release/little-imp-0.1.0-beta-macos.tar.gz`
- `gpg --verify release/little-imp-0.1.0-beta-linux.tar.gz.asc release/little-imp-0.1.0-beta-linux.tar.gz`

## Validation Evidence

| Class | Evidence | Decision status |
|---|---|---|
| CI | GitHub Actions `Quality Gates` succeeded for the last pushed `develop` head before the TASK-084 docs edits, `2bec19077d5a063caec31bfc9e3fa3d52cfce8e4`: <https://github.com/goniszewski/little-imp/actions/runs/26633769194>. The TASK-084 documentation edits are covered by local documentation verification in the task note. | Passed for the pushed release-control head |
| Local quality gates | `npm run check` passed in TASK-083, including lint, frontend and daemon type-checks, frontend tests, daemon tests, API docs drift check, and production build. Earlier release-closeout checks also passed `npm run test:e2e`. | Passed |
| Playwright and first-run UX | `npm run test:e2e` passed. TASK-080 passed mocked first-run, add/search, degraded AI, import/export, backup verification, restore, and update-check flows with `npx playwright test e2e/first-run.spec.ts e2e/business-requirements.spec.ts --reporter=list` at 11/11 tests. On May 31, 2026, TASK-080 also completed the real fresh-data first-user UX smoke against an isolated daemon using a loopback-only frontend API override. | Passed; TASK-080 complete |
| Daemon tests | TASK-082 reran `npm run test:daemon` and focused integration tests for security hardening, updates, fetch safety, diagnostics, backup, import, reprocess, backup packages, CLI update, and restore recovery. | Passed |
| Release artifacts | TASK-076 generated signed macOS and Linux archives, checksums, detached signatures, and `release-manifest.json`; TASK-082 revalidated refreshed GitHub release artifacts. | Passed for authenticated/local artifacts |
| Public one-command install and CLI update | TASK-078 confirmed authenticated release assets exist, but unauthenticated raw installer and release archive URLs return `404`; install, `--upgrade`, and `littleimp update install --version 0.1.0-beta` cannot complete from the documented public URLs. | Blocked |
| Installed-app smoke | `npm run test:e2e:installed` passed against locally packaged artifacts. TASK-081 added `npm run test:e2e:installed:published`, but live public-artifact execution stopped at the public macOS archive `404` before install/runtime mutation. | Local passed; public blocked |
| Docker | Docker Compose build/start/health validation passed with host port publishing bound to `127.0.0.1:3210:3210`; `docker compose down` preserved the named data volume. TASK-082 confirmed the rendered Compose port remains loopback-only. | Passed |
| Installer matrix | TASK-077 passed Ubuntu 24.04 LTS and Debian 12 systemd-user installs from signed release artifacts, including health, autostart, upgrade data preservation, uninstall preservation, and explicit purge. macOS arm64 has historical isolated installer evidence and a May 29 non-mutating active LaunchAgent check. | Passed with documented macOS skips |
| Homebrew | TASK-079 aligned formula checksums with `release/release-manifest.json`, added checksum drift coverage, passed `npx vitest run scripts/homebrew-formula.test.ts`, `brew style Formula/little-imp.rb`, `brew audit --strict goniszewski/little-imp/little-imp`, and a dry-run install plan. Live fetch/install/service checks remain blocked by public archive `404`. | Local formula passed; live install blocked |
| Update system | Local packaged update behavior is documented in [update-system.md](./update-system.md) and covered by release-closeout tests. Public `littleimp update install --version 0.1.0-beta` is blocked by the same unauthenticated release URL failure as TASK-078. | Local passed; public blocked |
| Backup and restore | Backup/restore design, local backup verification, encrypted package creation/verification/restore, rollback directory behavior, and restart-required restore UX are covered by implementation tasks, installed-app smoke, release checklist evidence, and [backup-design.md](./backup-design.md). | Passed |
| Diagnostics and support | TASK-083 added public release notes and support links. TASK-082 confirmed diagnostics redaction for secrets, content, notes, embedding model sentinels, and vector values. [diagnostics.md](./diagnostics.md) states diagnostics are local support bundles, not telemetry. | Passed |
| Security regressions | TASK-082 verified localhost-only native and Docker posture, unsafe origin rejection, CSP/browser hardening headers, private-host/update-source blocking, guarded body/path handling, diagnostics redaction, and release signature validation. | Passed |
| Documentation | TASK-075 release-candidate freeze, TASK-083 release notes, and local link/API-docs checks keep release-facing docs aligned with `0.1.0-beta` and the remaining public-validation caveats. TASK-084 adds a separate local verification note for the new decision-package docs. | Passed |

## Skipped Or Gated Checks

These are explicit and should not be represented as completed release evidence:

- Public one-command install is blocked because the tag-qualified raw installer
  URL returns `404` to unauthenticated requests while the repository is private.
- Public one-command upgrade is blocked by the same raw installer visibility
  failure.
- Public packaged CLI update install is blocked because release archive URLs
  return `404` to unauthenticated requests.
- Published-artifact installed-app E2E is implemented but blocked before
  runtime validation because the public archive download returns `404`.
- Live Homebrew `brew install`, service start, `/health`, service stop,
  uninstall, and Homebrew data-preservation checks are blocked because Homebrew
  cannot fetch the public release archive while it returns `404`.
- macOS arm64 fresh release-path install was not rerun on May 29 because no
  separate test user or Apple Silicon VM was available and mutating the active
  LaunchAgent would affect the current user service.
- macOS 12+ x64 remains a manual validation gap because no Intel Mac or x64
  macOS VM is available in this workspace.

## Known Limitations Accepted For MVP

These limitations are acceptable for an MVP beta if the release remains framed
as local-first, single-user software:

- Little Imp has scoped local integration-token auth for MCP and protected
  local capture, but the general first-party REST API remains loopback-trusted
  and must not be exposed on a public network without an authenticated tunnel,
  VPN, or reverse proxy in front of it.
- The app is single-user and local-first; multi-user support, multi-device sync,
  packaged browser extension clients, optional authentication, and
  public-network deployment modes are post-MVP work.
- The Grimoire parity follow-up batch is scoped to local-first, single-user,
  loopback-first, local-integration compatibility. It does not include
  multi-user accounts/admin, public-server mode, Grimoire endpoint aliases,
  packaged browser-extension/bookmarklet clients, extension smoke tests, or
  direct Grimoire/PocketBase backup import.
- Update checks and installs are explicit and user-controlled. Automatic update
  checks, background notifications, one-click in-app install, and automatic
  rollback are not shipped.
- Restore intentionally requires a daemon restart after data replacement.
- Settings can verify or restore encrypted backup packages only when the
  package path is under the configured backup folder. The packaged CLI is the
  supported path for encrypted package files stored elsewhere.
- macOS x64 validation still requires Intel hardware or an x64 macOS VM before
  that support claim can move from documented target to fresh release evidence.

The public artifact visibility failure is not an acceptable MVP limitation for
a public installable release. It is a release blocker.

## Required Follow-Up Before Go

1. Make `goniszewski/little-imp` and the `v0.1.0-beta` tag/release assets
   publicly reachable, or explicitly choose and document an authenticated
   distribution path.
2. Rerun TASK-078 against the chosen distribution path:
   - one-command install;
   - one-command `--upgrade`;
   - `littleimp update install --version 0.1.0-beta`;
   - checksum and detached signature verification;
   - daemon restart and `/health` version confirmation.
3. Rerun TASK-079 live Homebrew validation:
   - `brew fetch --formula goniszewski/little-imp/little-imp`;
   - `brew install goniszewski/little-imp/little-imp`;
   - `littleimp --help`;
   - `brew services start little-imp`;
   - `/health` reports `0.1.0-beta`;
   - `brew services stop little-imp`;
   - `brew uninstall little-imp`;
   - Homebrew-managed data preservation.
4. Rerun `npm run test:e2e:installed:published` so the public-asset smoke
   downloads, verifies, installs, and exercises the release archive users will
   fetch.
5. Decide whether macOS x64 remains a documented manual validation gap for the
   beta or must be validated before public promotion.

## Final Decision

Do not promote `v0.1.0-beta` as publicly installable yet.

The release candidate is ready for continued prerelease validation, but public
promotion must wait until unauthenticated distribution access is fixed or an
authenticated distribution path is deliberately adopted and validated. TASK-078
is the primary release-blocking follow-up. TASK-079 and TASK-081 are blocked by
the same public artifact visibility issue. TASK-080 has complete fresh-data
first-user UX evidence and is no longer an environment gap for the release
decision.
