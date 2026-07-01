# Evidence Checks

Pick checks that match the primitive being audited. Do not run broad commands
only to create activity; run them because the decision depends on their result.

## Source Graph

```sh
node source/tools/validate-source-graph.mjs
```

Use this after adding, moving, renaming, or removing canonical primitive
references. It checks plugin references, marketplace entries, hooks, profiles,
routing cases, benchmarks, audit records, and runtime-link records.

## Structured Data

```sh
node source/tools/validate-source-graph.mjs
python3 source/skills/primitive-quality-audit/scripts/primitive_audit_record check --audit-id <id>
```

Use these after changing JSON schemas, manifests, plugin manifests, marketplace
catalogs, audit records, hook metadata, or hook adapters.

## Syntax And Scripts

```sh
bash -n source/hooks/*.sh
python3 -m py_compile source/hooks/*.py source/skills/plugin-composition-authoring/scripts/check_plugin_composition source/skills/primitive-quality-audit/scripts/primitive_audit_record
node source/skills/manage-json-schemas/scripts/schema-contracts.js policy-tree --root source/skills/manage-json-schemas/references/schemas
node source/tools/run-routing-evals.mjs --require-all-observed
git diff --check
```

Add domain-specific checks for the primitive under review. For example, run
language tests for a language-specific skill, hook script syntax for hooks, and
documentation site builds for docs plugins.

## Evidence Recording

Record durable audit decisions in `garden/manifests/primitive-audits.json` when
the decision affects promotion, runtime activation, or cleanup. Store transient
raw outputs outside packaged primitive directories unless the output itself is a
maintained fixture. Do not keep dead source as evidence; preserve history in Git
and manifests.
