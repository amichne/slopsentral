# Catalog

Generated with `uv run --locked tools/marketplace.py catalog --out source/CATALOG.md`.
Use Software Engineering for constrained domain design. Select specialties for the task.
Use repository procedures and native tools for general workflows. See [local workflows](../docs/community-workflows.md).
The host selects standard skills. Installation grants no action authority.

## Start here

### software-engineering

Constrain domain values, preserve established facts, and compose pure decisions.

Choose for domain modeling, atomic predicates, and proof-preserving APIs.

**Skills:** [semantic-ratchet](skills/semantic-ratchet/SKILL.md).

## Specialties

### developer-tooling

Author typed Python tools, schemas, Pkl contracts, agent resources, and explicit personal configuration changes.

Use for a requested tool, contract, agent resource, or configuration change.

**Skills:** [cli-creator](skills/cli-creator/SKILL.md), [manage-json-schemas](skills/manage-json-schemas/SKILL.md), [openapi-contract-authoring](skills/openapi-contract-authoring/SKILL.md), [personal-setup-management](skills/personal-setup-management/SKILL.md), [pkl-engineering](skills/pkl-engineering/SKILL.md), [plugin-composition-authoring](skills/plugin-composition-authoring/SKILL.md), [python-tooling](skills/python-tooling/SKILL.md), [skill-primitive-authoring](skills/skill-primitive-authoring/SKILL.md).

**Agents:** [openapi-contract-rater](agents/openapi/openapi-contract-rater.agent.md), [schema-type-enforcer](agents/schema-type-enforcer.agent.md).

### intellij-plugin-development

Build, test, package, and diagnose IntelliJ Platform plugins.

Choose for IntelliJ plugin lifecycle, PSI, indexing, integrations, tests, and IDE diagnostics; add Kotlin Engineering for Kotlin-specific work.

**Skills:** [intellij-platform-testing](skills/intellij-platform-testing/SKILL.md), [intellij-plugin-delivery](skills/intellij-plugin-delivery/SKILL.md), [intellij-psi-indexing](skills/intellij-psi-indexing/SKILL.md).

### kotlin-engineering

Design, verify, review, and optimize Kotlin and Gradle changes.

Choose for Kotlin invariants, API design, libraries, observability, review, Gradle verification, and measured build performance.

**Skills:** [gradle-performance-engineering](skills/gradle-performance-engineering/SKILL.md), [kotlin-application-stack](skills/kotlin-application-stack/SKILL.md), [kotlin-design-practices](skills/kotlin-design-practices/SKILL.md), [kotlin-gradle-validation](skills/kotlin-gradle-validation/SKILL.md), [kotlin-review](skills/kotlin-review/SKILL.md), [negative-capability-proof](skills/negative-capability-proof/SKILL.md).

**Hooks:** [gradle-check-green](hooks/gradle-check-green.hook.json), [gradle-wrapper-integrity](hooks/gradle-wrapper-integrity.hook.json), [kotlin-engineering-context](hooks/kotlin-engineering-context.hook.json), [kotlin-horizontalization-check](hooks/kotlin-horizontalization-check.hook.json).

**Instructions:** [kotlin-engineering](instructions/kotlin-engineering.md).

### repository-knowledge

Write technical documentation and maintain source-backed repository knowledge, navigation, and overlays.

Choose for technical prose, documentation sites, source-backed knowledge, navigation, or sibling knowledge overlays.

**Skills:** [code-knowledge-base](skills/code-knowledge-base/SKILL.md), [controlled-technical-writing](skills/controlled-technical-writing/SKILL.md), [local-repository-navigation](skills/local-repository-navigation/SKILL.md), [technical-documentation](skills/technical-documentation/SKILL.md).

**Hooks:** [code-knowledge-drift](hooks/code-knowledge-drift.hook.json), [knowledge-overlay](hooks/knowledge-overlay.hook.json).

## Profiles

- [agent-authoring-default](profiles/agent-authoring-default.json): software-engineering + developer-tooling.
- [developer-tooling-default](profiles/developer-tooling-default.json): software-engineering + developer-tooling.
- [documentation-default](profiles/documentation-default.json): repository-knowledge.
- [intellij-plugin-default](profiles/intellij-plugin-default.json): software-engineering + kotlin-engineering + intellij-plugin-development.
- [kotlin-repo-default](profiles/kotlin-repo-default.json): software-engineering + kotlin-engineering.
- [kotlin-type-design](profiles/kotlin-type-design.json): software-engineering + kotlin-engineering.
- [local-development-default](profiles/local-development-default.json): software-engineering.
- [personal-configuration-default](profiles/personal-configuration-default.json): developer-tooling.
- [pkl-checked-repository](profiles/pkl-checked-repository.json): software-engineering + developer-tooling.
- [pkl-workflow-default](profiles/pkl-workflow-default.json): software-engineering + developer-tooling.
- [type-design](profiles/type-design.json): software-engineering + kotlin-engineering + developer-tooling.

## Standalone source references

Use upstream workflows for general delivery. These local procedures remain available for explicit reuse.

- [git-change-flow](skills/git-change-flow/SKILL.md).
- [github-ci-operations](skills/github-ci-operations/SKILL.md).
- [issue-tracker-operations](skills/issue-tracker-operations/SKILL.md).
- [mise-project-tooling](skills/mise-project-tooling/SKILL.md).
- [pull-request-lifecycle](skills/pull-request-lifecycle/SKILL.md).
- [tdd](skills/tdd/SKILL.md).

## Evidence limits

Pkl examines composition and derives provider output.
Projection does not establish host consumption or model behavior.
