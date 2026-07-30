# Kast Measurement Runbook

## Establish identity

Discover the live commands as described by `kast-installation-diagnosis`, then
pin the workspace:

```bash
WORKSPACE_ROOT="$(pwd -P)"
KAST_PUBLIC_BIN="$(command -v kast)"
KAST_RELEASE_ROOT="$(cd "$(dirname "$KAST_PUBLIC_BIN")/.." && pwd -P)"
KAST_CONTROL_BIN="${KAST_CONTROL_BIN:-$KAST_RELEASE_ROOT/libexec/kastctl}"
KAST_MEASUREMENT_DIR="$(
  mktemp -d "${TMPDIR:-/tmp}/kast-measurement.XXXXXX"
)"

"$KAST_PUBLIC_BIN" --version
"$KAST_CONTROL_BIN" --version
"$KAST_CONTROL_BIN" --output json status \
  --workspace-root "$WORKSPACE_ROOT" \
  > "$KAST_MEASUREMENT_DIR/status-before.json"
jq -e --arg root "$WORKSPACE_ROOT" '
  .selected.ready == true and
  .selected.descriptor.workspaceRoot == $root
' "$KAST_MEASUREMENT_DIR/status-before.json"
```

If the selected descriptor has a PID, retain it and verify the process:

```bash
KAST_BACKEND_PID="$(
  jq -er '.selected.descriptor.pid' \
    "$KAST_MEASUREMENT_DIR/status-before.json"
)"
kill -0 "$KAST_BACKEND_PID"
jcmd "$KAST_BACKEND_PID" VM.command_line
```

Never use `pgrep`, the newest IDE, or a global process name to select a backend.

## Wall and graph baseline

Use one exact command and input for every sample. On macOS:

```bash
for SAMPLE_INDEX in 1 2 3; do
  /usr/bin/time -lp \
    "$KAST_PUBLIC_BIN" graph summary \
    >"$KAST_MEASUREMENT_DIR/graph-$SAMPLE_INDEX.json" \
    2>"$KAST_MEASUREMENT_DIR/graph-$SAMPLE_INDEX.time"
done
```

On GNU/Linux use `/usr/bin/time -v` instead of `-lp`. Record whether each run is
cold or warm. Public `kast graph summary` and the live operator graph summary
may also expose load time, compute time, database bytes, RSS, and bounded query
samples; inspect live help and retain their complete output.

## Kast telemetry

First save the effective config and its `configPath`:

```bash
"$KAST_CONTROL_BIN" --output json config list \
  --workspace-root "$WORKSPACE_ROOT" \
  > "$KAST_MEASUREMENT_DIR/config-before.json"
jq '{configPath, telemetry: .effective.telemetry}' \
  "$KAST_MEASUREMENT_DIR/config-before.json"
```

Inspect the TOML at `configPath` read-only to distinguish explicit workspace
keys from inherited defaults. Restore explicit keys with `config set`; restore
inherited keys with `config unset`.

Accepted telemetry scopes in the tested release are:

```text
rename,references,call-hierarchy,type-hierarchy,implementations,completions,
semantic-insertion-point,diagnostics,optimize-imports,resolve,workspace-files,
workspace-symbol-search,workspace-search,read-action,file-outline,apply-edits,
refresh
```

Unknown or empty selections fall back to all scopes, so validate the list
before enabling it. Only `basic` and `verbose` are meaningful detail values.

```bash
"$KAST_CONTROL_BIN" config set telemetry.scopes \
  'read-action,refresh,diagnostics,references' \
  --workspace-root "$WORKSPACE_ROOT"
"$KAST_CONTROL_BIN" config set telemetry.detail verbose \
  --workspace-root "$WORKSPACE_ROOT"
"$KAST_CONTROL_BIN" config set telemetry.enabled true \
  --workspace-root "$WORKSPACE_ROOT"

KAST_BACKEND_KIND="$(
  jq -er '.selected.descriptor.backendName' \
    "$KAST_MEASUREMENT_DIR/status-before.json"
)"
"$KAST_CONTROL_BIN" --output json developer runtime restart \
  --workspace-root "$WORKSPACE_ROOT" \
  --backend "$KAST_BACKEND_KIND" \
  --accept-indexing
```

Resolve the selected workspace metadata again after restart. The default JSONL
artifact is the sibling `telemetry/idea-spans.jsonl`. Capture its starting byte
offset, execute the named workload, then retain only newly appended bytes.
Verify that the file grew; enabled configuration alone is not proof.

Telemetry export appends synchronously, so measure its overhead separately and
disable it for the uninstrumented comparison.

## Structured trace

`KAST_IDEA_TRACE=1` or `-Dkast.idea.trace=true` emits structured records to the
selected process's `idea.log`.

- Pass the environment variable when launching a new headless backend.
- An already-running IDEA process needs an IDE-process restart with that
  environment or JVM property. A Kast backend restart cannot add it.
- Resolve `idea.log` from the exact verified PID, not by newest modification
  time:

```bash
KAST_IDEA_LOG="$(
  lsof -Fn -p "$KAST_BACKEND_PID" |
    sed -n 's/^n//p' |
    rg '/idea\.log$' |
    head -1
)"
test -f "$KAST_IDEA_LOG"
```

Record the initial byte offset and retain only the new segment.

## Exact-process JFR

Use JFR when CPU, allocation, lock, GC, or thread scheduling is the question.
Choose a unique recording name and bounded duration:

```bash
JFR_OUTPUT_DIR="/explicit/artifact/directory"
JFR_NAME="kast-$(date -u +%Y%m%dT%H%M%SZ)"
JFR_FILE="$JFR_OUTPUT_DIR/$JFR_NAME.jfr"

mkdir -p "$JFR_OUTPUT_DIR"
jcmd "$KAST_BACKEND_PID" JFR.check
jcmd "$KAST_BACKEND_PID" JFR.start \
  name="$JFR_NAME" \
  settings=profile \
  duration=120s \
  filename="$JFR_FILE"

# Run exactly one recorded workload here.

jcmd "$KAST_BACKEND_PID" JFR.stop \
  name="$JFR_NAME" \
  filename="$JFR_FILE"
test -s "$JFR_FILE"
```

If the bounded recording has already stopped, verify the file rather than
stopping another recording. Never stop a recording you did not name.

Useful views:

```bash
jfr view --width 220 hot-methods "$JFR_FILE"
jfr view --width 220 allocation-by-site "$JFR_FILE"
jfr view --width 220 thread-cpu-load "$JFR_FILE"
jfr view --width 220 gc-pauses "$JFR_FILE"
```

## Database and agent overhead

- Use `sqlite-readonly-navigation` for schema-aware `EXPLAIN QUERY PLAN`,
  generation-pinned snapshots, and connection-local `data_version` checks.
- Prefer live Kast graph or metrics commands when they already own the query.
- Use `codex-session-structural-analysis` when the suspected cost is repeated
  agent commands, descendant fan-out, retries, compactions, or tool wall time.

## Restore

For each of `telemetry.enabled`, `telemetry.scopes`, and `telemetry.detail`,
restore the explicit value captured from the workspace TOML, or run
`config unset` when the field was inherited. Restart the same exact backend,
then compare `config list` with
`$KAST_MEASUREMENT_DIR/config-before.json`.

Do not restore by copying an old TOML over the live configuration.
