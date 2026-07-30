# Kast Operator Runbook

## Capture the live contract

Run from the target workspace:

```bash
WORKSPACE_ROOT="$(pwd -P)"
KAST_PUBLIC_BIN="$(command -v kast)"

test -n "$KAST_PUBLIC_BIN"
"$KAST_PUBLIC_BIN" --version
"$KAST_PUBLIC_BIN" --help
(cd "$WORKSPACE_ROOT" && "$KAST_PUBLIC_BIN")
```

The current public surface is intentionally compact. Do not infer private
commands from an older installed skill.

For operator-only inspection, prefer `_kastctl` when it is installed. Otherwise
derive the control binary from the active release and verify it before use:

```bash
if command -v _kastctl >/dev/null 2>&1; then
  KAST_CONTROL_BIN="$(command -v _kastctl)"
else
  KAST_RELEASE_ROOT="$(cd "$(dirname "$KAST_PUBLIC_BIN")/.." && pwd -P)"
  KAST_CONTROL_BIN="$KAST_RELEASE_ROOT/libexec/kastctl"
fi

test -x "$KAST_CONTROL_BIN"
"$KAST_CONTROL_BIN" --version
"$KAST_CONTROL_BIN" --help
```

The two versions must describe the same active release. If the derived path is
absent, stop and use the installer's current receipt or setup instructions; do
not guess another private path.

## Read-only evidence chain

Inspect each command's help first because the control surface is not public:

```bash
"$KAST_CONTROL_BIN" developer inspect paths --help
"$KAST_CONTROL_BIN" config list --help
"$KAST_CONTROL_BIN" status --help
"$KAST_CONTROL_BIN" ready --help

"$KAST_CONTROL_BIN" --output json developer inspect paths
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
