# Kotlin Structural Query Runbook

Run all commands from the same exact Gradle workspace.

## Establish the evidence boundary

```bash
cd "$KOTLIN_WORKSPACE"
kast --version
kast --help
kast graph topology --help
kast
```

Require the `symbol`, `package`, and `module` scope values. Stop if they are
absent. Require the returned `root` to match the intended workspace. Continue
only with `ready: true`, `runtime: READY`, and `referenceIndexReady: true`.

If readiness work is authorized, run it separately:

```bash
kast up
kast
```

`kast up` can start runtime and indexing work. Do not run it during passive
inspection without explicit authority.

## Resolve one stable identity

```bash
kast files "$SOURCE_PATTERN"
kast symbol find "$SYMBOL_QUERY"
SYMBOL="<selectorHandle-or-exact-symbol>"
kast symbol show "$SYMBOL"
```

Use the returned `selectorHandle` when available. Do not rebuild identity from
a short name.

## Project incoming and outgoing call structure

```bash
kast symbol refs "$SYMBOL"
kast symbol callers "$SYMBOL"
kast symbol callees "$SYMBOL"
```

Use references for occurrence locations. Use callers for incoming flow. Use
callees for outgoing flow.

## Trace a bounded reverse call chain

Resolve one returned caller before you query the next hop:

```bash
kast symbol callers "$SYMBOL"
CALLER_QUERY="<exact-returned-caller>"
kast symbol show "$CALLER_QUERY"
CALLER="<returned-selectorHandle>"
kast symbol callers "$CALLER"
```

Repeat only for callers that can answer the question. Record each hop and its
coverage. Do not turn this chain into an unbounded repository crawl.

## Project type structure

```bash
kast symbol implementations "$SYMBOL"
kast symbol supertypes "$SYMBOL"
kast symbol subtypes "$SYMBOL"
```

Use implementations for an interface or abstract declaration. Use supertypes
and subtypes for a bounded, coverage-qualified inheritance boundary.

## Project graph structure

```bash
kast graph summary --scope module
kast graph summary --scope package
kast graph summary --scope symbol
kast graph topology --scope module
kast graph topology --scope package
kast graph topology --scope symbol
kast graph communities --scope module
kast graph communities --scope package
kast graph communities --scope symbol
kast graph nodes
GRAPH_SYMBOL="<stableKey-from-graph-nodes>"
kast graph neighbors "$GRAPH_SYMBOL"
```

Start with module scope. Narrow to package scope, then symbol scope. Use summary
before a broad graph claim. Use topology for global shape. Use communities for
deterministic clusters. Use the returned `stableKey` for one local symbol
neighborhood.

## Project bounded change impact

```bash
kast graph impact "$SYMBOL"
```

Impact is bounded. Report its cardinality, coverage, and continuation state.
Do not describe a truncated result as the full change surface.

## Continue one result

Set the exact opaque value returned as `nextPage`, then repeat the same command:

```bash
NEXT_PAGE="<nextPage>"
kast symbol callers "$SYMBOL" --page "$NEXT_PAGE"
kast graph nodes --page "$NEXT_PAGE"
kast graph impact "$SYMBOL" --page "$NEXT_PAGE"
```

Do not reuse a continuation for another symbol, operation, workspace, or graph
generation. If Kast rejects it, restart the original unpaged command.

## Report

Record these fields:

- exact workspace;
- exact symbol identity and source location;
- command and query;
- returned and total cardinality when available;
- coverage and qualification;
- limitations;
- truncation and remaining continuation.

State absence only when cardinality is `EXACT`, coverage is `COMPLETE`,
limitations are empty, `truncated` is `false`, and `nextPage` is absent.
