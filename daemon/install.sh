#!/usr/bin/env bash
# install.sh — littleimpd installer
# Usage: ./install.sh [--uninstall]
set -euo pipefail

DAEMON_NAME="littleimpd"
SERVICE_LABEL="com.littleimp.daemon"
INSTALL_DIR="${HOME}/.local/share/littleimp/daemon"
DATA_DIR="${HOME}/.local/share/littleimp"
LOG_DIR="${DATA_DIR}/logs"
HEALTH_URL="http://127.0.0.1:3210/health"
HEALTH_TIMEOUT=10

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
    *)      die "Unsupported OS: $(uname -s)" ;;
  esac
}

BUN_PATH=""

check_bun() {
  if ! command -v bun &>/dev/null; then
    die "Bun is not installed. Visit https://bun.sh to install it."
  fi
  BUN_PATH="$(command -v bun)"
  info "Found bun $(bun --version) at ${BUN_PATH}"
}

install_daemon_files() {
  info "Installing daemon files to ${INSTALL_DIR}…"
  mkdir -p "${INSTALL_DIR}"
  # Copy daemon source (rsync preferred; fall back to cp -r)
  if command -v rsync &>/dev/null; then
    rsync -a --exclude=node_modules --exclude=.env "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
  else
    cp -r "${SCRIPT_DIR}/." "${INSTALL_DIR}/"
    # Remove sensitive/unnecessary files that rsync would have excluded
    rm -rf "${INSTALL_DIR}/node_modules" 2>/dev/null || true
    rm -f  "${INSTALL_DIR}/.env" 2>/dev/null || true
  fi
  info "Installing dependencies…"
  (cd "${INSTALL_DIR}" && bun install --production)
}

create_config_dir() {
  info "Creating data/log directories…"
  mkdir -p "${DATA_DIR}" "${LOG_DIR}"
  if [[ ! -f "${DATA_DIR}/.env" ]]; then
    if [[ -f "${INSTALL_DIR}/.env.example" ]]; then
      cp "${INSTALL_DIR}/.env.example" "${DATA_DIR}/.env"
      info "Created default config at ${DATA_DIR}/.env"
    else
      warn ".env.example not found at ${INSTALL_DIR}/.env.example — skipping config creation"
      warn "Create ${DATA_DIR}/.env manually before starting the daemon"
    fi
  else
    info "Existing config found at ${DATA_DIR}/.env — skipping"
  fi
}

# ---------- autostart: macOS ----------
install_autostart_macos() {
  local plist_src="${SCRIPT_DIR}/platform/com.littleimp.daemon.plist"
  local plist_dst="${HOME}/Library/LaunchAgents/${SERVICE_LABEL}.plist"
  info "Installing LaunchAgent…"
  mkdir -p "${HOME}/Library/LaunchAgents"
  sed \
    -e "s|__INSTALL_DIR__|${INSTALL_DIR}|g" \
    -e "s|__DATA_DIR__|${DATA_DIR}|g" \
    -e "s|__BUN_PATH__|${BUN_PATH}|g" \
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
  # Substitute INSTALL_DIR placeholder (ExecStart uses %h already)
  sed \
    -e "s|__INSTALL_DIR__|${INSTALL_DIR}|g" \
    -e "s|__BUN_PATH__|${BUN_PATH}|g" \
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
  local deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
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
  printf '\n\033[32m✓ littleimpd installed and running!\033[0m\n'
  printf '  Health: %s\n' "${HEALTH_URL}"
  printf '  Data:   %s\n' "${DATA_DIR}"
  printf '  Logs:   %s\n\n' "${LOG_DIR}"
}

# ---------- uninstall ----------
uninstall() {
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
  info "Daemon files left in place at ${INSTALL_DIR}."
  info "To fully remove data, delete: ${DATA_DIR}"
}

# ---------- main ----------
main() {
  if [[ "${1:-}" == "--uninstall" ]]; then
    uninstall
    exit 0
  fi

  local os
  os="$(detect_os)"
  info "Detected OS: ${os}"

  check_bun
  install_daemon_files
  create_config_dir

  case "${os}" in
    macos) install_autostart_macos ;;
    linux) install_autostart_linux ;;
  esac

  start_daemon
  wait_for_health
  print_success
}

main "$@"
