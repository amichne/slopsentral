# Routing Evidence

Treat transcripts, exports, and tool traces as immutable evidence.
Keep only sanitized, durable cases in the corpus.
Remove secrets, private source, local absolute paths, and full command output.

## Classify the Route

Use one primary class supported by the trace:

- `COVERAGE_GAP`: a designed obligation lacks a model run.
- `TRIGGER_MISS`: the expected primitive never loaded.
- `WRONG_PRIMITIVE`: an incorrect primitive loaded.
- `LOADED_BYPASSED`: the expected primitive loaded, but another workflow did the work.
- `ADAPTER_DRIFT`: host metadata directs work away from the canonical primitive.
- `SCHEMA_FRICTION`: structured input or output fails the contract.
- `SETUP_FRICTION`: initialization or dependency state blocks the primitive.

Keep the user intent, expected primitive, actual route, allowed actions, forbidden actions, recovery behavior, and evidence source.
Select the smallest fix surface that explains the failure.
A single case does not justify edits to every router and adapter.

## Repository Corpus

Durable cases live in `source/evals/routing/`.
Their schema is `source/schemas/evals/routing-cases.schema.json`.
Use the source graph and fixture runner:

```sh
node tools/validate-source-graph.mjs
node tools/run-routing-evals.mjs --require-all-fixtures
```

Record actual runs in `field-observations.json` under the v3 field observation schema.
Keep these independent facts:

- `route`: `PRIMITIVE_ROUTE` with the actual primitive, or `NO_PRIMITIVE_ROUTE`.
- `activationEvidence`: `TOOL_TRACE` with session and trace references, or `REPORTED_ROUTE` for a kept summary.
- `verification`: `COMPLETE_PROOF`, `INCOMPLETE_PROOF` with missing evidence, or `UNASSESSED_PROOF`.
- `productiveOutcomeObserved`: `USEFUL_OUTCOME`, `NO_USEFUL_OUTCOME`, or `UNASSESSED_OUTCOME`.

A route `PASS` needs the expected primitive.
Use `DRIFT` for a missing or incorrect route.
Never replace an actual route with the expected route to pass the schema.
A correct route does not prove task completion.
Keep runtime delivery, skill reads, useful output, mutations, and token usage separate.
Keep earlier failures alongside fresh replays.
Record the model, host, and revision when known.
Name missing context as a limit.

A skill-list cap claim needs the advertised list or a host trace that proves omission.
Explicit-only policy, shortened metadata, absent reads, and source inspection prove different facts.
Delete obsolete fixtures only when their current obligation moves or ends.
Do not delete difficult cases to claim improvement.
