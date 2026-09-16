# Catalog

Generated from canonical manifests by `node tools/catalog.mjs --write`.
For code work, start with Software Engineering and add only the specialties your task needs.
Keep that selection for the repository. Describe the outcome; the agent selects relevant skills within the installed plugins.
Installing a plugin makes its capabilities available; it does not require every skill to run or authorize publication.

For documentation alone, choose Technical Writing. Repository Knowledge is optional artifact generation.
Profiles provide repeatable setup selections. See [migration](MIGRATION.md) before replacing older installations.

## Start here

### software-engineering

Implement, test, review, and deliver code with Git, PR, and CI workflows.

Start here for everyday code changes, debugging, tests, Git, issues, pull requests, and CI. Publication follows the requested end state.

Outside this plugin: Language-specific design, building CLI products, knowledge generation, and documentation production.

**Skills:** [bounded-delegation](skills/bounded-delegation/SKILL.md), [cli-data-pipelines](skills/cli-data-pipelines/SKILL.md), [define-goal](skills/define-goal/SKILL.md), [delivery-pipeline-design](skills/delivery-pipeline-design/SKILL.md), [git-change-flow](skills/git-change-flow/SKILL.md), [github-ci-operations](skills/github-ci-operations/SKILL.md), [issue-tracker-operations](skills/issue-tracker-operations/SKILL.md), [mise-project-tooling](skills/mise-project-tooling/SKILL.md), [pull-request-lifecycle](skills/pull-request-lifecycle/SKILL.md), [repository-onboarding](skills/repository-onboarding/SKILL.md), [semantic-ratchet](skills/semantic-ratchet/SKILL.md), [shell-script-safety](skills/shell-script-safety/SKILL.md), [tdd](skills/tdd/SKILL.md).

**Hooks:** [agents-md-turn-refresh](hooks/agents-md-turn-refresh.hook.json), [repository-profile](hooks/repository-profile.hook.json).

**Instructions:** [agent-execution](instructions/agent-execution.md), [engineering-design](instructions/engineering-design.md).

## Specialties

### agent-tooling

Create and improve skills, agents, hooks, plugins, and repository instructions.

Choose when authoring reusable agent tooling, plugin compositions, routing evaluations, or repository instruction topology.

Outside this plugin: Application implementation, user documentation, and automatic marketplace publication.

**Skills:** [agent-profile-authoring](skills/agent-profile-authoring/SKILL.md), [hook-primitive-authoring](skills/hook-primitive-authoring/SKILL.md), [plugin-composition-authoring](skills/plugin-composition-authoring/SKILL.md), [primitive-routing-evaluation](skills/primitive-routing-evaluation/SKILL.md), [repo-instruction-topology](skills/repo-instruction-topology/SKILL.md), [skill-primitive-authoring](skills/skill-primitive-authoring/SKILL.md).

**Hooks:** [source-graph-valid](hooks/source-graph-valid.hook.json).

### api-contracts

Author and review OpenAPI specifications and JSON Schema contracts.

Choose for OpenAPI and JSON Schema models, operations, examples, compatibility, and contract review.

Outside this plugin: Application implementation, repository indexes, and general technical prose.

**Skills:** [manage-json-schemas](skills/manage-json-schemas/SKILL.md), [openapi-contract-authoring](skills/openapi-contract-authoring/SKILL.md), [openapi-contract-rating](skills/openapi-contract-rating/SKILL.md), [openapi-schema-modeling](skills/openapi-schema-modeling/SKILL.md).

**Agents:** [openapi-contract-rater](agents/openapi/openapi-contract-rater.agent.md), [schema-type-enforcer](agents/schema-type-enforcer.agent.md).

**Instructions:** [api-contract-design](instructions/api-contract-design.md).

### cli-development

Build command-line tools, shell completions, and terminal interfaces.

Choose when building a CLI, shell integration, completion, or interactive terminal UI.

Outside this plugin: Everyday Git and shell use, repository data queries, and CI operations.

**Skills:** [cli-creator](skills/cli-creator/SKILL.md), [shell-session-integration](skills/shell-session-integration/SKILL.md), [terminal-ui-design](skills/terminal-ui-design/SKILL.md).

### intellij-plugin-development

Build, test, package, and diagnose IntelliJ Platform plugins.

Choose for IntelliJ plugin lifecycle, PSI, indexing, integrations, tests, and IDE diagnostics; add Kotlin Engineering for Kotlin-specific work.

Outside this plugin: General Kotlin design and everyday Git, PR, or CI workflows.

**Skills:** [ide-diagnostics-mcp](skills/ide-diagnostics-mcp/SKILL.md), [intellij-platform-integrations](skills/intellij-platform-integrations/SKILL.md), [intellij-platform-testing](skills/intellij-platform-testing/SKILL.md), [intellij-plugin-delivery](skills/intellij-plugin-delivery/SKILL.md), [intellij-psi-indexing](skills/intellij-psi-indexing/SKILL.md).

### kotlin-engineering

Design, verify, review, and optimize Kotlin and Gradle changes.

Choose for Kotlin invariants, API design, libraries, observability, review, Gradle verification, and measured build performance.

Outside this plugin: Everyday Git and hosted delivery, shell integration, and IntelliJ-specific plugin mechanics.

**Skills:** [gradle-performance-engineering](skills/gradle-performance-engineering/SKILL.md), [kotlin-agentic-correctness](skills/kotlin-agentic-correctness/SKILL.md), [kotlin-api-surface-design](skills/kotlin-api-surface-design/SKILL.md), [kotlin-application-stack](skills/kotlin-application-stack/SKILL.md), [kotlin-branching](skills/kotlin-branching/SKILL.md), [kotlin-design-practices](skills/kotlin-design-practices/SKILL.md), [kotlin-gradle-validation](skills/kotlin-gradle-validation/SKILL.md), [kotlin-observability-design](skills/kotlin-observability-design/SKILL.md), [kotlin-review](skills/kotlin-review/SKILL.md), [negative-capability-proof](skills/negative-capability-proof/SKILL.md).

**Hooks:** [gradle-check-green](hooks/gradle-check-green.hook.json), [gradle-wrapper-integrity](hooks/gradle-wrapper-integrity.hook.json), [kotlin-horizontalization-check](hooks/kotlin-horizontalization-check.hook.json).

**Instructions:** [kotlin-engineering](instructions/kotlin-engineering.md).

### pkl-configuration

Model, validate, format, and maintain Pkl configuration and tooling.

Choose for Pkl schemas, configuration modules, packages, evaluation, formatting, tests, and toolchain setup.

Outside this plugin: General delivery pipelines, arbitrary shell automation, and application implementation.

**Skills:** [pkl-engineering](skills/pkl-engineering/SKILL.md), [pkl-pattern-catalogs](skills/pkl-pattern-catalogs/SKILL.md), [pkl-specification](skills/pkl-specification/SKILL.md), [pkl-tooling-setup](skills/pkl-tooling-setup/SKILL.md).

**Hooks:** [pkl-evaluate-check](hooks/pkl-evaluate-check.hook.json), [pkl-format-check](hooks/pkl-format-check.hook.json), [pkl-test-check](hooks/pkl-test-check.hook.json).

### repository-knowledge

Generate and maintain code indexes, knowledge documents, and navigation maps.

Choose when producing or refreshing repository knowledge artifacts and checking their source drift.

Outside this plugin: Routine source reading, ordinary code changes, and general documentation authoring.

**Skills:** [code-knowledge-base](skills/code-knowledge-base/SKILL.md), [local-repository-navigation](skills/local-repository-navigation/SKILL.md), [repository-signature-indexing](skills/repository-signature-indexing/SKILL.md).

**Hooks:** [code-knowledge-drift](hooks/code-knowledge-drift.hook.json).

### technical-writing

Write and revise technical docs, proposals, runbooks, and documentation sites.

Choose for technical prose, READMEs, runbooks, ADRs, proposals, and documentation site structure.

Outside this plugin: Code implementation and generated repository indexes or knowledge bundles.

**Skills:** [controlled-technical-writing](skills/controlled-technical-writing/SKILL.md), [reference-doc-workflow](skills/reference-doc-workflow/SKILL.md), [site-docs-authoring](skills/site-docs-authoring/SKILL.md), [technical-documentation](skills/technical-documentation/SKILL.md).

## Advanced repository policy

### skill-read-policy

Advanced: enforce repository-declared required skill reads.

Opt in only when a repository explicitly requires skill-read policy enforcement.

Outside this plugin: Everyday engineering, default setup, and general skill discovery.

**Hooks:** [required-skill-read](hooks/required-skill-read.hook.json).

## Profiles

- [agent-authoring-default](profiles/agent-authoring-default.json): software-engineering + agent-tooling. 467 instruction words.

- [documentation-default](profiles/documentation-default.json): technical-writing. 0 instruction words.

- [intellij-plugin-default](profiles/intellij-plugin-default.json): software-engineering + kotlin-engineering + intellij-plugin-development. 603 instruction words.

- [kotlin-repo-default](profiles/kotlin-repo-default.json): software-engineering + kotlin-engineering. 603 instruction words.

- [local-development-default](profiles/local-development-default.json): software-engineering. 467 instruction words.

## Standalone skills

Advanced alternatives outside the plugin chooser. They require explicit standalone setup; normal plugin selection does not depend on installing individual skills.

[agents-sdk](skills/agents-sdk/SKILL.md), [frontend-design](skills/frontend-design/SKILL.md), [grill-me-with-docs](skills/grill-me-with-docs/SKILL.md), [migrate-to-codex](skills/migrate-to-codex/SKILL.md), [react-best-practices](skills/react-best-practices/SKILL.md), [refactor](skills/refactor/SKILL.md), [stripe-best-practices](skills/stripe-best-practices/SKILL.md), [web-artifacts-builder](skills/web-artifacts-builder/SKILL.md), [workflow](skills/workflow/SKILL.md).

## Evidence

Counts describe source instruction text, not actual prompt loading or token use.
The graph gate checks identity, ownership, dependencies, and projection inputs.
Behavioral scenarios and golden replay are specifications, not observed Astra results.
