# Implementation Guidance

Use this reference when writing hook scripts.

## Design Rules

- Keep scripts deterministic and repo-root aware.
- Accept explicit arguments for repo path, changed files, or output format when
  practical.
- Read provider event payloads from stdin only at the edge.
- Prefer structured JSON output for machine-read checks.
- Make failure messages actionable.
- Add persistent state only when the event contract requires it. A passive
  context hook should read its bundled policy without writing to the repository
  or claiming that previously emitted output was loaded.
- For plugin-owned state, use the host's writable `PLUGIN_DATA` capability;
  use repository-local state only when the consuming repository opts into it.
- Avoid destructive writes unless the hook's contract explicitly requires them.

## Portability

- For shell hooks, use Bash patterns compatible with the target macOS/Linux
  environments. Avoid brittle empty-array expansion under `set -u`.
- For Python hooks, prefer the standard library unless a dependency is already
  part of the repo contract.
- For Node hooks, keep module format consistent with nearby scripts.

## Failure Policy

- Advisory hooks should report findings without blocking unless the metadata or
  adapter makes blocking behavior explicit.
- Blocking hooks should fail only on evidence-backed violations.
- If required tools are missing, report the missing tool and exit according to
  the hook's enforcement level.

## Verification

Run the hook script directly with a minimal representative command. Examples:

```sh
python3 hooks/kotlin-horizontalization-check --repo . --format json
printf '%s' '{"hook_event_name":"SessionStart","source":"startup","session_id":"fixture"}' \
  | PLUGIN_ROOT="$(pwd)" python3 hooks/inject-instruction-context.py --instruction kotlin-engineering
```
