#!/usr/bin/env bash
# install.sh — littleimpd installer
# Usage: ./install.sh [--uninstall] [--upgrade]
set -euo pipefail

DAEMON_NAME="littleimpd"
SERVICE_LABEL="com.littleimp.daemon"
INSTALL_DIR="${HOME}/.local/share/littleimp/daemon"
DATA_DIR="${HOME}/.local/share/littleimp"
LOG_DIR="${DATA_DIR}/logs"
CLI_BIN_DIR="${HOME}/.local/bin"
CLI_BIN="${CLI_BIN_DIR}/littleimp"
HEALTH_URL="http://127.0.0.1:3210/health"
HEALTH_TIMEOUT=15
BUN_MIN_MAJOR=1

# Resolve script directory (where daemon source lives)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- helpers ----------
info()    { printf '\033[32m[INFO]\033[0m  %s\n' "$*"; }
warn()    { printf '\033[33m[WARN]\033[0m  %s\n' "$*"; }
error()   { printf '\033[31m[ERROR]\033[0m %s\n' "$*" >&2; }
die()     { error "$*"; exit 1; }

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)  echo "linux" ;;
    *)      die "Unsupported OS: $(uname -s). Only macOS and Linux are supported." ;;
  esac
}

BUN_PATH=""

check_bun() {
  if ! command -v bun &>/dev/null; then
    die "Bun is not installed. Install it with: curl -fsSL https://bun.sh/install | bash"
  fi
  BUN_PATH="$(command -v bun)"
  local bun_version
  bun_version="$(bun --version)"
  local bun_major
  bun_major="$(printf '%s' "${bun_version}" | cut -d. -f1)"
  if (( bun_major < BUN_MIN_MAJOR )); then
    die "Bun ${BUN_MIN_MAJOR}.x or later is required (found ${bun_version}). Upgrade: bun upgrade"
  fi
  info "Found bun ${bun_version} at ${BUN_PATH}"
}

check_curl() {
  if ! command -v curl &>/dev/null; then
    die "curl is required but not found. Install curl via your system package manager."
  fi
}

stop_daemon() {
  local os
  os="$(detect_os)"
  info "Stopping existing daemon (if running)…"
  if [[ "${os}" == "macos" ]]; then
    launchctl stop "${SERVICE_LABEL}" 2>/dev/null || true
    # Poll until the process is no longer listed as running (max 10s)
    local i=0
    while launchctl list 2>/dev/null | grep -q "${SERVICE_LABEL}" && (( i < 10 )); do
      sleep 1
      (( i++ )) || true
    done
  else
    if systemctl --user is-active --quiet "${DAEMON_NAME}" 2>/dev/null; then
      systemctl --user stop "${DAEMON_NAME}" 2>/dev/null || true
      # Wait for the unit to fully stop (max 10s)
      local i=0
      while systemctl --user is-active --quiet "${DAEMON_NAME}" 2>/dev/null && (( i < 10 )); do
        sleep 1
        (( i++ )) || true
      done
    fi
  fi
}

install_daemon_files() {
  info "Installing daemon files to ${INSTALL_DIR}…"
  mkdir -p "${INSTALL_DIR}"
  # Copy daemon source (rsync preferred; fall back to cp -r)
  if command -v rsync &>/dev/null; then
    rsync -a --delete --exclude=node_modules --exclude=.env "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
  else
    cp -r "${SCRIPT_DIR}/." "${INSTALL_DIR}/"
    # Remove sensitive/unnecessary files that rsync would have excluded
    rm -rf "${INSTALL_DIR}/node_modules" "${INSTALL_DIR}/.git" 2>/dev/null || true
    rm -f  "${INSTALL_DIR}/.env" 2>/dev/null || true
  fi
  info "Installing dependencies…"
  (cd "${INSTALL_DIR}" && bun install --production)
  info "Daemon files installed"
}

install_cli() {
  info "Installing CLI command to ${CLI_BIN}…"
  mkdir -p "${CLI_BIN_DIR}"
  {
    printf '#!/usr/bin/env bash\n'
    printf 'exec %q %q "$@"\n' "${BUN_PATH}" "${INSTALL_DIR}/src/cli.ts"
  } > "${CLI_BIN}"
  chmod +x "${CLI_BIN}"

  case ":${PATH}:" in
    *":${CLI_BIN_DIR}:"*) ;;
    *) warn "${CLI_BIN_DIR} is not on PATH. Add it to your shell profile to run 'littleimp' directly." ;;
  esac
  info "CLI installed: ${CLI_BIN}"
}

create_config_dir() {
  info "Creating data/log directories…"
  mkdir -p "${DATA_DIR}" "${LOG_DIR}"
  if [[ ! -f "${DATA_DIR}/.env" ]]; then
    if [[ -f "${INSTALL_DIR}/.env.example" ]]; then
      cp "${INSTALL_DIR}/.env.example" "${DATA_DIR}/.env"
    else
      # Write a minimal default env file
      cat > "${DATA_DIR}/.env" <<EOF
HOST=127.0.0.1
PORT=3210
DATA_DIR=${DATA_DIR}
NODE_ENV=production
LOG_FORMAT=json
EOF
    fi
    chmod 600 "${DATA_DIR}/.env"
    info "Created default config at ${DATA_DIR}/.env"
  else
    info "Existing config found at ${DATA_DIR}/.env — skipping"
  fi
  # SQLite database is initialized automatically by the daemon on first start
  # via runMigrations() — no manual setup required.
}

# Escape a string for safe use as the replacement side of a sed s|...|REPLACEMENT|g expression.
# Escapes backslashes, the | delimiter, and & (which means "matched text" in sed replacement).
sed_escape() {
  printf '%s' "$1" | sed 's/[\\|&]/\\&/g'
}

# ---------- autostart: macOS ----------
install_autostart_macos() {
  local plist_src="${SCRIPT_DIR}/platform/com.littleimp.daemon.plist"
  local plist_dst="${HOME}/Library/LaunchAgents/${SERVICE_LABEL}.plist"
  info "Installing LaunchAgent…"
  mkdir -p "${HOME}/Library/LaunchAgents"
  local esc_install_dir esc_data_dir esc_bun_path
  esc_install_dir="$(sed_escape "${INSTALL_DIR}")"
  esc_data_dir="$(sed_escape "${DATA_DIR}")"
  esc_bun_path="$(sed_escape "${BUN_PATH}")"
  sed \
    -e "s|__INSTALL_DIR__|${esc_install_dir}|g" \
    -e "s|__DATA_DIR__|${esc_data_dir}|g" \
    -e "s|__BUN_PATH__|${esc_bun_path}|g" \
    "${plist_src}" > "${plist_dst}"
  launchctl unload -- "${plist_dst}" 2>/dev/null || true
  launchctl load -w -- "${plist_dst}"
  info "LaunchAgent installed: ${plist_dst}"
}

# ---------- autostart: Linux ----------
install_autostart_linux() {
  local service_src="${SCRIPT_DIR}/platform/littleimp.service"
  local service_dir="${HOME}/.config/systemd/user"
  local service_dst="${service_dir}/${DAEMON_NAME}.service"
  info "Installing systemd user unit…"
  mkdir -p "${service_dir}"
  local esc_install_dir esc_bun_path
  esc_install_dir="$(sed_escape "${INSTALL_DIR}")"
  esc_bun_path="$(sed_escape "${BUN_PATH}")"
  sed \
    -e "s|__INSTALL_DIR__|${esc_install_dir}|g" \
    -e "s|__BUN_PATH__|${esc_bun_path}|g" \
    "${service_src}" > "${service_dst}"
  systemctl --user daemon-reload
  systemctl --user enable "${DAEMON_NAME}"
  info "systemd unit installed: ${service_dst}"
}

start_daemon() {
  info "Starting daemon…"
  local os
  os="$(detect_os)"
  if [[ "${os}" == "macos" ]]; then
    launchctl start "${SERVICE_LABEL}" 2>/dev/null || true
  else
    systemctl --user start "${DAEMON_NAME}"
  fi
}

wait_for_health() {
  info "Waiting for daemon to become healthy (timeout ${HEALTH_TIMEOUT}s)…"
  local now
  now="$(date +%s)"
  local deadline=$(( now + HEALTH_TIMEOUT ))
  while (( $(date +%s) < deadline )); do
    local response
    response="$(curl -sf "${HEALTH_URL}" 2>/dev/null)" && {
      info "Daemon is healthy: ${response}"
      return 0
    }
    sleep 1
  done
  warn "Daemon did not respond within ${HEALTH_TIMEOUT}s. Check logs at ${LOG_DIR}."
  return 1
}

print_success() {
  local mode="${1:-install}"
  printf '\n\033[32m✓ littleimpd %sd and running!\033[0m\n' "${mode}"
  printf '  Health: %s\n' "${HEALTH_URL}"
  printf '  Data:   %s\n' "${DATA_DIR}"
  printf '  Logs:   %s\n' "${LOG_DIR}"
  printf '  UI:     http://127.0.0.1:3210\n\n'
}

# ---------- uninstall ----------
uninstall() {
  local purge="${1:-}"
  info "Uninstalling littleimpd…"
  local os
  os="$(detect_os)"
  if [[ "${os}" == "macos" ]]; then
    local plist="${HOME}/Library/LaunchAgents/${SERVICE_LABEL}.plist"
    launchctl unload -- "${plist}" 2>/dev/null || true
    rm -f "${plist}"
    info "LaunchAgent removed"
  else
    systemctl --user stop "${DAEMON_NAME}" 2>/dev/null || true
    systemctl --user disable "${DAEMON_NAME}" 2>/dev/null || true
    rm -f "${HOME}/.config/systemd/user/${DAEMON_NAME}.service"
    systemctl --user daemon-reload
    info "systemd unit removed"
  fi
  # Remove daemon installation files
  if [[ -d "${INSTALL_DIR}" ]]; then
    rm -rf "${INSTALL_DIR}"
    info "Daemon files removed from ${INSTALL_DIR}"
  fi
  if [[ -f "${CLI_BIN}" ]] && grep -Fq "${INSTALL_DIR}/src/cli.ts" "${CLI_BIN}" 2>/dev/null; then
    rm -f "${CLI_BIN}"
    info "CLI command removed: ${CLI_BIN}"
  fi
  if [[ "${purge}" == "--purge" ]]; then
    if [[ -d "${DATA_DIR}" ]]; then
      rm -rf "${DATA_DIR}"
      info "Data directory removed: ${DATA_DIR}"
    fi
  else
    info "Data preserved at: ${DATA_DIR}"
    info "To also remove data, run: $0 --uninstall --purge"
  fi
}

# ---------- main ----------
main() {
  local mode="install"

  case "${1:-}" in
    --uninstall)
      uninstall "${2:-}"
      exit 0
      ;;
    --upgrade)
      mode="upgrade"
      ;;
    --help|-h)
      printf 'Usage: %s [--upgrade] [--uninstall [--purge]]\n' "$(basename "$0")"
      printf '  (no flags)         Fresh install of littleimpd\n'
      printf '  --upgrade          Stop daemon, update files, restart\n'
      printf '  --uninstall        Stop and remove daemon and files (data preserved)\n'
      printf '  --uninstall --purge  Also delete all data at %s\n' "${DATA_DIR}"
      printf '\nInstalls the CLI command at %s\n' "${CLI_BIN}"
      exit 0
      ;;
    "")
      # no argument — fresh install, continue
      ;;
    *)
      die "Unknown argument: ${1}. Run with --help for usage."
      ;;
  esac

  local os
  os="$(detect_os)"
  info "Detected OS: ${os}"

  check_curl
  check_bun

  if [[ "${mode}" == "upgrade" ]]; then
    info "Upgrade mode: stopping daemon before replacing files…"
    stop_daemon
  fi

  install_daemon_files
  install_cli
  create_config_dir

  case "${os}" in
    macos) install_autostart_macos ;;
    linux) install_autostart_linux ;;
  esac

  start_daemon
  wait_for_health && print_success "${mode}" || {
    warn "Daemon may still be starting. Check logs at ${LOG_DIR}/daemon.log"
    exit 1
  }
}

main "$@"
