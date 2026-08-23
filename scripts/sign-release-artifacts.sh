#!/usr/bin/env bash
#
# sign-release-artifacts.sh — sign Grimoire release archives, verify, validate.
#
# Signs every release/*.tar.gz with a detached gpg signature, verifies the
# signatures, runs the strict release validator (--require-signatures), and
# exports the public key + fingerprint for the release notes.
#
# Usage:
#   scripts/sign-release-artifacts.sh [KEY_ID]
#
#   KEY_ID       gpg key id (long form, e.g. ED72EFB58D928945). When omitted,
#                the first secret key whose uid email matches the repo's
#                git user.email is used; falls back to the first secret key.
#
# Requires: gpg, npm (bun for the validator), and an unlocked key (no
# passphrase, or an agent/pinentry that can prompt interactively).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$REPO_ROOT/release"

# The release validator shells out to bun; make sure it is findable even when
# this script is invoked from an environment without ~/.bun/bin on PATH.
if ! command -v bun >/dev/null 2>&1 && [[ -x "$HOME/.bun/bin/bun" ]]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

if [[ ! -d "$RELEASE_DIR" ]]; then
  echo "error: $RELEASE_DIR does not exist — run 'npm run package:release' first." >&2
  exit 1
fi

# ─── Resolve the signing key ────────────────────────────────────────────────
KEY_ID="${1:-}"
if [[ -z "$KEY_ID" ]]; then
  GIT_EMAIL="$(git -C "$REPO_ROOT" config user.email 2>/dev/null || true)"
  if [[ -n "$GIT_EMAIL" ]]; then
    KEY_ID="$(
      gpg --list-secret-keys --keyid-format=long --with-colons 2>/dev/null |
        awk -F: -v email="$GIT_EMAIL" '
          $1 == "sec" { current = $5 }
          $1 == "uid" && index($10, email) > 0 { print current; exit }
        '
    )"
  fi
  if [[ -z "$KEY_ID" ]]; then
    KEY_ID="$(gpg --list-secret-keys --keyid-format=long 2>/dev/null | awk '/^sec/{print $2; exit}' | cut -d/ -f2)"
  fi
fi
if [[ -z "$KEY_ID" ]]; then
  echo "error: no gpg secret key found. Pass a key id explicitly." >&2
  exit 1
fi
echo "Signing key: $KEY_ID ($(gpg --list-keys --with-colons "$KEY_ID" 2>/dev/null | awk -F: '$1=="uid"{print $10; exit}'))"

# ─── Sign every release archive ─────────────────────────────────────────────
shopt -s nullglob
ARCHIVES=("$RELEASE_DIR"/*.tar.gz)
shopt -u nullglob
if [[ ${#ARCHIVES[@]} -eq 0 ]]; then
  echo "error: no release archives found in $RELEASE_DIR" >&2
  exit 1
fi

for archive in "${ARCHIVES[@]}"; do
  asc="$archive.asc"
  echo "Signing $(basename "$archive")"
  gpg --batch --yes --armor --detach-sign --local-user "$KEY_ID" \
    --output "$asc" "$archive"
done

# ─── Verify every signature ─────────────────────────────────────────────────
for archive in "${ARCHIVES[@]}"; do
  echo "Verifying $(basename "$archive")"
  gpg --verify "$archive.asc" "$archive" >/dev/null 2>&1 ||
    { echo "error: signature verification failed for $(basename "$archive")" >&2; exit 1; }
done

# ─── Strict release validation ──────────────────────────────────────────────
echo "Running release:validate --require-signatures"
( cd "$REPO_ROOT" && npm run release:validate -- --require-signatures )

# ─── Public key + fingerprint for the release notes ─────────────────────────
gpg --armor --export "$KEY_ID" > "$RELEASE_DIR/grimoire-release-key.asc"
FINGERPRINT="$(gpg --fingerprint "$KEY_ID" 2>/dev/null | grep -A1 '^pub' | tail -1 | tr -d ' ')"

echo
echo "Done. Signed artifacts:"
for archive in "${ARCHIVES[@]}"; do echo "  $archive.asc"; done
echo "  $RELEASE_DIR/grimoire-release-key.asc"
echo
echo "Release notes — signing key fingerprint (for LITTLEIMP_UPGRADE_SIGNING_KEY_FINGERPRINTS):"
echo "  $FINGERPRINT"
echo "Users import the public key with: gpg --import grimoire-release-key.asc"
