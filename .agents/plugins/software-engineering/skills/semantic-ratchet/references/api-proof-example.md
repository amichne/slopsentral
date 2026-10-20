# API: Each Result Case Owns Its Evidence

Use this example when JSON crosses a trust boundary or an API result has finite
alternatives. [artifact-result.schema.json](../assets/artifact-result.schema.json)
is the single canonical Draft 2020-12 contract for the shell adapter's result.

Every object variant requires `type` with a CAPS_CASE `const`. `oneOf` selects
exactly one legal case. Case-specific fields are required on their owner, and
every object uses `additionalProperties: false`. Shared digest, stage, signal,
exit-status, and result definitions are reused through `$ref`. There are no
nullable properties or success flags.

```json
{
  "type": "CLEANUP_FAILED",
  "outcome": {
    "type": "PUBLISHED",
    "sha256": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
  },
  "exit_status": 79
}
```

This shape preserves two facts: publication was confirmed and cleanup failed.
It cannot be interpreted as a successful cleanup or a rollback. The nested
outcome references the closed underlying outcome family; recursive cleanup
wrappers are excluded. A checksum mismatch requires both expected and observed
digests. Unknown publication state has its own variants instead of pretending a
failed command establishes the absence of a write.

At ingress, validate the raw payload before constructing a domain result. Map
the accepted tag into the corresponding sealed or tagged domain case. Retain
the digest constraint in its domain type. An unsupported tag is a boundary
failure; never coerce it into a familiar case or use a catch-all internal branch.

In OpenAPI 3.1, reference this canonical schema rather than duplicating fields.
For a documented polymorphic family, declare `propertyName: type` and map every
CAPS_CASE tag explicitly. The adapter retains the full canonical validation:

```yaml
components:
  schemas:
    ArtifactResult:
      allOf:
        - $ref: './artifact-result.schema.json'
      discriminator:
        propertyName: type
        mapping:
          PUBLISHED: './artifact-result.schema.json#/$defs/Published'
          INPUT_REJECTED: './artifact-result.schema.json#/$defs/InputRejected'
          CHECKSUM_MISMATCH: './artifact-result.schema.json#/$defs/ChecksumMismatch'
          STAGE_FAILED: './artifact-result.schema.json#/$defs/StageFailed'
          TOOL_UNAVAILABLE: './artifact-result.schema.json#/$defs/ToolUnavailable'
          PROTOCOL_FAILED: './artifact-result.schema.json#/$defs/ProtocolFailed'
          PREPARATION_INTERRUPTED: './artifact-result.schema.json#/$defs/PreparationInterrupted'
          INTERRUPTED: './artifact-result.schema.json#/$defs/Interrupted'
          PUBLICATION_INTERRUPTED: './artifact-result.schema.json#/$defs/PublicationInterrupted'
          PUBLICATION_UNCONFIRMED: './artifact-result.schema.json#/$defs/PublicationUnconfirmed'
          CLEANUP_FAILED: './artifact-result.schema.json#/$defs/CleanupFailed'
```

A discriminator is routing metadata; `oneOf`, required case tags, and closed
shapes supply validation. Configure the API's reference location to the
canonical file. This illustrative adapter is not a separately validated OpenAPI
document; the runner proves the referenced JSON Schema contract.

The [runner](../scripts/check-proof-examples.mjs) validates all eleven canonical
examples and sixteen independently named rejection cases. These include missing
and unknown tags, absent evidence, illegal nulls, mixed cases, unknown fields,
malformed digests, unknown failure reasons/stages, unbounded exit status, and
loss of the prior cleanup outcome:

```sh
node <skill-root>/scripts/check-proof-examples.mjs --contracts-only
```

Here `<skill-root>` contains this skill's `SKILL.md`; the checkout root is
`source/skills/semantic-ratchet`. Install AJV 8 in a package enclosing the runner
for Node module resolution; this repository already declares that dependency.
The runner performs no installation and fails if dependencies are unavailable.

Schema acceptance proves the stated shape constraints. It does not establish
that a producer performed verification, that the digest belongs to particular
bytes, that expected and observed digests differ, or that publication occurred.
Those obligations remain with the trusted operation owner and its effect
evidence. Never construct `VerifiedArtifact` from a schema-valid `PUBLISHED`
payload alone. The examples prove contract behavior; they do not establish
model behavior or deployed service correctness.
