#!/bin/sh
# The shell owns only bootstrap downloads and the uv handoff.
set -eu
if [ "${1-}" = --help ]; then
  printf '%s\n' 'Install the uv-backed slopsentral command for macOS or Linux.' \
    'Usage: sh install.sh' \
    'Then: slopsentral install --host codex --plugin software-engineering'
  exit 0
fi
[ "$#" -eq 0 ] || { printf '%s\n' 'Usage: sh install.sh' >&2; exit 2; }
case "$(uname -s)" in Darwin|Linux) ;; *) printf '%s\n' 'Use macOS or Linux.' >&2; exit 2 ;; esac
workspace=$(mktemp -d)
trap 'rm -rf "$workspace"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
if ! command -v uv >/dev/null 2>&1; then
  curl --fail --silent --show-error --no-insecure --no-proxy-insecure --no-location-trusted --location --proto '=https' --proto-redir '=https' \
    --max-time 60 https://astral.sh/uv/0.12.9/install.sh -o "$workspace/uv-install.sh"
  UV_UNMANAGED_INSTALL="$HOME/.local/bin" sh "$workspace/uv-install.sh"
  PATH="$HOME/.local/bin:$PATH"
  export PATH
fi
release=https://github.com/amichne/slopsentral/releases/latest/download
for asset in slopsentral.py slopsentral.py.lock kotlin-horizontalization-check kotlin-horizontalization-check.lock; do
  curl --fail --silent --show-error --no-insecure --no-proxy-insecure --no-location-trusted --location --proto '=https' --proto-redir '=https' \
    --max-time 60 "$release/$asset" -o "$workspace/$asset"
done
uv run --locked --script "$workspace/slopsentral.py" self install
