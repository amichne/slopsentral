# Catalog architecture

Slopsentral separates authored procedures, plugin composition, provider output, installed consumers, and executable evidence.
Each representation has one owner. A downstream representation cannot replace its source authority.

Use the [documentation index](../docs/index.md) to choose a guide.
Use [source ownership](../openwiki/concepts/source-ownership.md) for the linked OKF explanation.

## Owners

| Owner | Responsibility | Consumer |
| --- | --- | --- |
| `adaptable.marketplace.json` | Canonical primitive identities and paths | Graph resolver and projector |
| `plugins/*/plugin.json` | Composition through references | Provider-specific plugin output |
| `skills/` | Procedures and bundled resources | Task-selected agent context |
| `instructions/` | Shared policies | Context adapters and installed guidance |
| `hooks/` | Event contracts, effects, and adapter behavior | Native host lifecycle |
| `schemas/` | External record shapes | Parsers, validators, and generators |
| `../tools/projection/` | Provider models and no-replace publication | Generated provider trees |
| `../openwiki/` | Source-backed OKF explanations and native Claims | Readers and repository retrieval |

Software Engineering supplies the default engineering procedures.
Kotlin Engineering adds Kotlin and Gradle. IntelliJ Plugin Development adds the platform specialty.
Developer Tooling supplies CLI, schema, resource, and configuration procedures.
Repository Knowledge supplies knowledge, navigation, document, and prose procedures.
The [catalog](CATALOG.md) defines their exact composition.

## From an authored primitive to a provider

An author changes the primitive under its canonical root.
The [graph validator](../tools/validate-source-graph.mjs) resolves references and rejects conflicting identities, missing paths, cycles, and duplicate hook selection.
The [catalog generator](../tools/catalog.mjs) derives the reader catalog from the same declarations.

The [projector](../tools/project-marketplaces.mjs) captures source bytes and file modes before Pkl evaluation.
Pkl 0.32.0 evaluates the isolated provider models with explicit access limits.
The projector copies resources, seals digests, and rejects changed inputs before publication.
The [directory publisher](../tools/projection/publish_directory.py) rejects an existing destination. It never replaces that destination.

Codex and Copilot output appears on their harness branches and in the corresponding trees on `main`.
Amp output appears only on `harness/amp` during harness publication.
Pi projection produces native packages for the catalog plugins.
See the [projection guide](../docs/pkl-projection.md) for commands and provider limits.

A `RESOURCE` identifies one executable or data file.
It cannot identify a directory, symlink, skill entry point, or destination alias.
Its dependency closure contains resources only.
This lets an adapter receive executable bytes without a second discoverable procedure.
The [resource guide](../docs/workflow-resources.md) links the schemas and rejection cases.

## Guidance and runtime effects

The [engineering baseline](instructions/engineering-design.md) owns shared rules for invariant decomposition, proof preservation, effects, failures, and evidence.
Semantic Ratchet owns the design procedure. TDD owns the executable oracle and its evidence limits.
Language and platform skills own their syntax and local mechanisms.

Software Engineering composes its context and instruction-scope hooks.
Repository Knowledge composes its knowledge hooks.
Kotlin Engineering selects no hooks. Its four hook primitives remain available for explicit custom composition.
Developer Tooling and IntelliJ Plugin Development add no automatic hooks.
Source-graph, Pkl, API-context, and skill-read hooks also need explicit composition.

The host owns discovery, trust, event delivery, and context consumption.
An adapter result establishes its own output. It does not prove that a host used that output or a model obeyed it.
Each skill carries its procedure and necessary bundled references so it remains useful without context hooks.
See [instruction scope](../docs/agents-md-scope.md) and [profile lifecycle](../docs/profile-lifecycle.md).

## Installation and release state

The [Slopsentral command](../tools/slopsentral.py) coordinates explicit host and plugin selections.
Native Codex and Copilot commands own their configurations.
Amp uses managed links to release archives. Pi uses the [native setup owner](../tools/setup-pi.mts).
Edited managed content, foreign paths, and ambiguous state stop replacement.
The [installation guide](../docs/cli-install.md) describes scope and recovery limits.

`package.json` owns the shared product version.
`Validate Source` qualifies provider archives, Pi installation, and setup assets for an exact source revision.
The release publisher promotes those retained bytes after its admission gates pass.
It does not rebuild a release during publication.
Moving harness output and immutable release artifacts have separate publication owners.
The [release guide](../docs/releases.md) explains admission, credentials, and incomplete publication.

## Knowledge and executable evidence

The OKF bundle explains responsibility, flow, relationships, failures, and recovery.
OpenWiki owns its page queue, Claim identities, evidence versions, indexes, provenance, and finalization.
Source code, contracts, and executed behavior remain the authorities for system claims.
The [documentation practice](../docs/documentation.md) joins source coverage, links, stale evidence, and review.

The [catalog budget test](../tools/tests/catalog-budget.test.mjs) limits distribution size and protects the Kotlin default selection.
Graph and projection tests exercise composition and packaged bytes.
Compiler and schema fixtures exercise accepted inputs and named forbidden cases.
Those results do not measure native model quality or token savings.

The [decision cases](evals/promptfoo/cases.mts) supply independently authored expected choices.
Execution definitions need pinned task fixtures and independent host evidence.
Golden routing fixtures express expected routes. Historical records keep their original identities and evidence.
A retired route needs replay before a replacement outcome can pass.
The [eval guide](../docs/skill-evals.md) defines these distinct evidence surfaces.

The [migration map](MIGRATION.md) records previous owners and replacements.
Historical audits remain evidence of their original runs, not current qualification.
