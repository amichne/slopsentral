# Catalog

Generated from canonical manifests by `node tools/catalog.mjs --write`.
For code work, start with Software Engineering and add only the specialties your task needs.
Keep that selection for the repository. Describe the outcome; the agent selects relevant skills within the installed plugins.
Installing a plugin makes its capabilities available; it does not require every skill to run or authorize publication.

For documentation alone, choose Repository Knowledge. Knowledge generation remains optional.
Profiles provide repeatable setup selections. See [migration](MIGRATION.md) before replacing older installations.

## Start here

### software-engineering

Design proof-preserving boundaries and implement, verify, and deliver software with uv-managed Python automation.

Start here for typed design, invariant decomposition, Python automation, testing, refactoring, Git, PRs, and CI.

Outside this plugin: Language and platform syntax beyond the shared baseline; add the relevant specialty.

**Skills:** [git-change-flow](skills/git-change-flow/SKILL.md), [github-ci-operations](skills/github-ci-operations/SKILL.md), [issue-tracker-operations](skills/issue-tracker-operations/SKILL.md), [mise-project-tooling](skills/mise-project-tooling/SKILL.md), [pull-request-lifecycle](skills/pull-request-lifecycle/SKILL.md), [python-tooling](skills/python-tooling/SKILL.md), [semantic-ratchet](skills/semantic-ratchet/SKILL.md), [tdd](skills/tdd/SKILL.md).

**Hooks:** [agents-md-scope](hooks/agents-md-scope.hook.json), [software-engineering-context](hooks/software-engineering-context.hook.json).

**Instructions:** [agent-execution](instructions/agent-execution.md), [engineering-design](instructions/engineering-design.md).

## Specialties

### developer-tooling

Author typed Python tools, schemas, Pkl contracts, agent resources, and explicit personal configuration changes.

Use for a requested tool, contract, agent resource, or configuration change.

Outside this plugin: Automatic source checks, skill-read policy, or unrequested personal configuration changes.

**Skills:** [cli-creator](skills/cli-creator/SKILL.md), [manage-json-schemas](skills/manage-json-schemas/SKILL.md), [openapi-contract-authoring](skills/openapi-contract-authoring/SKILL.md), [personal-setup-management](skills/personal-setup-management/SKILL.md), [pkl-engineering](skills/pkl-engineering/SKILL.md), [plugin-composition-authoring](skills/plugin-composition-authoring/SKILL.md), [python-tooling](skills/python-tooling/SKILL.md), [skill-primitive-authoring](skills/skill-primitive-authoring/SKILL.md).

**Agents:** [openapi-contract-rater](agents/openapi/openapi-contract-rater.agent.md), [schema-type-enforcer](agents/schema-type-enforcer.agent.md).

### intellij-plugin-development

Build, test, package, and diagnose IntelliJ Platform plugins.

Choose for IntelliJ plugin lifecycle, PSI, indexing, integrations, tests, and IDE diagnostics; add Kotlin Engineering for Kotlin-specific work.

Outside this plugin: General Kotlin design and everyday Git, PR, or CI workflows.

**Skills:** [intellij-platform-testing](skills/intellij-platform-testing/SKILL.md), [intellij-plugin-delivery](skills/intellij-plugin-delivery/SKILL.md), [intellij-psi-indexing](skills/intellij-psi-indexing/SKILL.md).

### kotlin-engineering

Design, verify, review, and optimize Kotlin and Gradle changes.

Choose for Kotlin invariants, API design, libraries, observability, review, Gradle verification, and measured build performance.

Outside this plugin: Everyday Git and hosted delivery, shell integration, and IntelliJ-specific plugin mechanics.

**Skills:** [gradle-performance-engineering](skills/gradle-performance-engineering/SKILL.md), [kotlin-application-stack](skills/kotlin-application-stack/SKILL.md), [kotlin-design-practices](skills/kotlin-design-practices/SKILL.md), [kotlin-gradle-validation](skills/kotlin-gradle-validation/SKILL.md), [kotlin-review](skills/kotlin-review/SKILL.md), [negative-capability-proof](skills/negative-capability-proof/SKILL.md).

**Hooks:** [gradle-check-green](hooks/gradle-check-green.hook.json), [gradle-wrapper-integrity](hooks/gradle-wrapper-integrity.hook.json), [kotlin-engineering-context](hooks/kotlin-engineering-context.hook.json), [kotlin-horizontalization-check](hooks/kotlin-horizontalization-check.hook.json).

**Instructions:** [kotlin-engineering](instructions/kotlin-engineering.md).

### repository-knowledge

Write technical documentation and maintain source-backed repository knowledge, navigation, and overlays.

Choose for technical prose, documentation sites, source-backed knowledge, navigation, or sibling knowledge overlays.

Outside this plugin: Automatic knowledge generation during ordinary code tasks or treating documentation as source authority.

**Skills:** [code-knowledge-base](skills/code-knowledge-base/SKILL.md), [controlled-technical-writing](skills/controlled-technical-writing/SKILL.md), [local-repository-navigation](skills/local-repository-navigation/SKILL.md), [technical-documentation](skills/technical-documentation/SKILL.md).

**Hooks:** [code-knowledge-drift](hooks/code-knowledge-drift.hook.json), [knowledge-overlay](hooks/knowledge-overlay.hook.json).

## Advanced repository policy

## Profiles

- [agent-authoring-default](profiles/agent-authoring-default.json): software-engineering + developer-tooling. 697 instruction words.

- [developer-tooling-default](profiles/developer-tooling-default.json): software-engineering + developer-tooling. 697 instruction words.

- [documentation-default](profiles/documentation-default.json): repository-knowledge. 0 instruction words.

- [intellij-plugin-default](profiles/intellij-plugin-default.json): software-engineering + kotlin-engineering + intellij-plugin-development. 833 instruction words.

- [kotlin-repo-default](profiles/kotlin-repo-default.json): software-engineering + kotlin-engineering. 833 instruction words.

- [kotlin-type-design](profiles/kotlin-type-design.json): software-engineering + kotlin-engineering. 833 instruction words.

- [local-development-default](profiles/local-development-default.json): software-engineering. 697 instruction words.

- [personal-configuration-default](profiles/personal-configuration-default.json): developer-tooling. 0 instruction words.

- [pkl-checked-repository](profiles/pkl-checked-repository.json): software-engineering + developer-tooling. 697 instruction words.

- [pkl-workflow-default](profiles/pkl-workflow-default.json): software-engineering + developer-tooling. 697 instruction words.

- [type-design](profiles/type-design.json): software-engineering + kotlin-engineering + developer-tooling. 833 instruction words.

## Reused assets

Each asset has one canonical source. Plugins may compose it in several bundles.
Profiles may share skills, agents, and instructions. Select each hook through one plugin to avoid duplicate execution.

| Asset | Composed by |
| --- | --- |
| [SKILL/python-tooling](skills/python-tooling/SKILL.md) | developer-tooling, software-engineering |

## Standalone skills

Advanced alternatives outside the plugin chooser. They require explicit standalone setup; normal plugin selection does not depend on installing individual skills.

.

## Evidence

Counts describe source instruction text, not actual prompt loading or token use.
The graph gate checks canonical identity, dependencies, profile hook activation, and projection inputs.
Report v3 totals count each instruction once; per-plugin counts describe each bundle separately.
Behavioral scenarios and golden replay are specifications, not observed Astra results.
