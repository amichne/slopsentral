---
name: "primitive-routing-evaluation"
description: "Audit plugin or skill coverage against task history and activation evidence. Use for routing misses, wrong or bypassed skills, eval corpora, or trigger tuning; not ordinary application work."
---

# Primitive Routing Evaluation

Use this skill to turn routing misses into durable evaluation evidence. A
routing miss is any case where the right primitive was not loaded, the wrong
primitive was loaded, a loaded primitive was bypassed, or a provider adapter
hid the canonical local primitive.

Keep the workflow provider-neutral. Host-specific exports, logs, adapters, and
tool traces are evidence; the canonical output is a sanitized eval case tied to
the independent primitive that should own the work.

## Operating Contract

- Treat raw transcripts, session exports, tool traces, and process logs as
  immutable evidence.
- Promote only sanitized, durable examples into checked-in eval corpora.
- Keep local absolute paths, secrets, private code snippets, and full command
  output out of durable routing cases.
- Evaluate routing against the canonical primitive, not the plugin or provider
  adapter that happened to expose it.
- Preserve negative evidence. A loaded-but-bypassed primitive is a distinct
  failure from a trigger miss.
- For any persisted routing corpus, use a schema, typed parser, generated
  model, or equivalent boundary assertion before writing cases.

## Workflow

1. Identify the decision target.
   Name the primitive family, current trigger surface, expected primitive, and
   observed route. Decide whether the goal is to tighten a skill, agent, hook,
   plugin composition, or runtime adapter.

2. Collect the smallest useful evidence set.
   Prefer a user prompt plus the loaded primitives and tool sequence. Add host
   logs only when the prompt and tool trace do not explain the miss.

3. Classify the evidence.
   Use `COVERAGE_GAP` for a designed obligation with no observed model failure.
   Use a primary failure class only when the trace supports it:

   - `TRIGGER_MISS`: the expected primitive never loaded.
   - `WRONG_PRIMITIVE`: a related but incorrect primitive loaded.
   - `LOADED_BYPASSED`: the expected primitive loaded but generic tools or an
     unrelated workflow did the work.
   - `ADAPTER_DRIFT`: provider metadata routes away from the canonical local
     primitive.
   - `SCHEMA_FRICTION`: structured input or output could not pass the expected
     boundary contract.
   - `SETUP_FRICTION`: initialization or dependency state blocked the intended
     primitive before it could prove behavior.

4. Sanitize into an eval case.
   Keep the user intent realistic and concrete. Replace local paths, customer
   names, tokens, and large source snippets with neutral placeholders. Preserve
   enough shape for the route decision to remain testable.

5. Encode expected behavior.
   State the expected primitive, allowed tool families, forbidden generic
   fallbacks, required recovery behavior, and evidence that would prove the
   route improved.

6. Choose the narrowest fix surface.
   Update `SKILL.md`, agent frontmatter/body, hook metadata, plugin composition,
   or provider adapter only when that surface explains the miss. Avoid changing
   several surfaces from one eval case unless the evidence requires it.

7. Re-measure.
   Run the local routing eval command or replay harness when one exists. If no
   harness exists yet, record the eval case and the manual evidence needed to
   validate the next pass.

## Routing Case Shape

Persisted routing cases should have a schema-backed shape equivalent to:

- `type`: one of the classification values above.
- `source`: sanitized evidence source and capture date.
- `prompt`: the sanitized user request or surrounding context.
- `expectedPrimitive`: canonical primitive name and type.
- `observedRoute`: loaded primitive, adapter, or tool path that actually ran.
- `allowedActions`: tool families or primitive actions that satisfy the route.
- `forbiddenActions`: generic fallbacks or incorrect primitives to reject.
- `recoveryExpectation`: what should happen after setup or schema friction.
- `notes`: why this case should remain in the durable corpus.

Do not store this as untyped JSON. Add or reuse a schema before committing a
corpus file.

## Slopsentral Corpus

In this repository, durable cases live under `source/evals/routing/` and use
`source/schemas/evals/routing-cases.schema.json`. The source graph validator
checks that cases are sanitized, schema-linked, and point at existing canonical
primitives. The runner reports golden fixture consistency separately from field
coverage; fixtures never establish model activation or useful task outcomes:

```bash
node tools/validate-source-graph.mjs
node tools/run-routing-evals.mjs --require-all-fixtures
```

Actual runs belong in `field-observations.json`, validated by the v3 field
observation schema. Record `route` as `PRIMITIVE_ROUTE` with the primitive
actually selected, or `NO_PRIMITIVE_ROUTE` when none was selected. A `PASS`
requires the expected primitive; `DRIFT` preserves a missing or incorrect route.
Do not fill a routing miss with the expected skill to make validation pass.
Record `activationEvidence` as `TOOL_TRACE` only with session IDs and trace
references; use `REPORTED_ROUTE` for retained summaries. Record `verification`
as `COMPLETE_PROOF`, `INCOMPLETE_PROOF` with missing evidence, or
`UNASSESSED_PROOF`. A route `PASS` can still have incomplete task proof.
Record `productiveOutcomeObserved` as `USEFUL_OUTCOME`, `NO_USEFUL_OUTCOME`, or
`UNASSESSED_OUTCOME`; loading a skill cannot manufacture a useful result.
Keep runtime delivery, skill reads, useful output, workspace mutations, and token
usage separate. A correct answer does not erase a trigger miss. Retain earlier
failures alongside replays. Record model, host, and plugin revision when known;
name missing context in limitations. Attribute a skill-list cap only when the
actual advertised list or host trace proves omission; explicit-only policy,
metadata shortening, absent reads, and source inspections are different evidence.

## Source Promotion Guidance

When consolidating from repo-specific routing playbooks:

- Keep repo names and command examples only as provenance in manifests.
- Generalize from the failure class, not from one repository's directory layout.
- Preserve the handoff process: raw evidence becomes sanitized cases; cases
  drive the narrowest prompt, metadata, or adapter change; fresh runs prove the
  change.
- Do not keep dead routing fixtures for archaeology. If a fixture no longer
  proves a current case, delete it in the same source-backed cleanup that keeps
  the corpus and replay runner green.

## Completion Criteria

- The routing miss has one primary classification.
- The expected primitive and observed route are explicit.
- Durable cases are sanitized and schema-backed.
- The proposed fix surface is the narrowest one supported by evidence.
- Re-measurement evidence or the missing validation command is recorded.
