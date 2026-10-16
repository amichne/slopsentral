# Documentation evidence evaluation

## Baseline and scope

Baseline: `amichne/slopsentral` at
`e1629c82c50d650c05e273b6f886d0b72f5065de`, reviewed 16 October 2026.
These are candidate cases and a recorded guidance assessment. They are not
model runs, observed routing, or measured task success.
Use the same [synthetic input](files/documentation-evidence/context.md) for both
revisions. The runnable scenario definitions extend the existing
[Repository Knowledge benchmark](plugin-benchmarks/repository-knowledge.json).
Each new scenario embeds its needed evidence and concrete review assertions.
The disposable workspace needs no authored eval files or manual fixture copy.
The [old registry](files/documentation-evidence/aaaaaaaa/command-registry.json)
and [current registry](files/documentation-evidence/bbbbbbbb/command-registry.json)
are independently inspectable source artifacts. Their diff is included in the
revision case; tests compare its hunk with the actual artifact diff.
Keep raw replay output outside packaged skills. No paid inference runs in normal gates.

## Existing owners

Slopsentral's authored `source/skills` owns these procedures. Its checked-in
`.agents/plugins` and `.github/plugin` trees are projector output. Installed
plugin caches are consumers. The Kast checkout inspected at `e1445ca5` has a
marketplace reference under `.agents`, not a competing local documentation skill.
That setup reference retains older plugin identities and hook descriptions;
current Slopsentral source and manifests own this change. It was not edited.

Technical Documentation owns structure, sites, and diagrams. Code Knowledge
Base owns imported knowledge evidence and backend handoff. Controlled Technical
Writing keeps prose rules and assessment. The existing Mintlify skill supplies
framework details. This boundary avoids another documentation or renderer skill.

The Kast documentation task motivated the cases. Its export had 59 numbered
pages but one Mermaid source. A live pass recovered 173 sources: 161 rendered
and 12 failed to parse across six pages. These historical counts establish the
failure shape. They are not universal skill rules or verified architecture.

## Cases and decisive review assertions

Review each assertion independently against the output and fixture. Keep a
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

## Candidate guidance assessment

This source review applies the same seven assertions to the changed guidance.
It establishes explicit coverage, not model compliance or a successful replay.

| Cases | Candidate procedure | Coverage result |
| --- | --- | --- |
| Export completeness; source revision | Code Knowledge Base: [source evidence](../skills/code-knowledge-base/references/source-evidence.md) | Separate page/asset inventories, revision comparison, claim verification, and unresolved IDs are explicit. |
| Fact ownership; compact first result | Technical Documentation: [site reader path](../skills/technical-documentation/references/documentation-sites.md#reader-path-and-fact-ownership) | Canonical roles, linked facts, prerequisites, expected results, limits, and recovery are explicit. Small prose edits keep their scope. |
| Unsupported primitive | Technical Documentation: [framework support](../skills/technical-documentation/references/documentation-sites.md#confirm-framework-support) | Current official API checks and hosted npm restrictions precede component use. Asset builds remain separate. |
| Diagram fidelity | Technical Documentation: [diagrams](../skills/technical-documentation/references/diagrams.md) | Exact originals, separate repair types, branch preservation, failure identities, and embedded inspection are explicit. |
| Rendering gap | Technical Documentation: [rendered checks](../skills/technical-documentation/references/documentation-sites.md#check-the-rendered-result) | Actual screenshot inspection, hydration, clipboard bytes, keyboard access, repeated navigation, themes, and evidence limits are explicit. |

The two existing skill owners remain. No new skills, hooks, glossary APIs,
runtime installation, or changes to controlled-technical-writing are needed.
No new general-purpose script is justified by these cases. Existing validators
cover formats and projections; site-specific inventories and browser checks
remain under their repository's tooling owner.

## Implementation checkpoint

The parallel Kast task reported [draft PR 1051](https://github.com/amichne/kast/pull/1051),
branch `docs/guides-architecture-reference`, from base `3ffe57068`.
Its later reported candidate is `71eeb11f60488bfd8b34a029e51e62dcdc8fe785`.
Its trace on 16 October 2026 reports three mentors: uv First steps, Temporal
Workflow Execution, and Stripe Authentication. Public text from those pages and
the official Mintlify component constraints was also read for this change.
That text review does not establish a visual review of the mentor sites here.

The implementation trace reports three concrete failures. JSX-wrapped Prompt
text copied braces and quotes. The dark accent lacked contrast. Diagram SVGs
imported an external Google font. It reports mobile menu, Back/Forward, clipboard, and
320 px diagram checks after repairs. These are attributed observations from
the docs task, not independent browser checks or a replay of these skill cases.
They informed the clipboard, hydration, theme, and embedded-asset procedures.
That task later reports keyboard scrolling in the phone diagram region and
reflow without page overflow at actual 200% browser zoom. These remain
attributed observations, separate from measured behavior on the skill cases.

## Static evaluation limits

Plugin Eval's local analyzer was run on both baseline skills and candidates.
The baseline active estimates were 883 tokens for Technical Documentation and
759 for Code Knowledge Base. Initial candidate estimates were 1,059 and 835.
Both trigger warnings cleared. Technical Documentation gained a deferred-budget
warning as optional site and diagram procedures grew. Code Knowledge Base kept
its pre-existing deferred-budget error and Python complexity warnings.
No helper implementation changed. These structural signals do not measure
task success, routing, actual token usage, or reader comprehension.

The seven new cases remain candidates. A fresh model comparison and independent
human reader assessment have not run. Normal validation performs no paid inference.

## Codex review follow-up

The [Codex review of `cc1a429`](https://github.com/amichne/slopsentral/pull/79#pullrequestreview-5548835181)
found two P2 defects in the evaluation setup:
[missing workspace inputs](https://github.com/amichne/slopsentral/pull/79#discussion_r4295476191)
and [missing revision artifacts](https://github.com/amichne/slopsentral/pull/79#discussion_r4295476202).
Both were valid. The scenarios previously depended on files outside the
provisioned workspace and narrated a default change without supplying its source.

Two focused tests failed on those exact gaps before repair. All seven cases now
carry their relevant evidence and review assertions. The revision case contains
both registry snapshots and their actual diff. Both new tests pass in the same
test command. They prove fixture delivery and consistency, not model behavior.
The existing three benchmark-contract checks also pass.

## Validation record

- Source graph and generated catalog checks passed.
- All 60 existing golden routing fixtures remain consistent. Field coverage
  remains 10/60; one drift and six incomplete proofs remain visible.
- The focused contract suite passed 61 tests with no skips. It covers native
  Pkl determinism, source bytes, modes, digests, benchmark definitions, catalog
  ownership, current-source routing, and honest field-evidence reporting.
- Codex, GitHub Copilot, and Pi projection completed with Pkl 0.32.0.
  Pi TypeScript checks passed. Both checked-in provider trees were regenerated
  from the supported projector output; installed caches were not changed.
  All 60 files in the two skills match authored bytes and modes in each harness.
- Seventeen more projection and native-host checks passed in the sandbox.
  The Pi session-shutdown check failed at `fs.watch` with macOS `EMFILE`.
  The isolated check passed outside the filesystem sandbox with model networking
  disabled. No production or test source changed for that environment failure.
- The shared prose assessment ran over all nine changed Markdown artifacts.
  Its remaining Grade advisories are at line 1 of both skill entry points,
  the five changed skill references, and this evaluation record. Technical
  vocabulary and precise evidence limits remain. Raw reports are local run
  artifacts; `ASSESSED` is not a clean prose or comprehension result.
