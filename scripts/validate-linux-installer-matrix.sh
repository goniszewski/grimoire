#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="${PROJECT_ROOT}/release"
PACKAGE_VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).version)" "${PROJECT_ROOT}/package.json")"
RELEASE_ARCHIVE_NAME="${LITTLEIMP_RELEASE_ARCHIVE_NAME:-little-imp-${PACKAGE_VERSION}-linux.tar.gz}"
RELEASE_ARCHIVE_PATH="${RELEASE_DIR}/${RELEASE_ARCHIVE_NAME}"
DEFAULT_TARGETS=("ubuntu:24.04" "debian:12")
TARGETS=("$@")

if [[ ${#TARGETS[@]} -eq 0 || -z "${TARGETS[0]:-}" ]]; then
  TARGETS=("${DEFAULT_TARGETS[@]}")
fi

if [[ ! -f "${RELEASE_ARCHIVE_PATH}" ]]; then
  printf 'Missing Linux release archive: %s. Run npm run package:release first.\n' "${RELEASE_ARCHIVE_PATH}" >&2
  exit 1
fi

container_name=""

cleanup_container() {
  if [[ -n "${container_name}" ]]; then
    docker rm -f "${container_name}" >/dev/null 2>&1 || true
    container_name=""
  fi
}

trap cleanup_container EXIT

wait_for_systemd() {
  local state=""
  for _ in $(seq 1 30); do
    state="$(docker exec "${container_name}" systemctl is-system-running 2>/dev/null || true)"
    case "${state}" in
      running|degraded)
        return 0
        ;;
    esac
    sleep 1
  done

  docker logs "${container_name}" >&2 || true
  printf 'systemd did not become ready in %s (last state: %s)\n' "${container_name}" "${state:-unknown}" >&2
  return 1
}

prepare_smoke_user() {
  docker exec "${container_name}" bash -lc '
set -euo pipefail
uid="$(id -u smoke)"
runtime_dir="/run/user/${uid}"
mkdir -p "${runtime_dir}"
chown smoke:smoke "${runtime_dir}"
chmod 700 "${runtime_dir}"
loginctl enable-linger smoke
systemctl start "user@${uid}.service"
'
}

run_installer_smoke() {
  local smoke_uid
  smoke_uid="$(docker exec "${container_name}" id -u smoke)"

  docker exec \
    --user smoke \
    --env HOME=/home/smoke \
    --env "XDG_RUNTIME_DIR=/run/user/${smoke_uid}" \
    --env "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${smoke_uid}/bus" \
    --env PATH=/home/smoke/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    --env "LITTLEIMP_MATRIX_ARCHIVE=/release/${RELEASE_ARCHIVE_NAME}" \
    "${container_name}" \
    bash -c '
set -euo pipefail

archive="${LITTLEIMP_MATRIX_ARCHIVE:?}"
test -f "${archive}"
workdir="$(mktemp -d)"
tar -xzf "${archive}" -C "${workdir}"
release_root="$(find "${workdir}" -maxdepth 1 -type d -name "little-imp-*-linux" | sort | tail -n 1)"

cd "${release_root}/daemon"

./install.sh
curl -fsS http://127.0.0.1:3210/health
systemctl --user is-enabled littleimpd
systemctl --user is-active littleimpd

printf "preserve\n" > "${HOME}/.local/share/littleimp/matrix-preserve.txt"
./install.sh --upgrade
test -f "${HOME}/.local/share/littleimp/matrix-preserve.txt"
curl -fsS http://127.0.0.1:3210/health

./install.sh --uninstall
test -d "${HOME}/.local/share/littleimp"
test ! -d "${HOME}/.local/share/littleimp/daemon"
test -f "${HOME}/.local/share/littleimp/matrix-preserve.txt"

./install.sh --uninstall --purge
test ! -e "${HOME}/.local/share/littleimp"
'
}

for target in "${TARGETS[@]}"; do
  safe_target="$(printf '%s' "${target}" | tr '/:' '--')"
  image_name="little-imp-installer-matrix:${safe_target}"
  container_name="little-imp-installer-${safe_target}-$$"

  printf '\n==> Building installer matrix image for %s\n' "${target}"
  docker build \
    --build-arg "BASE_IMAGE=${target}" \
    --file "${PROJECT_ROOT}/scripts/installer-matrix.Dockerfile" \
    --tag "${image_name}" \
    "${PROJECT_ROOT}"

  printf '\n==> Starting %s systemd container\n' "${target}"
  docker run \
    --detach \
    --name "${container_name}" \
    --privileged \
    --cgroupns=host \
    --tmpfs /run \
    --tmpfs /run/lock \
    --volume /sys/fs/cgroup:/sys/fs/cgroup:rw \
    --volume "${RELEASE_DIR}:/release:ro" \
    "${image_name}" >/dev/null

  wait_for_systemd
  prepare_smoke_user

  printf '\n==> Running installer smoke in %s\n' "${target}"
  run_installer_smoke

  cleanup_container
  printf 'Validated Linux installer matrix target: %s\n' "${target}"
done
