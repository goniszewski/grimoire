#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d dist ]]; then
  echo "Demo bundle guard: dist/ does not exist. Run npm run build:demo first." >&2
  exit 1
fi

if rg -n -i \
  -e "127\\.0\\.0\\.1:3210" \
  -e "localhost:3210" \
  -e "document\\.cookie" \
  -e "fonts\\.googleapis\\.com" \
  -e "fonts\\.gstatic\\.com" \
  dist; then
  echo "Demo bundle guard: forbidden daemon, cookie, or third-party font reference found in dist/." >&2
  exit 1
fi

echo "Demo bundle guard passed: no loopback daemon, cookie, or third-party font reference found in dist/."
