# Shell Review Patterns

## Review Checklist

- Does the script fail on unset required input?
- Are all path and argument expansions quoted?
- Are command arguments stored in arrays instead of concatenated strings?
- Are destructive commands guarded by dry-run, confirmation, or force?
- Are temporary files cleaned up on success and failure?
- Does error output go to stderr?
- Does CI or hook usage have a deterministic validation command?
- Is shared CI logic in a reusable script rather than copied across workflow
  YAML?
- If JSON, YAML, TOML, or another structured format is written, does a schema or
  parser validate it?

## Common Patterns

Use these patterns as starting points, then adapt to the target shell:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  printf 'Usage: %s --input PATH [--dry-run]\n' "${0##*/}" >&2
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT
```

For file walks:

```bash
while IFS= read -r -d '' file; do
  printf 'checking %s\n' "$file"
done < <(find "$root" -type f -print0)
```

For command invocation:

```bash
args=(--check --format json)
[[ "${verbose:-false}" == "true" ]] && args+=(--verbose)
tool "${args[@]}" -- "$target"
```
