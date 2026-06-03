#!/usr/bin/env bash
#
# scripts/setup-local-tools.sh
#
# Download portable Node.js and Bun runtimes into local/ so coding agents can
# run tests, type-checks, linting, and builds on hosts without system installs.
#
# Usage:
#   bash scripts/setup-local-tools.sh          # provision (idempotent)
#   bash scripts/setup-local-tools.sh --force  # re-download everything
#
# After provisioning, add local/bin to PATH:
#   export PATH="$PWD/local/bin:$PATH"
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="$REPO_ROOT/local"
BIN_DIR="$LOCAL_DIR/bin"
FORCE="${1:-}"

NODE_VERSION="22.14.0"
NODE_URL_BASE="https://nodejs.org/dist/v${NODE_VERSION}"

mkdir -p "$BIN_DIR"

# ─── Detect platform ──────────────────────────────────────────────────────────

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  darwin) OS_LABEL="darwin" ;;
  linux)  OS_LABEL="linux"  ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_LABEL="x64"   ; ARCH_BUN="x64"       ;;
  aarch64|arm64) ARCH_LABEL="arm64" ; ARCH_BUN="aarch64"   ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

echo "Detected: ${OS_LABEL}-${ARCH_LABEL}"

# ─── Helper: download and extract only when missing ───────────────────────────

download_if_missing() {
  local label="$1"      # human-readable name
  local url="$2"
  local dest_dir="$3"
  local marker="$4"     # path whose existence signals "already extracted"

  if [ -e "$marker" ] && [ "$FORCE" != "--force" ]; then
    echo "  ✓ $label already present at $dest_dir (use --force to re-download)"
    return 0
  fi

  echo "  ↓ Downloading $label …"
  rm -rf "$dest_dir"
  mkdir -p "$dest_dir"

  local tmpfile
  tmpfile="$(mktemp /tmp/littleimp-tool-XXXXXX)"

  if ! curl -fsSL "$url" -o "$tmpfile"; then
    echo "  ✗ Failed to download $label from $url"
    rm -f "$tmpfile"
    exit 1
  fi

  echo "  ↓ Extracting $label …"
  case "$url" in
    *.tar.gz|*.tgz)
      tar -xzf "$tmpfile" -C "$dest_dir"
      ;;
    *.zip)
      unzip -qo "$tmpfile" -d "$dest_dir"
      ;;
    *)
      echo "  ✗ Unknown archive type: $url"
      rm -f "$tmpfile"
      exit 1
      ;;
  esac

  rm -f "$tmpfile"
  echo "  ✓ $label ready"
}

# ─── Node.js ───────────────────────────────────────────────────────────────────

NODE_DIR="$LOCAL_DIR/node-v${NODE_VERSION}"
case "${OS_LABEL}-${ARCH_LABEL}" in
  darwin-arm64) NODE_ARCH="darwin-arm64" ;;
  darwin-x64)   NODE_ARCH="darwin-x64"   ;;
  linux-x64)    NODE_ARCH="linux-x64"    ;;
  linux-arm64)  NODE_ARCH="linux-arm64"  ;;
esac
NODE_ARCHIVE="node-v${NODE_VERSION}-${NODE_ARCH}.tar.gz"
NODE_URL="${NODE_URL_BASE}/${NODE_ARCHIVE}"

download_if_missing "Node.js v${NODE_VERSION} (${NODE_ARCH})" "$NODE_URL" "$NODE_DIR" "$NODE_DIR"

# Node.js tarball extracts into a subfolder; find the actual bin/ directory
NODE_BIN="$(find "$NODE_DIR" -name node -type f 2>/dev/null | head -1)"
if [ -z "$NODE_BIN" ]; then
  echo "  ✗ Could not find node binary inside $NODE_DIR"
  exit 1
fi
NODE_BIN_DIR="$(dirname "$NODE_BIN")"

# Create / update symlinks
ln -snf "$NODE_BIN_DIR/node" "$BIN_DIR/node"
ln -snf "$NODE_BIN_DIR/npm"  "$BIN_DIR/npm"
ln -snf "$NODE_BIN_DIR/npx"  "$BIN_DIR/npx"
chmod +x "$NODE_BIN_DIR/node" "$NODE_BIN_DIR/npm" "$NODE_BIN_DIR/npx"

# ─── Bun ───────────────────────────────────────────────────────────────────────

BUN_DIR="$LOCAL_DIR/bun-latest"
BUN_ARCHIVE="bun-${OS_LABEL}-${ARCH_BUN}.zip"
BUN_URL="https://github.com/oven-sh/bun/releases/latest/download/${BUN_ARCHIVE}"

download_if_missing "Bun (${OS_LABEL}-${ARCH_BUN})" "$BUN_URL" "$BUN_DIR" "$BUN_DIR"

# Bun's zip extracts into a folder named bun-<os>-<arch>/; find the binary
if [ -f "$BUN_DIR/bun" ]; then
  BUN_BINARY="$BUN_DIR/bun"
else
  BUN_BINARY="$(find "$BUN_DIR" -name bun -type f 2>/dev/null | head -1)"
fi

if [ -z "$BUN_BINARY" ]; then
  echo "  ✗ Could not find bun binary inside $BUN_DIR"
  exit 1
fi

ln -snf "$BUN_BINARY" "$BIN_DIR/bun"
chmod +x "$BUN_BINARY"

# ─── Verify ────────────────────────────────────────────────────────────────────

echo ""
echo "── Tool versions ──────────────────────────────"
export PATH="$BIN_DIR:$PATH"
echo "  node:  $(node --version)"
echo "  npm:   $(npm --version)"
echo "  npx:   $(npx --version)"
echo "  bun:   $(bun --version)"
echo "────────────────────────────────────────────────"
echo ""
echo "Add to your PATH:"
echo "  export PATH=\"\$PWD/local/bin:\$PATH\""
