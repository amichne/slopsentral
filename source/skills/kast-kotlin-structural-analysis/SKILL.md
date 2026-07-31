---
name: "kast-kotlin-structural-analysis"
description: "Analyze complex Kotlin structure through the public root command surface in Kast 0.20.2 or later. Use when a question needs chained exact-symbol relationships or symbol, package, and module graph projections; not for one routine lookup, source changes, session logs, or non-Kotlin graphs."
---

# Analyze Kotlin Structure with Kast

Use Kast as the semantic authority. This skill targets the public root command
surface in Kast 0.20.2 or later. Use Kast directly for one routine lookup.

## Workflow

1. Start in the intended Gradle workspace. The current directory selects the
   workspace.
2. Run `kast --version`, `kast --help`, and `kast graph topology --help`.
   Require a tagged version of 0.20.2 or later. Require `--scope` with
   `symbol`, `package`, and `module`.
3. Run `kast` with no arguments. Require the returned `root` to match the
   intended workspace. Continue only with `ready: true`, `runtime: READY`, and
   `referenceIndexReady: true`.
4. If the workspace is not ready, stop. Use `kast-installation-diagnosis`.
   Run `kast up` only with explicit authority because it can start runtime and
   indexing work.
5. Run `kast files [PATTERN]` when the source path is not known.
6. Run `kast symbol find <QUERY>`. Select one exact fully qualified name or
   signature. Do not select by a short name when the result is ambiguous.
7. Run `kast symbol show <EXACT_SYMBOL>`. Preserve the returned
   `selectorHandle`, kind, and source location. Use the handle for relationship
   and impact commands.
8. Choose the smallest relationship or graph command that answers the
   question. Set graph projection scope explicitly. Use the runbook for stable
   command chains.
9. If a result has `nextPage`, repeat the same command with that value. Do not
   infer a complete result while a continuation remains.
10. Report the exact workspace, symbol identity, coverage, qualification,
   limitations, cardinality, and continuation state.

Do not add a wrapper script. Kast already owns workspace selection, symbol
identity, pagination, graph generation, and evidence qualification.

## Evidence Rules

- An empty result is a complete negative answer only when cardinality is
  `EXACT`, coverage is `COMPLETE`, limitations are empty, `truncated` is
  `false`, and `nextPage` is absent.
- A qualified graph result can contain useful facts. State its limits.
- A failed or stale continuation is not partial proof. Restart the same query.
- Do not replace compiler-backed evidence with text search or another graph
  provider.
- Do not run `kast refresh [PATH...]` during snapshot analysis. It changes
  persisted evidence.

## Reference Routing

Read [structural-query-runbook.md](references/structural-query-runbook.md) for
call flow, type structure, topology, and impact command chains.

## Completion Criteria

- The command ran from the exact Gradle workspace.
- One exact symbol identity anchors each symbol-level result.
- All required pages were consumed or reported.
- Coverage limits remain visible in the answer.
- No source file changed during structural analysis.

## Provenance

This local skill is based on the public Kast 0.20.2 command contract. It narrows
that contract to Kotlin structural analysis.
