---
name: "openapi-contract-authoring"
description: "Create, revise, or review OpenAPI contracts, operations, component schemas, and compatibility. Use for constrained variants, typed errors, schema examples, or evidence-backed contract findings."
---

# OpenAPI Contract Authoring

Use the specification or its typed generator as the API contract authority.
Use one workflow for operations, component schemas, and contract review.
A review request authorizes inspection and evidence collection, not implementation.

## Workflow

1. Find the owning source, callers, existing specification, schemas, generator, and repository policy.
   Reuse the canonical specification or typed generator for an existing API.
   Create a new contract owner only when the requested API has none.
2. Name the OpenAPI version, schema dialect, supported keywords, and acceptance command.
3. For review, trace domain concepts, finite variants, constraints, legal transitions,
   and expected failures in the current contract. For authoring, define the changed contract before schema syntax.
4. Reuse named components for shared identifiers, envelopes, errors, and variant families.
   Before changing a shared component, inspect its affected operations and generated consumers.
5. When an operation changes, cover its parameters, body, response, headers,
   status codes, security, and examples. A component-only change does not require remodeling unrelated operations.
6. For each changed invariant, choose the strongest supported schema construct.
   In review, identify any invariant the existing construct admits incorrectly.
7. Exercise valid examples and the nearest illegal payload with the repository's validator or generated consumer.
8. For review, report evidence-backed findings before scores or uncertain conclusions.
9. For authorized edits, change the canonical owner and regenerate its consumers.

## Schema Contract

Use `oneOf` for exclusive variants and a required discriminator for finite families.
Use `type` as the discriminator unless an established contract names another field.
Use `allOf` for intersections and `anyOf` only for intentional overlap.
Close object shapes unless the extension point has typed keys and values.
Constrain strings, numbers, arrays, maps, and finite codes.
Keep absent, null, empty, blank, and invalid values distinct.
Use null only when the domain defines its meaning.
Preserve the repository's OpenAPI profile and generator limits.

## References

- Read [operation contracts](references/operation-contracts.md) for requests, responses, errors, and security.
- Read [component ownership](references/component-ownership.md) for reusable schemas and generated models.
- Read [subtypes and constraints](references/subtypes-and-constraints.md) for schema keywords and profile differences.
- Read [invariant examples](references/invariant-examples.md) for variants, constrained values, collections, and forbidden payloads.
- Read [rating rubric](references/rating-rubric.md) for a requested score or review severity.
- Read [evidence and output](references/evidence-and-output.md) for findings and evidence limits.

The three bundled YAML fixtures use a non-null contract profile.
Their helper proves YAML parsing and that fixture policy only.
It does not prove full OpenAPI acceptance or generated-client behavior.

When checking or changing these bundled fixtures, run the scripts from this
skill's installed directory with uv and their bundled locks:

```sh
uv run --locked --script scripts/validate-yaml-examples.py
uv run --locked --script scripts/tests/test_validate_yaml_examples.py -q
```

The scripts declare PyYAML and pytest dependencies without a consumer project configuration.
For a target API, use its owning validator and generated consumers instead of
treating the bundled fixture checks as acceptance of that API.

## Completion

Name the source authority, protected invariant, accepted example, rejected example, and commands that ran.
Distinguish schema acceptance, generated-consumer compilation, runtime behavior, and inspection-only findings.
For review, name each admitted invalid state, file location, evidence, confidence, and concrete correction.
Use `unknown` when evidence cannot support a rating axis.
