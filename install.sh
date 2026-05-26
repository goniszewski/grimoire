#!/usr/bin/env bash
# One-command Little Imp release installer.
# Downloads a published release archive, verifies it, then delegates to daemon/install.sh.
set -euo pipefail

APP_NAME="Little Imp"
REPO="goniszewski/little-imp"
VERSION="${LITTLEIMP_VERSION:-0.1.0-beta}"
RELEASE_BASE_URL="${LITTLEIMP_RELEASE_BASE_URL:-https://github.com/${REPO}/releases/download/v${VERSION}}"

MODE_ARGS=()
WORK_DIR=""
EXTRACTED_ROOT=""

info() { printf '\033[32m[INFO]\033[0m  %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m  %s\n' "$*"; }
error() { printf '\033[31m[ERROR]\033[0m %s\n' "$*" >&2; }
die() { error "$*"; exit 1; }

cleanup() {
  if [[ -n "${WORK_DIR}" && -d "${WORK_DIR}" ]]; then
    rm -rf "${WORK_DIR}"
  fi
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage: install.sh [--upgrade]

Downloads the ${APP_NAME} release archive for this platform, verifies the
published checksum, verifies a detached signature when one is published, and
runs the native installer from the verified archive.

Environment:
  LITTLEIMP_VERSION            Release version (default: ${VERSION})
  LITTLEIMP_RELEASE_BASE_URL   Base URL containing archive, .sha256, and optional .asc files
EOF
}

parse_args() {
  case "${1:-}" in
    --upgrade)
      MODE_ARGS=(--upgrade)
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    "")
      ;;
    *)
      die "Unknown argument: ${1}. Run with --help for usage."
      ;;
  esac
}

assert_safe_version() {
  if [[ ! "${VERSION}" =~ ^[A-Za-z0-9][A-Za-z0-9._+-]*$ ]]; then
    die "Release version contains unsupported characters: ${VERSION}"
  fi
}

detect_platform() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux) echo "linux" ;;
    *) die "Unsupported OS: $(uname -s). Only macOS and Linux are supported." ;;
  esac
}

require_command() {
  local command_name="$1"
  local help_text="$2"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    die "${help_text}"
  fi
}

checksum_command() {
  if command -v shasum >/dev/null 2>&1; then
    echo "shasum"
    return 0
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    echo "sha256sum"
    return 0
  fi
  die "A SHA-256 checksum tool is required. Install shasum or sha256sum and retry."
}

download_required() {
  local url="$1"
  local output="$2"
  local label="$3"

  info "Downloading ${label}..."
  if ! curl -fsSL "${url}" -o "${output}"; then
    die "Could not download ${label} from ${url}. Check the release URL and network connection."
  fi
}

download_optional_signature() {
  local url="$1"
  local output="$2"

  case "${url}" in
    http://*|https://*)
      local http_code
      if ! http_code="$(curl -sS -L -w "%{http_code}" -o "${output}" "${url}")"; then
        rm -f "${output}"
        die "Could not download detached signature from ${url}. Check the network connection and retry."
      fi

      case "${http_code}" in
        2??)
          return 0
          ;;
        404)
          rm -f "${output}"
          return 1
          ;;
        *)
          rm -f "${output}"
          die "Could not download detached signature from ${url} (HTTP ${http_code})."
          ;;
      esac
      ;;
  esac

  if curl -fsSL "${url}" -o "${output}" >/dev/null 2>&1; then
    return 0
  fi

  rm -f "${output}"
  return 1
}

expected_checksum_from_file() {
  local checksum_path="$1"
  local archive_name="$2"
  local line checksum filename

  line="$(head -n 1 "${checksum_path}")"
  checksum="$(printf '%s' "${line}" | awk '{print $1}')"
  filename="$(printf '%s' "${line}" | awk '{print $2}')"
  filename="${filename#\*}"

  if [[ ! "${checksum}" =~ ^[A-Fa-f0-9]{64}$ || "${filename}" != "${archive_name}" ]]; then
    die "Checksum file is invalid for ${archive_name}."
  fi

  printf '%s' "${checksum}" | tr 'A-F' 'a-f'
}

actual_checksum_for_file() {
  local command_name="$1"
  local archive_path="$2"

  case "${command_name}" in
    shasum)
      shasum -a 256 "${archive_path}" | awk '{print tolower($1)}'
      ;;
    sha256sum)
      sha256sum "${archive_path}" | awk '{print tolower($1)}'
      ;;
    *)
      die "Unsupported checksum command: ${command_name}"
      ;;
  esac
}

verify_checksum() {
  local archive_name="$1"
  local archive_path="$2"
  local checksum_path="$3"
  local command_name expected actual

  command_name="$(checksum_command)"
  expected="$(expected_checksum_from_file "${checksum_path}" "${archive_name}")"
  actual="$(actual_checksum_for_file "${command_name}" "${archive_path}")"

  if [[ "${actual}" != "${expected}" ]]; then
    die "Checksum mismatch for ${archive_name}. Refusing to run the installer."
  fi

  info "Checksum verified: ${archive_name}"
}

verify_signature_if_present() {
  local archive_name="$1"
  local archive_path="$2"
  local signature_path="$3"

  if [[ ! -f "${signature_path}" ]]; then
    warn "No detached signature found; checksum verified only."
    return 0
  fi

  require_command gpg "A detached signature was published, but gpg is not installed. Install gpg and retry."
  if ! gpg --verify "${signature_path}" "${archive_path}" >/dev/null 2>&1; then
    die "Signature verification failed for ${archive_name}. Refusing to run the installer."
  fi

  info "Signature verified: ${archive_name}.asc"
}

is_safe_archive_member() {
  local member="$1"
  local archive_root="$2"

  case "${member}" in
    ""|/*|..|../*|*/../*|*/..|*\\*)
      return 1
      ;;
  esac

  case "${member}" in
    "${archive_root}"|"${archive_root}/"|"${archive_root}/"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

validate_archive_members() {
  local archive_path="$1"
  local archive_root="$2"
  local archive_name="$3"
  local members member

  if ! members="$(tar -tzf "${archive_path}")"; then
    die "Could not inspect archive contents for ${archive_name}."
  fi

  if [[ -z "${members}" ]]; then
    die "Archive is empty: ${archive_name}."
  fi

  while IFS= read -r member; do
    if ! is_safe_archive_member "${member}" "${archive_root}"; then
      die "Unsafe archive path: ${member}"
    fi
  done <<< "${members}"
}

validate_archive_entry_types() {
  local archive_path="$1"
  local archive_name="$2"
  local listing line entry_type

  if ! listing="$(tar -tvzf "${archive_path}")"; then
    die "Could not inspect archive entry types for ${archive_name}."
  fi

  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    entry_type="${line:0:1}"
    case "${entry_type}" in
      -|d)
        ;;
      *)
        die "Archive contains unsupported entry type '${entry_type}' in ${archive_name}."
        ;;
    esac
  done <<< "${listing}"
}

extract_archive() {
  local archive_path="$1"
  local archive_root="$2"
  local extract_dir="$3"
  local expected_root="${extract_dir}/${archive_root}"
  local archive_name
  archive_name="$(basename "${archive_path}")"

  validate_archive_members "${archive_path}" "${archive_root}" "${archive_name}"
  validate_archive_entry_types "${archive_path}" "${archive_name}"

  info "Extracting verified archive..."
  tar -xzf "${archive_path}" -C "${extract_dir}"

  local installer_path="${expected_root}/daemon/install.sh"
  if [[ -L "${installer_path}" || ! -f "${installer_path}" || ! -x "${installer_path}" ]]; then
    die "Verified archive does not contain a regular executable daemon/install.sh."
  fi

  EXTRACTED_ROOT="${expected_root}"
}

main() {
  parse_args "$@"
  assert_safe_version
  require_command curl "curl is required to download release artifacts."
  require_command tar "tar is required to extract release artifacts."
  require_command bun "Bun is not installed. Install it with: curl -fsSL https://bun.sh/install | bash"

  local platform archive_root archive_name archive_url checksum_url signature_url
  platform="$(detect_platform)"
  archive_root="little-imp-${VERSION}-${platform}"
  archive_name="${archive_root}.tar.gz"
  archive_url="${RELEASE_BASE_URL%/}/${archive_name}"
  checksum_url="${archive_url}.sha256"
  signature_url="${archive_url}.asc"

  WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/little-imp-install.XXXXXX")"
  local archive_path="${WORK_DIR}/${archive_name}"
  local checksum_path="${archive_path}.sha256"
  local signature_path="${archive_path}.asc"

  info "Installing ${APP_NAME} ${VERSION} for ${platform}"
  download_required "${archive_url}" "${archive_path}" "${archive_name}"
  download_required "${checksum_url}" "${checksum_path}" "${archive_name}.sha256"
  verify_checksum "${archive_name}" "${archive_path}" "${checksum_path}"

  if download_optional_signature "${signature_url}" "${signature_path}"; then
    verify_signature_if_present "${archive_name}" "${archive_path}" "${signature_path}"
  else
    verify_signature_if_present "${archive_name}" "${archive_path}" ""
  fi

  extract_archive "${archive_path}" "${archive_root}" "${WORK_DIR}"

  info "Running native installer..."
  bash "${EXTRACTED_ROOT}/daemon/install.sh" "${MODE_ARGS[@]}"
}

main "$@"
