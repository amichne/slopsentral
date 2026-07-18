#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  repo=.
elif (($# == 2)) && [[ $1 == --repo ]]; then
  repo=$2
else
  echo "usage: source-graph-valid.sh [--repo PATH]" >&2
  exit 2
fi

[[ -d $repo ]] || { echo "source-graph-valid: repository not found: $repo" >&2; exit 2; }
[[ -f $repo/source/adaptable.marketplace.json ]] || exit 0

validator=$repo/source/tools/validate-source-graph.mjs
[[ -f $validator ]] || { echo "source-graph-valid: missing $validator" >&2; exit 1; }
exec node "$validator"
