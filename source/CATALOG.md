# Catalog

Generated from canonical manifests by `node source/tools/catalog.mjs --write`.
Choose a workstream by its outcome. A profile composes workstreams; it does not copy them.

## Workstreams

### agent-platform-authoring

Reusable agent tooling and its publication contracts.

Outside this workstream: General code navigation, user documentation, application implementation, and automatic marketplace publication.

**Skills:** [agent-profile-authoring](skills/agent-profile-authoring/SKILL.md), [hook-primitive-authoring](skills/hook-primitive-authoring/SKILL.md), [plugin-composition-authoring](skills/plugin-composition-authoring/SKILL.md), [primitive-routing-evaluation](skills/primitive-routing-evaluation/SKILL.md), [repo-instruction-topology](skills/repo-instruction-topology/SKILL.md), [skill-primitive-authoring](skills/skill-primitive-authoring/SKILL.md).

**Hooks:** [required-skill-read](hooks/required-skill-read.hook.json), [source-graph-valid](hooks/source-graph-valid.hook.json).

### api-contracts

Machine-readable boundary contracts.

Outside this workstream: Application implementation, source knowledge indexing, and general technical prose.

**Skills:** [manage-json-schemas](skills/manage-json-schemas/SKILL.md), [openapi-contract-authoring](skills/openapi-contract-authoring/SKILL.md), [openapi-contract-rating](skills/openapi-contract-rating/SKILL.md), [openapi-schema-modeling](skills/openapi-schema-modeling/SKILL.md).

**Agents:** [openapi-contract-rater](agents/openapi/openapi-contract-rater.agent.md), [schema-type-enforcer](agents/schema-type-enforcer.agent.md).

**Instructions:** [schema-driven-design](concepts/schema-driven-design/core.md).

### code-knowledge-base

Source-backed code knowledge and navigation.

Outside this workstream: General document authoring, prose polishing, documentation site configuration, and agent plugin authoring.

**Skills:** [code-knowledge-base](skills/code-knowledge-base/SKILL.md), [local-repository-navigation](skills/local-repository-navigation/SKILL.md), [repository-signature-indexing](skills/repository-signature-indexing/SKILL.md).

**Hooks:** [code-knowledge-drift](hooks/code-knowledge-drift.hook.json).

### developer-tools

Local command-line tools and repository work.

Outside this workstream: Hosted PR lifecycle, CI/CD architecture, deployment, and human-facing terminal UI design.

**Skills:** [cli-creator](skills/cli-creator/SKILL.md), [cli-data-pipelines](skills/cli-data-pipelines/SKILL.md), [git-change-flow](skills/git-change-flow/SKILL.md), [mise-project-tooling](skills/mise-project-tooling/SKILL.md), [shell-script-safety](skills/shell-script-safety/SKILL.md), [shell-session-integration](skills/shell-session-integration/SKILL.md).

### effective-delivery

Hosted delivery from issue to verified pull request and release evidence.

Outside this workstream: Local shell or Git mechanics, application design, and unrequested merge or deployment.

**Skills:** [delivery-pipeline-design](skills/delivery-pipeline-design/SKILL.md), [github-ci-operations](skills/github-ci-operations/SKILL.md), [issue-tracker-operations](skills/issue-tracker-operations/SKILL.md), [pull-request-lifecycle](skills/pull-request-lifecycle/SKILL.md).

### engineering-baseline

Engineering outcomes, semantic design, and verification.

Outside this workstream: Language/tool-specific implementation, hosted delivery, and documentation production.

**Skills:** [bounded-delegation](skills/bounded-delegation/SKILL.md), [define-goal](skills/define-goal/SKILL.md), [repository-onboarding](skills/repository-onboarding/SKILL.md), [semantic-ratchet](skills/semantic-ratchet/SKILL.md), [tdd](skills/tdd/SKILL.md).

**Hooks:** [agents-md-turn-refresh](hooks/agents-md-turn-refresh.hook.json).

**Instructions:** [agent-execution](instructions/agent-execution.md), [type-safety](concepts/type-safety/core.md).

### intellij-engineering

IntelliJ Platform plugin behavior and lifecycle.

Outside this workstream: General Kotlin design, local Git mechanics, hosted PR operations, and Kast-specific runtime diagnosis.

**Skills:** [ide-diagnostics-mcp](skills/ide-diagnostics-mcp/SKILL.md), [intellij-platform-integrations](skills/intellij-platform-integrations/SKILL.md), [intellij-platform-testing](skills/intellij-platform-testing/SKILL.md), [intellij-plugin-delivery](skills/intellij-plugin-delivery/SKILL.md), [intellij-psi-indexing](skills/intellij-psi-indexing/SKILL.md).

### kast-operations

Kast runtime operation and semantic evidence.

Outside this workstream: General Kotlin application implementation, generic IDE plugin design, and database mutation.

**Skills:** [kast-idea-backend-delivery](skills/kast-idea-backend-delivery/SKILL.md), [kast-installation-diagnosis](skills/kast-installation-diagnosis/SKILL.md), [kast-kotlin-structural-analysis](skills/kast-kotlin-structural-analysis/SKILL.md), [kast-performance-assessment](skills/kast-performance-assessment/SKILL.md), [sqlite-readonly-navigation](skills/sqlite-readonly-navigation/SKILL.md).

### kotlin-engineering

Kotlin implementation, API design, and compiler-backed review.

Outside this workstream: Hosted delivery, generic shell configuration, and IntelliJ-specific lifecycle or PSI mechanics.

**Skills:** [kotlin-agentic-correctness](skills/kotlin-agentic-correctness/SKILL.md), [kotlin-api-surface-design](skills/kotlin-api-surface-design/SKILL.md), [kotlin-application-stack](skills/kotlin-application-stack/SKILL.md), [kotlin-branching](skills/kotlin-branching/SKILL.md), [kotlin-design-practices](skills/kotlin-design-practices/SKILL.md), [kotlin-gradle-validation](skills/kotlin-gradle-validation/SKILL.md), [kotlin-observability-design](skills/kotlin-observability-design/SKILL.md), [kotlin-review](skills/kotlin-review/SKILL.md), [negative-capability-proof](skills/negative-capability-proof/SKILL.md).

**Agents:** [kotlin-boundary-contract-reviewer](agents/kotlin-review/kotlin-boundary-contract-reviewer.agent.md), [kotlin-package-cohesion-reviewer](agents/kotlin-review/kotlin-package-cohesion-reviewer.agent.md), [kotlin-review-captain](agents/kotlin-review/kotlin-review-captain.agent.md), [kotlin-type-safety-reviewer](agents/kotlin-review/kotlin-type-safety-reviewer.agent.md).

**Hooks:** [gradle-check-green](hooks/gradle-check-green.hook.json), [gradle-wrapper-integrity](hooks/gradle-wrapper-integrity.hook.json), [kotlin-horizontalization-check](hooks/kotlin-horizontalization-check.hook.json).

**Instructions:** [kotlin-code-correctness](concepts/kotlin-code-correctness/core.md), [kotlin-repository-engineering](concepts/kotlin-repository-engineering/core.md).

### pkl-engineering

Typed Pkl configuration and its toolchain.

Outside this workstream: General CI/CD architecture, arbitrary shell automation, and application domain modeling.

**Skills:** [pkl-engineering](skills/pkl-engineering/SKILL.md), [pkl-pattern-catalogs](skills/pkl-pattern-catalogs/SKILL.md), [pkl-specification](skills/pkl-specification/SKILL.md), [pkl-tooling-setup](skills/pkl-tooling-setup/SKILL.md).

**Hooks:** [pkl-evaluate-check](hooks/pkl-evaluate-check.hook.json), [pkl-format-check](hooks/pkl-format-check.hook.json), [pkl-test-check](hooks/pkl-test-check.hook.json).

### terminal-ui-design

Human-facing terminal interaction.

Outside this workstream: Shell activation or completion, machine-readable data pipelines, and CLI protocol design.

**Skills:** [terminal-ui-design](skills/terminal-ui-design/SKILL.md).

### writing

Source-grounded prose and technical documentation.

Outside this workstream: Code changes, signature-index construction, OKF knowledge bundles, and ungrounded first-person claims.

**Skills:** [controlled-technical-writing](skills/controlled-technical-writing/SKILL.md), [reference-doc-workflow](skills/reference-doc-workflow/SKILL.md), [site-docs-authoring](skills/site-docs-authoring/SKILL.md), [technical-documentation](skills/technical-documentation/SKILL.md).

## Profiles

- [agent-authoring-default](profiles/agent-authoring-default.json): engineering-baseline + agent-platform-authoring. 1022 instruction words.

- [documentation-default](profiles/documentation-default.json): engineering-baseline + writing. 1022 instruction words.

- [intellij-plugin-default](profiles/intellij-plugin-default.json): engineering-baseline + kotlin-engineering + developer-tools + effective-delivery + intellij-engineering. 4430 instruction words.

- [kotlin-repo-default](profiles/kotlin-repo-default.json): engineering-baseline + kotlin-engineering + developer-tools + effective-delivery. 4430 instruction words.

- [local-development-default](profiles/local-development-default.json): engineering-baseline + developer-tools. 1022 instruction words.

## Standalone skills

These optional specialties are outside the default workstreams. They remain independently installable.

[agents-sdk](skills/agents-sdk/SKILL.md), [frontend-design](skills/frontend-design/SKILL.md), [grill-me-with-docs](skills/grill-me-with-docs/SKILL.md), [migrate-to-codex](skills/migrate-to-codex/SKILL.md), [react-best-practices](skills/react-best-practices/SKILL.md), [refactor](skills/refactor/SKILL.md), [stripe-best-practices](skills/stripe-best-practices/SKILL.md), [web-artifacts-builder](skills/web-artifacts-builder/SKILL.md), [workflow](skills/workflow/SKILL.md).

## Evidence

Counts describe source instruction text, not actual prompt loading or token use.
The graph gate checks identity, ownership, dependencies, and projection inputs.
Behavioral scenarios and golden replay are specifications, not observed Astra results.
