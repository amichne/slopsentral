# Kast Operator Runbook

## Capture the live contract

Run from the target workspace:

```bash
WORKSPACE_ROOT="$(pwd -P)"
KAST_PUBLIC_PATH="$(command -v kast)"

resolve_executable() {
  local executable_path="$1"
  local executable_dir
  local link_target
  local symlink_hops=0

  while test -L "$executable_path"; do
    symlink_hops=$((symlink_hops + 1))
    test "$symlink_hops" -le 40 || return 1
    executable_dir="$(cd "$(dirname "$executable_path")" && pwd -P)"
    link_target="$(readlink "$executable_path")"
    case "$link_target" in
      /*) executable_path="$link_target" ;;
      *) executable_path="$executable_dir/$link_target" ;;
    esac
  done
  executable_dir="$(cd "$(dirname "$executable_path")" && pwd -P)"
  printf '%s/%s\n' "$executable_dir" "$(basename "$executable_path")"
}

test -n "$KAST_PUBLIC_PATH"
KAST_PUBLIC_BIN="$(resolve_executable "$KAST_PUBLIC_PATH")"
KAST_RELEASE_ROOT="$(cd "$(dirname "$KAST_PUBLIC_BIN")/.." && pwd -P)"
KAST_RECEIPT="$KAST_RELEASE_ROOT/receipt.json"
test -f "$KAST_RECEIPT"
KAST_CONTROL_BIN="${KAST_CONTROL_BIN:-$(
  jq -er '.entrypoints.activeBinary' "$KAST_RECEIPT"
)}"
KAST_CONTROL_BIN="$(resolve_executable "$KAST_CONTROL_BIN")"

test -x "$KAST_PUBLIC_BIN"
test -x "$KAST_CONTROL_BIN"
KAST_PUBLIC_VERSION="$("$KAST_PUBLIC_BIN" --version | awk '{print $NF}')"
KAST_CONTROL_VERSION="$("$KAST_CONTROL_BIN" --version | awk '{print $NF}')"
test "$KAST_PUBLIC_VERSION" = "$KAST_CONTROL_VERSION"
"$KAST_PUBLIC_BIN" --help
"$KAST_CONTROL_BIN" --help
```

The current public surface is intentionally compact. Do not infer private
commands from an older installed skill.

Inspect the active receipt and existing install paths without resolving a
workspace:

```bash
jq '{
  tool,
  version,
  profile,
  roots,
  entrypoints,
  components,
  schemaVersion
}' "$KAST_RECEIPT"
"$KAST_CONTROL_BIN" --output json developer inspect paths
KAST_DATA_ROOT="$(jq -er '.roots.data' "$KAST_RECEIPT")"
if test -d "$KAST_DATA_ROOT/workspaces"; then
  rg --files "$KAST_DATA_ROOT/workspaces" -g 'workspace.json'
fi
```

If the receipt or version comparison fails, stop and use the installer's
current setup instructions; do not guess another private path or prefer an
unverified legacy `_kastctl`.

## Workspace reconciliation evidence chain

The root-bound resolver may atomically migrate legacy workspace state. Run this
chain only when the task authorizes supported workspace reconciliation or
repair. First retain the passive receipt and metadata evidence above, then
inspect each command's live help:

```bash
"$KAST_CONTROL_BIN" config list --help
"$KAST_CONTROL_BIN" status --help
"$KAST_CONTROL_BIN" ready --help

(cd "$WORKSPACE_ROOT" && "$KAST_PUBLIC_BIN")
"$KAST_CONTROL_BIN" --output json config list \
  --workspace-root "$WORKSPACE_ROOT"
"$KAST_CONTROL_BIN" --output json status \
  --workspace-root "$WORKSPACE_ROOT"
"$KAST_CONTROL_BIN" --output json ready \
  --workspace-root "$WORKSPACE_ROOT" \
  --for kotlin
```

Preserve nonzero JSON or TOON responses. They often carry the typed cause,
exact selected backend, source path, and supported `next` action.

Classify the first broken layer:

1. `command -v` or version: executable selection or install authority.
2. Install paths or receipt mismatch: release activation/setup.
3. Missing or wrong exact-root metadata: workspace preparation.
4. Selected backend missing, stale, or incompatible: IDEA/headless lifecycle.
5. Backend servable but indexing: indexing admission or refresh.
6. Ready but query fails: semantic capability or query contract.

Do not skip a failed layer because a later process happens to be alive.

## Supported repairs

Before mutating, run help for the proposed owner and save the relevant
before-state JSON.

- Use the public `kast up` or installer/setup command returned by the live
  failure for install and workspace preparation.
- Use live `config set` or `config unset` only for fields listed by
  `config list`.
- Use the live lifecycle command for the already-selected backend. Pin the
  exact workspace and backend; do not select a PID or IDE by recency.
- Use public `kast refresh` only when readiness and the task require fresh
  semantic state.

Never repair a comparison by rewriting installer-owned metadata. Never delete a
socket or database to force progress.

After repair:

```bash
"$KAST_CONTROL_BIN" --output json ready \
  --workspace-root "$WORKSPACE_ROOT" \
  --for kotlin
(cd "$WORKSPACE_ROOT" && "$KAST_PUBLIC_BIN" graph summary)
```

A graph with zero nodes is not semantic-success evidence for a nonempty Kotlin
workspace.

## Debug handoff

Use `kast-performance-assessment` when the install is ready but behavior is
slow, intermittent, or needs telemetry. That skill distinguishes implemented
telemetry and external JFR from configuration fields that do not produce an
artifact.
