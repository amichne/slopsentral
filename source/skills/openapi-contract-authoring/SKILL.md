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
2. Name the OpenAPI version, schema dialect, supported keywords, and acceptance command.
3. Define domain concepts, finite variants, constraints, legal transitions, and expected failures.
4. Reuse named components for shared identifiers, envelopes, errors, and variant families.
5. Model each operation's parameters, body, response, headers, status codes, security, and examples.
6. Choose the strongest supported schema construct for each invariant.
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

From this skill's installed directory, run the scripts with uv and their bundled locks:

```sh
uv run --locked --script scripts/validate-yaml-examples.py
uv run --locked --script scripts/tests/test_validate_yaml_examples.py -q
```

The scripts declare PyYAML and pytest dependencies without a consumer project configuration.

## Completion

Name the source authority, protected invariant, accepted example, rejected example, and commands that ran.
Distinguish schema acceptance, generated-consumer compilation, runtime behavior, and inspection-only findings.
For review, name each admitted invalid state, file location, evidence, confidence, and concrete correction.
Use `unknown` when evidence cannot support a rating axis.
