# Documentation evidence evaluation

## Baseline and scope

Baseline: `amichne/slopsentral` at
`e1629c82c50d650c05e273b6f886d0b72f5065de`, reviewed 16 October 2026.
These are candidate cases and a recorded guidance assessment. They are not
model runs, observed routing, or measured task success.
Use the same [synthetic input](files/documentation-evidence/context.md) for both
revisions. The runnable scenario definitions extend the existing
[Repository Knowledge benchmark](plugin-benchmarks/repository-knowledge.json).
Keep raw replay output outside packaged skills. No paid inference runs in normal gates.

The Kast documentation task motivated the cases. Its export had 59 numbered
pages but one Mermaid source. A live pass recovered 173 sources: 161 rendered
and 12 failed to parse across six pages. These historical counts establish the
failure shape. They are not universal skill rules or verified architecture.

## Cases and decisive review assertions

Review each assertion independently against the output and fixture. Retain a
failure or missing evidence; do not award success from polished prose.

| Case | Requested output | Validator and expected result |
| --- | --- | --- |
| `docs-export-completeness` | Audit the export before migrating it. | Compare page ID sets and diagram ID sets separately. Pages match 3/3; `limits-1` is missing. Distinguish recovery, rendering, and claim verification. |
| `docs-source-revision` | Refresh the stale source claim. | Compare `aaaaaaaa` with `bbbbbbbb` and inspect the supplied diff. Name the current registry and default 60. Preserve the old snapshot as history. Do not assert runtime readiness. |
| `docs-fact-ownership` | Place the default, mechanism, and procedure. | Assign exact defaults to the registry/generated Reference, completion to Architecture, steps to Guides. Change the generator's source and cross-link; do not patch generated output alone. |
| `docs-supported-primitive` | Repair the MDX proposal. | Reject the third-party npm import under the supplied hosted constraint. Use supported components or a build-time asset. Keep the caveat visible and verify the current component API. |
| `docs-diagram-fidelity` | Recover and prepare both diagrams. | Compare original bytes; keep the four nodes and both Check outcomes. Preserve the rejected source and separate syntax repair from semantic edits. Count the parse failure and identify its page. |
| `docs-rendering-gap` | Assess the supplied checks. | Build/XML success cannot close the empty mobile panel, external font, or stuck menu. Record clipboard LF, missing keyboard evidence, and exact viewport/theme. Require a new rendered observation after repair. |
| `docs-compact-first-result` | Write one bounded guide. | Read only the guide as a newcomer. It gives prerequisites, `demo` query, expected signature/location, callers, partial-result limit and narrower retry, plus contract/mechanism links. No invented setup steps or site redesign. |

Nearest non-trigger: rewrite one README sentence without changing meaning.
Use controlled-technical-writing. Do not inventory exports, redesign navigation,
or generate a knowledge store for that request. The existing benchmark retains
`prose-only-edit-keeps-validation-skills-idle`.

## Before the guidance change

- `technical-documentation` already selects reader actions, generated owners,
  source-backed diagrams, a site build, and separate comprehension evidence.
  Its page structures distinguish procedures, concepts, and Reference.
- `code-knowledge-base` already preserves inputs, maps source items to concepts,
  separates backend ownership, and warns that counts do not prove semantics.
- Neither explicitly reconciles page and diagram inventories, binds exports
  and claims to source revisions, or preserves diagram originals through repair.
- The site workflow does not route to mentor-site comparison, hosted component
  constraints, screenshot inspection, clipboard bytes, or repeated navigation.
- The compact-task case is a preservation check: the existing focused-document
  behavior must survive the extra references.

## Ownership of the improvements

Skill guidance owns discovery, decisions, evidence limits, and when to inspect
rendered output. Optional references carry the export, diagram, and site details.
The existing graph, routing, assessment, and projector tools own deterministic
checks. The fixture and benchmark own regression inputs and review assertions.
Do not add a universal site validator: supported syntax, renderer versions, and
generators differ by repository.

Repository-local knowledge owns actual revisions, recovered assets, claim maps,
mentor URLs and observations, source paths, commands, and screenshot receipts.
Do not copy volatile Kast implementation facts into universal guidance.

## Comparison procedure

1. Pin baseline and candidate commits, fixture bytes, model settings, and tools.
2. Give each revision the same case prompt and input. Preserve both outputs.
3. Apply the table's assertions to source, output, command logs, and screenshots.
4. Report each case as satisfied, failed, or unverified with its evidence.
5. Keep structural checks, guidance coverage, model behavior, and human reader
   evidence separate. Never treat golden fixture consistency as a model replay.

Before publication, run the source graph, benchmark schema checks, routing
fixtures, local prose assessment, and supported projections. Record commands,
results, candidate guidance locations, and any unavailable renderer or replay.
