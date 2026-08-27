#!/usr/bin/env bash
set -euo pipefail

repository_url="${GRADLE_DYNAMIC_TOOLS_REPOSITORY_URL:-https://github.com/amichne/slopsentral.git}"
release_base_url="${GRADLE_DYNAMIC_TOOLS_RELEASE_BASE_URL:-https://github.com/amichne/slopsentral/releases/download}"
install_dir="${GRADLE_DYNAMIC_TOOLS_INSTALL_DIR:-${HOME}/.local/bin}"
version="${GRADLE_DYNAMIC_TOOLS_VERSION:-}"
install_only="${GRADLE_DYNAMIC_TOOLS_INSTALL_ONLY:-0}"

if [[ -z "${version}" ]]; then
  version="$({
    git ls-remote \
      --refs \
      --sort='-v:refname' \
      "${repository_url}" \
      'refs/tags/gradle-dynamic-tools-v*'
  } | awk '
    NR == 1 {
      sub("^refs/tags/gradle-dynamic-tools-v", "", $2)
      print $2
    }
  ')"
fi

if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  printf 'Could not resolve a valid Gradle Dynamic Tools release version.\n' >&2
  exit 2
fi

case "$(uname -s):$(uname -m)" in
  Darwin:arm64 | Darwin:aarch64)
    target="macos-arm64"
    ;;
  Linux:x86_64 | Linux:amd64)
    target="linux-x64"
    ;;
  *)
    printf 'No native Gradle Dynamic Tools release is available for %s/%s.\n' \
      "$(uname -s)" "$(uname -m)" >&2
    exit 2
    ;;
esac

tag="gradle-dynamic-tools-v${version}"
archive="gradle-dynamic-tools-${version}-${target}.tar.gz"
checksum="${archive}.sha256"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "${temporary_dir}"' EXIT

curl \
  --fail \
  --location \
  --silent \
  --show-error \
  --proto '=https' \
  --tlsv1.2 \
  --output "${temporary_dir}/${archive}" \
  "${release_base_url}/${tag}/${archive}"
curl \
  --fail \
  --location \
  --silent \
  --show-error \
  --proto '=https' \
  --tlsv1.2 \
  --output "${temporary_dir}/${checksum}" \
  "${release_base_url}/${tag}/${checksum}"

if command -v shasum >/dev/null 2>&1; then
  (cd "${temporary_dir}" && shasum -a 256 -c "${checksum}")
elif command -v sha256sum >/dev/null 2>&1; then
  (cd "${temporary_dir}" && sha256sum -c "${checksum}")
else
  printf 'Install shasum or sha256sum before installing Gradle Dynamic Tools.\n' >&2
  exit 2
fi

tar -xzf "${temporary_dir}/${archive}" -C "${temporary_dir}"
binary="${temporary_dir}/gradle-dynamic-tools-${version}-${target}/gradle-dynamic-tools"
if [[ ! -f "${binary}" ]]; then
  printf 'The release archive did not contain the expected native executable.\n' >&2
  exit 2
fi

install -d "${install_dir}"
install -m 0755 "${binary}" "${install_dir}/gradle-dynamic-tools"
printf 'Installed Gradle Dynamic Tools %s at %s.\n' \
  "${version}" "${install_dir}/gradle-dynamic-tools" >&2

if [[ "${install_only}" == "1" ]]; then
  exit 0
fi

if (( $# == 0 )); then
  set -- --cwd "${PWD}"
fi
if [[ -t 1 && -r /dev/tty ]]; then
  exec "${install_dir}/gradle-dynamic-tools" codex "$@" </dev/tty
fi
exec "${install_dir}/gradle-dynamic-tools" codex "$@"
