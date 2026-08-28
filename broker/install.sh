#!/usr/bin/env bash
set -euo pipefail

repository_url="${BROKER_REPOSITORY_URL:-https://github.com/amichne/slopsentral.git}"
release_base_url="${BROKER_RELEASE_BASE_URL:-https://github.com/amichne/slopsentral/releases/download}"
install_dir="${BROKER_INSTALL_DIR:-${HOME}/.local/bin}"
version="${BROKER_VERSION:-}"

if ! command -v node >/dev/null 2>&1; then
  printf 'Broker requires Node.js 22 or newer.\n' >&2
  exit 2
fi
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ ! "${node_major}" =~ ^[0-9]+$ ]] || (( node_major < 22 )); then
  printf 'Broker requires Node.js 22 or newer; found %s.\n' "$(node --version)" >&2
  exit 2
fi

if [[ -z "${version}" ]]; then
  version="$({
    git ls-remote --refs --sort='-v:refname' \
      "${repository_url}" 'refs/tags/broker-v*'
  } | awk '
    NR == 1 {
      sub("^refs/tags/broker-v", "", $2)
      print $2
    }
  ')"
fi

if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  printf 'Could not resolve a valid Broker release version.\n' >&2
  exit 2
fi

tag="broker-v${version}"
archive="broker-${version}.tar.gz"
checksum="${archive}.sha256"
temporary_dir="$(mktemp -d)"
trap 'rm -rf -- "${temporary_dir}"' EXIT

for asset in "${archive}" "${checksum}"; do
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
    --output "${temporary_dir}/${asset}" \
    "${release_base_url}/${tag}/${asset}"
done

if command -v shasum >/dev/null 2>&1; then
  (cd "${temporary_dir}" && shasum -a 256 -c "${checksum}")
elif command -v sha256sum >/dev/null 2>&1; then
  (cd "${temporary_dir}" && sha256sum -c "${checksum}")
else
  printf 'Install shasum or sha256sum before installing Broker.\n' >&2
  exit 2
fi

tar -xzf "${temporary_dir}/${archive}" -C "${temporary_dir}"
binary="${temporary_dir}/broker-${version}/broker.mjs"
if [[ ! -f "${binary}" ]]; then
  printf 'The release archive did not contain broker.mjs.\n' >&2
  exit 2
fi

install -d "${install_dir}"
install -m 0755 "${binary}" "${install_dir}/broker"
printf 'Installed Broker %s at %s.\n' \
  "${version}" "${install_dir}/broker" >&2
