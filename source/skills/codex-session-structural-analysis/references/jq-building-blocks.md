# jq Structural Building Blocks

Start with shape, not remembered field paths:

```bash
jq -r '[.type, .payload.type // "", .payload.name // ""] | @tsv' \
  "$ROOT_SESSION" |
  sort |
  uniq -c |
  sort -nr

jq -c 'keys' "$ROOT_SESSION" | sort -u
```

## Descendant session IDs

```bash
jq -r '
  select(
    .type == "event_msg" and
    .payload.type == "sub_agent_activity"
  )
  | .payload.agent_thread_id // .payload.agentThreadId // empty
' "$ROOT_SESSION" |
  sort -u
```

Use `codex_session_tree files` for recursive discovery. It searches filenames
under the explicit sessions directory, requires exactly one match per child,
and de-duplicates cycles. Historical archives can be incomplete; add
`--allow-missing` only when a partial result is acceptable, and retain its
stderr because it names every omitted child.

## Join calls to outputs in one ledger

```bash
jq -cs '
  . as $records
  | (
      reduce (
        $records[]
        | select(
            .type == "response_item" and
            (
              .payload.type == "custom_tool_call_output" or
              .payload.type == "function_call_output"
            )
          )
      ) as $item (
        {};
        .[$item.payload.call_id] = $item.payload.output
      )
    ) as $outputs
  | $records[]
  | select(
      .type == "response_item" and
      (
        .payload.type == "custom_tool_call" or
        .payload.type == "function_call"
      )
    )
  | {
      timestamp,
      callId: .payload.call_id,
      name: .payload.name,
      input: (.payload.input // .payload.arguments),
      output: $outputs[.payload.call_id]
    }
' "$ROOT_SESSION"
```

This handles the older `custom_tool_call` and newer `function_call` encodings.
The bundled script applies the same join to the root and every descendant.

## Token snapshot per session

Use the last cumulative token record from each ledger, then sum those snapshots
across sessions:

```bash
jq -s '
  [
    .[]
    | select(
        .type == "event_msg" and
        .payload.type == "token_count"
      )
    | .payload.info.total_token_usage
  ]
  | last
  | {
      input: .input_tokens,
      cached: .cached_input_tokens,
      output: .output_tokens,
      reasoning: .reasoning_output_tokens,
      total: .total_tokens
    }
' "$ROOT_SESSION"
```

Do not sum every cumulative token record within one ledger.

## Compactions and failures

```bash
jq -c '
  select(
    (.type == "event_msg" and .payload.type == "context_compacted") or
    (.type == "response_item" and
      (.payload.type | tostring | test("error|failure"; "i")))
  )
  | {timestamp, type, payloadType: .payload.type}
' "$ROOT_SESSION"
```

Inspect shape before expanding failure matching; failure schemas can change.

## General structural projections

Find every object matching a typed predicate and retain its JSON path:

```bash
jq '
  path(.. | objects | select(.kind? == "call")) as $path
  | {path: $path, value: getpath($path)}
' input.json
```

Normalize array indexes to reveal repeated structural paths:

```bash
jq -r '
  paths(scalars) as $path
  | $path
  | map(if type == "number" then "[]" else tostring end)
  | join(".")
' input.json |
  sort -u
```

Walk a conventional tree when children are nested directly:

```bash
jq '
  recurse(.children[]?)
  | select(.kind? == "call")
  | {id, name, status}
' input.json
```

For graph-shaped JSON with IDs and edges, index nodes once and join by ID
instead of repeatedly walking the whole document.
