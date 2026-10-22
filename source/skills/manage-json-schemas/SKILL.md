---
name: "manage-json-schemas"
description: "Use when JSON Schema assets need authoring, extraction, validation, lifecycle changes, discriminator policy, examples, or validator-backed contract checks."
---

# Manage JSON Schemas

Use the repository's schema dialect, validator, and compatibility commitments as
the contract authority. Review requests authorize findings, not schema migrations.
The bundled helper implements the Slopsentral profile; it is not a universal
JSON Schema validator. Select that profile only when the repository already uses
it or the user asks to adopt it.

## Load Only What You Need

- When the Slopsentral profile is selected, read [schema policy](references/schema-policy.md) and [profile](references/schema-profile.md).
- When modeling its hierarchical variants, read [hierarchical layout](references/hierarchical-schema-layout.md).
- When explicitly adopting its hooks or CI gates, read [enforcement](references/enforcement.md).
- For examples of that profile, read [schema examples](references/schema-examples.md) and [schemas](references/schemas/).

## Required First Steps

1. Locate the schema owner, consumers, repository policy, dialect, and validator.
2. Name the invariant and compatibility boundary. Preserve wire tags, filenames,
   and supported keywords unless the requested change requires a migration.
3. Run the existing validator with a valid payload and the nearest invalid one.
   Install dependencies only when readiness is missing, using the repository's package manager and lockfile.
4. Keep schema assets in the owning module's durable schema path, usually `schemas/`, `schema/`, `contracts/`, or `api/schemas/`.

## Core Rules

- Model finite variants with distinguishable branches and required tags where
  the wire contract uses them. Fixed records need no synthetic discriminator.
- Preserve existing tag names and values. Use `const`, `enum`, and union keywords
  according to the declared dialect and consumer support.
- Do not add the nonstandard `discriminator` keyword unless the validator and
  generator support it and repository policy requires it.
- Close object shapes with `additionalProperties: false` unless extension is intentional and documented.
- Add granular `examples` on meaningful schema nodes.
- Treat raw JSON as untrusted input; validate before constructing domain types.

## Opt-In Slopsentral Profile

The bundled references and CLI commands apply only to this profile.
It requires `type` discriminators, CAPS_CASE single-value enums rather than
`const`, granular examples, and a fixed hierarchy. Its helper rejects custom
profile overrides; use the repository's validator for other contracts instead
of rewriting them to make this helper pass. Read the profile references before
using `init`, `extract`, or policy gates; their generated shapes and fixed tree
layout are deliberate choices, not inferred user requirements.

## CLI Workflow

Use the bundled helper from this skill directory. Resolve the skill directory
first, then run from the target repository. Keep `scripts/package.json` with the
helper: it preserves CommonJS execution inside Pi and Amp packages.
`help`, `init`, `extract`, `profile`, and policy checks need only Node.js.
`validate` also requires the target repository's locked `ajv` and `ajv-formats`
dependencies (`ajv-draft-04` for draft-04). Package installation does not supply
those dependencies; report missing readiness rather than claiming validation.

```bash
node <skill-dir>/scripts/schema-contracts.js help
```

Validate a schema against the bundled syntax profile:

```bash
node <skill-dir>/scripts/schema-contracts.js profile \
  --schema schemas/upload/upload.schema.json
```

Validate data:

```bash
node <skill-dir>/scripts/schema-contracts.js validate \
  --schema schemas/upload/upload.schema.json \
  --data samples/upload-manifest.json
```

## Completion

The changed invariant has valid and invalid examples exercised by the owning
validator. Report the dialect, selected policy, commands, outcomes, and any
unverified consumer compatibility. Sample extraction is a starting point, not
proof of the intended domain. Profile adoption and publication remain separate
from an ordinary schema edit.
