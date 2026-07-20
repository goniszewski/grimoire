# Grimoire v1.0.0 Release Execution

This doc covers the **outward-facing steps** the maintainer runs to publish the v1.0.0
release. Local prep (history rewrite, tagging, package.json metadata, e2e gate) is
already complete on `little-imp-clean` / `main` / `develop`.

For detailed per-area checklists (installer matrix, Docker, backup, CI gates,
documentation audit), refer to [release-checklist.md](./release-checklist.md) — update
version strings there from `0.1.0-beta` to `1.0.0` as you work through it.

---

## Pre-push state (already done locally)

- `main`, `develop`, `little-imp-clean`, `v1.0.0` tag → `8bbc0f2`
- `legacy/v0.x` → `7bb6e74` (v0.5 SvelteKit history preserved)
- Working tree clean; no secrets or `data/` tracked
- MIT `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` present
- `npm run check` and `npm run test:e2e` verified green on the 1.0 tip

---

## Step 1 — Build release artifacts

From a clean checkout of `main` (or `little-imp-clean`):

```bash
npm run package:release
```

Confirm `release/` contains:

- `little-imp-1.0.0-macos.tar.gz` + `.sha256`
- `little-imp-1.0.0-linux.tar.gz` + `.sha256`
- `release-manifest.json`

Run the validator and sign each archive before publishing:

```bash
npm run release:validate
gpg --armor --detach-sign --output release/little-imp-1.0.0-macos.tar.gz.asc release/little-imp-1.0.0-macos.tar.gz
gpg --armor --detach-sign --output release/little-imp-1.0.0-linux.tar.gz.asc  release/little-imp-1.0.0-linux.tar.gz
npm run release:validate -- --require-signatures
```

---

## Step 2 — Fill real SHA-256 checksums (critical: two files must match)

Extract the actual SHA-256 values from the signed archives:

```bash
# macOS
shasum -a 256 release/little-imp-1.0.0-macos.tar.gz
# Linux
shasum -a 256 release/little-imp-1.0.0-linux.tar.gz
```

Update **both** of the following (they must agree or `scripts/homebrew-formula.test.ts` fails):

### `Formula/grimoire.rb` (lines ~10 and ~13)

Replace the two placeholder values `000…000a` / `000…000b` with real SHA-256 strings:

```ruby
  on_macos do
    url "https://github.com/goniszewski/grimoire/releases/download/v1.0.0/little-imp-1.0.0-macos.tar.gz"
    sha256 "<REAL_MACOS_SHA256>"          # ← replace placeholder
  end

  on_linux do
    url "https://github.com/goniszewski/grimoire/releases/download/v1.0.0/little-imp-1.0.0-linux.tar.gz"
    sha256 "<REAL_LINUX_SHA256>"          # ← replace placeholder
  end
```

### `scripts/homebrew-formula.test.ts` (lines ~33–34)

Update the `"1.0.0"` entry in `releaseChecksumBaselines`:

```ts
"1.0.0": {
  macos: "<REAL_MACOS_SHA256>",
  linux: "<REAL_LINUX_SHA256>",
},
```

Optionally create `release/release-manifest.json` (the test cross-checks it if
present; `npm run package:release` may already produce it — verify the structure
matches the `ReleaseManifest` type in the test file).

After both files are updated, re-run the full gate:

```bash
npm run check
npx vitest run scripts/homebrew-formula.test.ts
```

Commit on `little-imp-clean` (conventional commit, no push yet):

```
chore(release): fill v1.0.0 Homebrew checksums with published artifact SHAs
```

---

## Step 3 — Push

```bash
git push --force-with-lease origin main develop
git push origin legacy/v0.x v1.0.0
```

`--force-with-lease` is required: `main`/`develop` replace the old v0.5 history.

---

## Step 4 — Create GitHub release `v1.0.0`

In the GitHub UI (or `gh release create`):

- Tag: `v1.0.0` (already present locally; pushed in step 3)
- Title: `Grimoire 1.0.0`
- Body: content from `docs/release-notes-v0.1.0-beta.md` updated for 1.0.0
- Attach all four artifacts:
  - `release/little-imp-1.0.0-macos.tar.gz`
  - `release/little-imp-1.0.0-macos.tar.gz.asc`
  - `release/little-imp-1.0.0-linux.tar.gz`
  - `release/little-imp-1.0.0-linux.tar.gz.asc`

The Homebrew formula URLs are hard-coded to
`https://github.com/goniszewski/grimoire/releases/download/v1.0.0/little-imp-1.0.0-{platform}.tar.gz`
— the upload filename must match exactly.

---

## Step 5 — Unarchive the GitHub repo

The repo is currently archived and shows v0.5. Unarchive it at
**Settings → Danger Zone → Unarchive repository** before the release is publicly
visible. An archived repo will prevent issues, PRs, community contribution metrics,
and reads as abandoned.

---

## Step 6 — Homebrew live validation

Once artifacts are publicly downloadable:

```bash
brew tap oven-sh/bun
brew tap goniszewski/grimoire "$PWD"
brew audit --strict goniszewski/grimoire/grimoire
brew install goniszewski/grimoire/grimoire
littleimp --help                        # should report 1.0.0
curl http://127.0.0.1:3210/health       # should report version: "1.0.0"
brew services start grimoire
brew services stop grimoire
brew uninstall grimoire
```

When live validation passes, update `README.md`:

- Change `### Homebrew (pending live validation)` → `### Homebrew`
- Remove or update the "not a supported beta installation path yet" caveat

Re-run `npx vitest run scripts/homebrew-formula.test.ts` — the test asserts the
README still contains the "pending" section until you update it, so update that
assertion too if you remove the caveat.

---

## Step 7 — Post-publish smoke

Run the installed-app e2e against the published artifacts:

```bash
npm run test:e2e:installed:published
```

This downloads `v1.0.0` from the GitHub release URL, verifies the archive checksum
and detached signature, then runs the installed-app smoke in an isolated temp home.

---

## Claude for OSS program (when ready to apply)

URL: https://claude.com/contact-sales/claude-for-oss

**Most plausible eligibility path:** *Community Builders* — 20+ unique external
contributors with merged PRs in the last 12 months. Confirm this metric holds against
the new `main` history before applying (the v0.5 → v1.0 force-push may affect the
count visible to GitHub). If the threshold is marginal, apply anyway under the
flexibility clause ("if you maintain something the ecosystem quietly depends on, apply
and tell us about it").

**Checklist before applying:**
- [ ] Repo is unarchived and actively accepts issues/PRs
- [ ] `main` shows the v1.0 codebase (not v0.5 SvelteKit)
- [ ] GitHub release `v1.0.0` exists with signed artifacts
- [ ] `README.md` accurately describes installation paths (update Homebrew caveat if live)
- [ ] Confirm the 12-month external-contributor metric via GitHub Insights

---

## Rollback

Nothing is irreversible until artifacts are published and the GitHub release is
marked non-draft. If something looks wrong after the push but before GitHub release
publication:

```bash
# Revert main/develop to old v0.5 (emergency only)
git push origin 7bb6e74:refs/heads/main 7bb6e74:refs/heads/develop
git push origin --delete v1.0.0
```

Local recovery (pre-push): `git branch -f main 7bb6e74` (origin SHA for old v0.5).
The `backup/pre-v1-release` local branch preserves the pre-reword tip.
