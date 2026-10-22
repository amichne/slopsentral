# Catalog architecture

Five plugins compose 28 canonical skills. Each skill owns one procedure and routes specialized details to local references.
A plugin groups related procedures for installation. It does not grant authority or duplicate their implementation.

## Owners

| Owner | Responsibility |
| --- | --- |
| Software Engineering | Shared invariants, proof, scoped execution, uv Python, Git, PRs, and CI |
| Kotlin Engineering | Kotlin syntax, constrained values, closed outcomes, review, compiler proof, and Gradle |
| IntelliJ Plugin Development | Delivery, PSI/indexing, platform tests, and live diagnostics |
| Developer Tooling | Tools, agent resources, JSON Schema, OpenAPI, Pkl, and explicit personal configuration |
| Repository Knowledge | Source-backed knowledge, navigation, technical documents, and prose assessment |

Software Engineering remains the single default.
Kotlin profiles add Kotlin Engineering. IntelliJ profiles add the IntelliJ specialty.
Python Tooling has one source and appears in Software Engineering and Developer Tooling.
All other current skills appear in one bundle.

## Proof and scope

`instructions/engineering-design.md` owns the shared engineering policy.
Semantic Ratchet owns proof preservation and API design.
TDD owns the executable oracle, planning-only mode, scope, and bounded delegation.
Planning alone grants no execution authority.

Kotlin Design Practices combines API ownership, branches, and cross-module implementation.
Kotlin Review remains read-only unless the user authorizes a repair.
Negative Capability Proof keeps compiler-backed rejection separate from ordinary review.
Gradle Validation needs explicit user selection. Necessary Gradle commands do not need that skill.
Gradle Performance Engineering owns measured build experiments.

Python Tooling owns uv, PEP 723, locks, strict Pyright, Ruff, and pytest guidance.
Pure decisions receive explicit effect results. Process adapters use argument arrays and preserve finite failure outcomes.
Shell remains limited to host launchers and parent-owned session state.
Older Python modules keep their focused tests. Only the explicit static-analysis scope carries strict Pyright and Ruff evidence.

## Graph and projection

`adaptable.marketplace.json` declares canonical identities.
`plugins/*/plugin.json` composes references to those identities.
`catalog.mjs` resolves dependencies and produces `CATALOG.md`.
The graph rejects conflicting identities, missing paths, dependency cycles, and duplicate hook selection in a profile.

Pkl modules under `tools/projection` own provider shapes.
`tools/project-marketplaces.mjs` freezes inputs, copies resources, seals digests, and stages output.
Provider output and installed caches remain consumers. Never edit them as source.

A `RESOURCE` names one executable or data file. It cannot name a directory, symlink, `SKILL.md`, or destination alias.
Resources carry no skill discovery entry. Their dependencies can reference only resources.
A runtime resource does not need its entire authoring workflow.
Focused fixtures keep the runtime-only projection contract under test after the policy-only plugins retire.

## Hooks and explicit effects

Software Engineering composes its context and instruction-scope hooks.
Kotlin Engineering selects no hooks. Its skills contain the Kotlin guidance.
The Kotlin context, layout, Gradle, and wrapper hooks remain standalone primitives for explicit composition.
Repository Knowledge keeps its bounded knowledge hooks.
Developer Tooling and IntelliJ Plugin Development add no automatic hooks.

Source-graph, Pkl, API-context, and required-skill-read hooks remain standalone canonical primitives.
No shipped plugin composes those hooks.
A custom repository composition can select them explicitly under the same graph rules.
The source and projection tests exercise their contracts with disposable fixtures.

Hook output proves an adapter result. It does not prove host consumption, model behavior, or user authorization.
The host owns plugin selection, trust, hook discovery, and context consumption.
Skills keep their own rules and resources so they remain useful without context hooks.

## Evidence and migration

The uv foundation at `774716ce2cdee28133d463ae865f4c67bef68fb4` contains 11 plugins and 61 marketplace skills.
This catalog contains five plugins and 28 skills.
The test in `tools/tests/catalog-budget.test.mjs` enforces at most five plugins and 30 skills.
It also rejects hidden skill entry points and protects the Kotlin default selection.
These are distribution counts. They do not measure tokens, latency, or model quality.

The [migration map](MIGRATION.md) records merges and removals.
Unique executable assets and proof cases move to their surviving owner.
Unrelated frontend, payment, host-migration, and duplicate generic workflows leave the distribution.
Git history preserves the previous source.

Golden routing fixtures describe expected routes after consolidation.
Historical field records preserve original route names and evidence.
A retired route receives `NEEDS_REPLAY_CASE` status without a fabricated replacement success.
Native host consumption and live model outcomes need separate evidence.
