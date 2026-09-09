#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-local}"
TAP_NAME="${HOMEBREW_TEST_TAP_NAME:-goniszewski/grimoire}"
FORMULA_NAME="grimoire"
TEST_PORT="${HOMEBREW_TEST_PORT:-3210}"
UPGRADE_FROM="${HOMEBREW_TEST_UPGRADE_FROM_FORMULA:-}"
ARCHIVE_DIR="${HOMEBREW_TEST_ARCHIVE_DIR:-}"

if [[ ! "${TEST_PORT}" =~ ^[1-9][0-9]{0,4}$ ]] || (( TEST_PORT > 65535 )); then
  printf 'Invalid HOMEBREW_TEST_PORT: %s\n' "${TEST_PORT}" >&2
  exit 2
fi

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

if [[ "${MODE}" == published && ( -n "${UPGRADE_FROM}" || -n "${ARCHIVE_DIR}" ) ]]; then
  printf 'Archive caching and upgrade fixtures are local-mode only.\n' >&2
  exit 2
fi
if [[ -n "${UPGRADE_FROM}" && ! -f "${UPGRADE_FROM}" ]]; then
  printf 'Upgrade source formula does not exist: %s\n' "${UPGRADE_FROM}" >&2
  exit 2
fi

if ! command -v brew >/dev/null 2>&1; then
  printf 'Homebrew smoke test requires brew on PATH.\n' >&2
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  printf 'Homebrew smoke test requires lsof for its port safety check.\n' >&2
  exit 1
fi

if lsof -nP -iTCP:"${TEST_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  printf 'Homebrew smoke test requires port %s to be unused.\n' "${TEST_PORT}" >&2
  exit 1
fi

# Homebrew 6 requires explicit trust for non-official taps. Keep that test-only
# trust entry out of the developer's normal Homebrew configuration.
homebrew_config_dir="$(mktemp -d)"
export XDG_CONFIG_HOME="${homebrew_config_dir}"
# Keep runtime settings and service overrides out of the user's normal profile.
mkdir -p "${homebrew_config_dir}/homebrew/services"
printf 'PORT=%s\nXDG_CONFIG_HOME=%s\n' "${TEST_PORT}" "${homebrew_config_dir}" > "${homebrew_config_dir}/homebrew/services/grimoire.env"
chmod 600 "${homebrew_config_dir}/homebrew/services/grimoire.env"

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
if [[ -e "${data_dir}" || -L "${data_dir}" ]]; then
  data_dir_was_present=true
fi

tap_added=false
formula_installed=false
service_started=false

cleanup() {
  local exit_code=$?
  trap - EXIT

  if [[ "${service_started}" == true ]]; then
    if ! brew services stop "${FORMULA_NAME}" >/dev/null 2>&1; then
      printf 'Cleanup could not stop Grimoire; preserving its data.\n' >&2
      rm -rf -- "${homebrew_config_dir}"
      exit 1
    fi
  fi

  if [[ "${formula_installed}" == true ]]; then
    if ! brew uninstall --force --ignore-dependencies "${FORMULA_NAME}" >/dev/null 2>&1; then
      printf 'Cleanup could not uninstall Grimoire; preserving its data and tap.\n' >&2
      exit 1
    fi
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
    # git clone omits uncommitted edits; smoke the formula being reviewed.
    cp "${PROJECT_ROOT}/Formula/grimoire.rb" "$(brew --repository "${TAP_NAME}")/Formula/grimoire.rb"
  elif [[ -n "${HOMEBREW_TAP_URL:-}" ]]; then
    printf '==> Tapping %s from %s\n' "${TAP_NAME}" "${HOMEBREW_TAP_URL}"
    brew tap "${TAP_NAME}" "${HOMEBREW_TAP_URL}"
  else
    printf '==> Tapping public Grimoire repository as %s\n' "${TAP_NAME}"
    brew tap "${TAP_NAME}" "https://github.com/goniszewski/grimoire.git"
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

tap_formula="$(brew --repository "${TAP_NAME}")/Formula/grimoire.rb"
if [[ -n "${UPGRADE_FROM}" ]]; then
  cp "${UPGRADE_FROM}" "${tap_formula}"
fi

# Pre-publication candidates may be supplied from an authenticated download.
# Homebrew still verifies the formula's SHA-256; public mode always downloads.
cache_archive() {
  if [[ -n "${ARCHIVE_DIR}" ]]; then
    local cache_path archive_name
    cache_path="$(brew --cache --build-from-source "${TAP_NAME}/${FORMULA_NAME}")"
    archive_name="${cache_path##*--}"
    [[ -f "${ARCHIVE_DIR}/${archive_name}" ]] || exit 1
    mkdir -p "$(dirname "${cache_path}")"
    cp "${ARCHIVE_DIR}/${archive_name}" "${cache_path}"
  fi
}

printf '==> Auditing %s\n' "${TAP_NAME}/${FORMULA_NAME}"
if [[ "${MODE}" == published ]]; then
  brew audit --formula --strict --online "${TAP_NAME}/${FORMULA_NAME}"
  brew fetch --force --build-from-source "${TAP_NAME}/${FORMULA_NAME}"
else
  brew audit --formula --strict "${TAP_NAME}/${FORMULA_NAME}"
fi
cache_archive

printf '==> Installing unqualified formula: brew install %s\n' "${FORMULA_NAME}"
formula_installed=true
brew install "${FORMULA_NAME}"

formula_prefix="$(brew --prefix "${FORMULA_NAME}")"
[[ -x "${formula_prefix}/bin/grimoire" ]] || exit 1
[[ -x "${formula_prefix}/bin/littleimp" ]] || exit 1
[[ -x "${formula_prefix}/bin/littleimpd" ]] || exit 1

printf '==> Running Homebrew formula test\n'
brew test "${TAP_NAME}/${FORMULA_NAME}"

printf '==> Starting Homebrew service\n'
service_started=true
brew services start "${FORMULA_NAME}"

bun_bin="$(brew --prefix bun)/bin/bun"
expected_version="$(cat "${formula_prefix}/libexec/VERSION")"
if [[ -z "${UPGRADE_FROM}" && -n "${HOMEBREW_TEST_EXPECTED_VERSION:-}" && "${expected_version}" != "${HOMEBREW_TEST_EXPECTED_VERSION}" ]]; then
  printf 'Installed version %s does not match requested version %s.\n' "${expected_version}" "${HOMEBREW_TEST_EXPECTED_VERSION}" >&2
  exit 1
fi

wait_for_health() {
  local health
  for _ in $(seq 1 30); do
    if health="$(curl --fail --silent --max-time 2 "http://127.0.0.1:${TEST_PORT}/health")" &&
      printf '%s' "${health}" | "${bun_bin}" -e '
        const body = await Bun.stdin.json();
        process.exit(body.status === "ok" && body.version === process.argv[1] ? 0 : 1);
      ' "${expected_version}"; then
      return 0
    fi
    sleep 1
  done
  brew services list || true
  cat "${data_dir}/logs/daemon.error.log" 2>/dev/null || true
  printf 'Homebrew service did not become healthy at version %s.\n' "${expected_version}" >&2
  return 1
}

wait_for_health

[[ -f "${data_dir}/.env" ]] || exit 1
[[ -d "${data_dir}/logs" ]] || exit 1

printf '==> Stopping Homebrew service\n'
brew services stop "${FORMULA_NAME}"
service_started=false

# Add durable user state while stopped, without queuing network extraction.
"${bun_bin}" -e '
  const { Database } = await import("bun:sqlite");
  const db = new Database(process.argv[1]);
  db.run("INSERT INTO bookmarks (id, url, domain, title, status) VALUES (?, ?, ?, ?, ?)",
    ["homebrew-smoke", "https://example.invalid/homebrew-smoke", "example.invalid", "Homebrew preservation fixture", "indexed"]);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
' "${data_dir}/littleimp.db"
printf '\n# Homebrew smoke: preserve custom configuration\n' >> "${data_dir}/.env"

# Stop before taking the database snapshot so WAL writes cannot race it.
[[ -f "${data_dir}/littleimp.db" ]] || exit 1
cp "${data_dir}/.env" "${homebrew_config_dir}/saved.env"
cp "${data_dir}/littleimp.db" "${homebrew_config_dir}/saved.db"
if [[ -n "${UPGRADE_FROM}" ]]; then
  printf '==> Upgrading and checking data/config preservation\n'
  cp "${PROJECT_ROOT}/Formula/grimoire.rb" "${tap_formula}"
  cache_archive
  brew upgrade "${FORMULA_NAME}"
  old_version="${expected_version}"
  expected_version="$(cat "${formula_prefix}/libexec/VERSION")"
  if [[ "${expected_version}" == "${old_version}" ||
        ( -n "${HOMEBREW_TEST_EXPECTED_VERSION:-}" && "${expected_version}" != "${HOMEBREW_TEST_EXPECTED_VERSION}" ) ]]; then
    printf 'Upgrade did not reach the requested version: %s -> %s.\n' "${old_version}" "${expected_version}" >&2
    exit 1
  fi
else
  printf '==> Reinstalling and checking data/config preservation\n'
  brew reinstall "${FORMULA_NAME}"
fi
cmp "${homebrew_config_dir}/saved.env" "${data_dir}/.env"
cmp "${homebrew_config_dir}/saved.db" "${data_dir}/littleimp.db"
brew test "${TAP_NAME}/${FORMULA_NAME}"
service_started=true
brew services start "${FORMULA_NAME}"
wait_for_health
brew services stop "${FORMULA_NAME}"
service_started=false
"${bun_bin}" -e '
  const { Database } = await import("bun:sqlite");
  const db = new Database(process.argv[1], { readwrite: true });
  const bookmark = db.query("SELECT title FROM bookmarks WHERE id = ?").get("homebrew-smoke");
  if (bookmark?.title !== "Homebrew preservation fixture") throw new Error("Saved bookmark was lost");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
' "${data_dir}/littleimp.db"
cmp "${homebrew_config_dir}/saved.env" "${data_dir}/.env"
cp "${data_dir}/littleimp.db" "${homebrew_config_dir}/saved.db"

# This disposable install cannot have pre-existing dependents. Avoid loading
# unrelated installed formulae from the user's other (untrusted here) taps.
printf '==> Uninstalling and checking data/config preservation\n'
brew uninstall --force --ignore-dependencies "${FORMULA_NAME}"
if brew list --formula "${FORMULA_NAME}" >/dev/null 2>&1; then
  printf 'Homebrew uninstall left an installed Grimoire keg.\n' >&2
  exit 1
fi
formula_installed=false
cmp "${homebrew_config_dir}/saved.env" "${data_dir}/.env"
cmp "${homebrew_config_dir}/saved.db" "${data_dir}/littleimp.db"

printf 'Homebrew %s smoke test passed for %s.\n' "${MODE}" "${TAP_NAME}/${FORMULA_NAME}"
