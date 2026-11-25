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
set -- slopsentral.py slopsentral.py.lock kotlin-horizontalization-check kotlin-horizontalization-check.lock session_audit.py audit_history.py
use_curl=true
if command -v gh >/dev/null 2>&1; then
  # uv supplies the command's Python on both supported platforms.
  if GH_PROMPT_DISABLED=1 GH_NO_UPDATE_NOTIFIER=1 uv run --no-project --python '>=3.12,<3.14' python -I -c '
import subprocess, sys
directory, *assets = sys.argv[1:]
args = ["gh", "release", "download", "--repo", "github.com/amichne/slopsentral", "--dir", directory]
for asset in assets:
    args.extend(["--pattern", asset])
try:
    status = subprocess.run(args, stdin=subprocess.DEVNULL, timeout=65).returncode
except subprocess.TimeoutExpired:
    sys.exit("gh release download exceeded 65 seconds.")
sys.exit(status)
' "$workspace" "$@"; then
    use_curl=false
  else
    status=$?
    [ "$status" -eq 4 ] || exit "$status"
    printf '%s\n' 'GitHub CLI needs a login. Using curl for the public release.' >&2
  fi
fi
if [ "$use_curl" = true ]; then
  release=https://github.com/amichne/slopsentral/releases/latest/download
  for asset do
    curl --fail --silent --show-error --no-insecure --no-proxy-insecure --no-location-trusted --location --proto '=https' --proto-redir '=https' \
      --retry 2 --retry-max-time 30 --max-time 60 "$release/$asset" -o "$workspace/$asset"
  done
fi
for asset do
  [ -s "$workspace/$asset" ] || { printf 'Missing release asset: %s\n' "$asset" >&2; exit 1; }
done
uv run --locked --script "$workspace/slopsentral.py" self install
