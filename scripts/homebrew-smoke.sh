#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-local}"
TAP_NAME="${HOMEBREW_TEST_TAP_NAME:-goniszewski/grimoire}"
FORMULA_NAME="grimoire"

export HOMEBREW_NO_AUTO_UPDATE="${HOMEBREW_NO_AUTO_UPDATE:-1}"
export HOMEBREW_NO_ENV_HINTS="${HOMEBREW_NO_ENV_HINTS:-1}"
export HOMEBREW_NO_INSTALL_CLEANUP="${HOMEBREW_NO_INSTALL_CLEANUP:-1}"

case "${MODE}" in
  local|published)
    ;;
  *)
    printf 'Usage: %s [local|published]\n' "${BASH_SOURCE[0]}" >&2
    exit 2
    ;;
esac

if ! command -v brew >/dev/null 2>&1; then
  printf 'Homebrew smoke test requires brew on PATH.\n' >&2
  exit 1
fi

if curl --fail --silent http://127.0.0.1:3210/health >/dev/null 2>&1; then
  printf 'Homebrew smoke test requires port 3210 to be unused. Stop the existing daemon first.\n' >&2
  exit 1
fi

# Homebrew 6 requires explicit trust for non-official taps. Keep that test-only
# trust entry out of the developer's normal Homebrew configuration.
homebrew_config_dir="$(mktemp -d)"
export XDG_CONFIG_HOME="${homebrew_config_dir}"

tap_was_present=false
if brew tap | grep -Fxq "${TAP_NAME}"; then
  tap_was_present=true
fi

if brew list --formula "${FORMULA_NAME}" >/dev/null 2>&1; then
  printf 'Refusing to replace an existing Homebrew installation: %s\n' "${FORMULA_NAME}" >&2
  rm -rf -- "${homebrew_config_dir}"
  exit 1
fi

brew_prefix="$(brew --prefix)"
data_dir="${brew_prefix}/var/little-imp"
data_dir_was_present=false
if [[ -e "${data_dir}" ]]; then
  data_dir_was_present=true
fi

tap_added=false
formula_installed=false
service_started=false

cleanup() {
  local exit_code=$?
  trap - EXIT

  if [[ "${service_started}" == true ]]; then
    brew services stop "${FORMULA_NAME}" >/dev/null 2>&1 || true
  fi

  if [[ "${formula_installed}" == true ]]; then
    brew uninstall --force "${FORMULA_NAME}" >/dev/null 2>&1 || true
  fi

  if [[ "${tap_added}" == true ]]; then
    brew untap --force "${TAP_NAME}" >/dev/null 2>&1 || true
  fi

  if [[ "${data_dir_was_present}" == false && -e "${data_dir}" ]]; then
    rm -rf -- "${data_dir}"
  fi

  rm -rf -- "${homebrew_config_dir}"
  exit "${exit_code}"
}

trap cleanup EXIT

if [[ "${data_dir_was_present}" == true ]]; then
  printf 'Refusing to use an existing Homebrew data directory: %s\n' "${data_dir}" >&2
  exit 1
fi

printf '==> Checking Homebrew formula style\n'
brew style "${PROJECT_ROOT}/Formula/grimoire.rb"

if [[ "${MODE}" == "local" && "${tap_was_present}" == true ]]; then
  printf 'Refusing to reuse existing tap %s for a local smoke test. Untap it first or set HOMEBREW_TEST_TAP_NAME.\n' "${TAP_NAME}" >&2
  exit 1
fi

if [[ "${tap_was_present}" == false ]]; then
  tap_added=true
  if [[ "${MODE}" == "local" ]]; then
    tap_source="${HOMEBREW_TAP_URL:-${PROJECT_ROOT}}"
    printf '==> Tapping local checkout as %s\n' "${TAP_NAME}"
    brew tap "${TAP_NAME}" "${tap_source}"
  elif [[ -n "${HOMEBREW_TAP_URL:-}" ]]; then
    printf '==> Tapping %s from %s\n' "${TAP_NAME}" "${HOMEBREW_TAP_URL}"
    brew tap "${TAP_NAME}" "${HOMEBREW_TAP_URL}"
  else
    printf '==> Tapping published GitHub tap %s\n' "${TAP_NAME}"
    brew tap "${TAP_NAME}"
  fi
else
  printf '==> Using existing tap %s\n' "${TAP_NAME}"
fi

if brew trust --help >/dev/null 2>&1; then
  printf '==> Trusting only %s\n' "${TAP_NAME}/${FORMULA_NAME}"
  brew trust --formula "${TAP_NAME}/${FORMULA_NAME}"
else
  printf '==> Homebrew has no tap-trust command; continuing without explicit trust\n'
fi

printf '==> Auditing %s\n' "${TAP_NAME}/${FORMULA_NAME}"
brew audit --formula --strict --online "${TAP_NAME}/${FORMULA_NAME}"

printf '==> Installing unqualified formula: brew install %s\n' "${FORMULA_NAME}"
formula_installed=true
brew install "${FORMULA_NAME}"

formula_prefix="$(brew --prefix "${FORMULA_NAME}")"
test -x "${formula_prefix}/bin/grimoire"
test -x "${formula_prefix}/bin/littleimp"
test -x "${formula_prefix}/bin/littleimpd"

printf '==> Running Homebrew formula test\n'
brew test "${TAP_NAME}/${FORMULA_NAME}"

printf '==> Starting Homebrew service\n'
service_started=true
brew services start "${FORMULA_NAME}"

health_ok=false
for _ in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3210/health >/dev/null 2>&1; then
    health_ok=true
    break
  fi
  sleep 1
done

if [[ "${health_ok}" != true ]]; then
  brew services list || true
  cat "${data_dir}/logs/daemon.error.log" 2>/dev/null || true
  printf 'Homebrew service did not become healthy.\n' >&2
  exit 1
fi

test -f "${data_dir}/.env"
test -d "${data_dir}/logs"

printf '==> Stopping Homebrew service\n'
brew services stop "${FORMULA_NAME}"
service_started=false

printf 'Homebrew %s smoke test passed for %s.\n' "${MODE}" "${TAP_NAME}/${FORMULA_NAME}"
