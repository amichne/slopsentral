# Bundled Schema Profile

Use this reference only when the repository or user selects the Slopsentral profile.
Other schema contracts retain their own dialect, wire names, layout, and validator.

## Fixed Contract

The skill ships one schema profile:

```text
references/schema-profile/schema-profile.schema.json
```

The helper implements one fixed profile, not a configurable validator framework.
Selecting this profile does not authorize migrating existing wire contracts.
Keep other repository policies intact and validate them with their owning tools.

## What The Profile Owns

The bundled profile constrains schema-document syntax:

- top-level schemas use a `$schema` value accepted by the bundled profile
- top-level schemas are object schemas
- schema documents have `$id` and `title`
- object schemas close with `additionalProperties: false`
- discriminated object schemas define `properties.type` and include `type` in `required`; fixed records need neither
- discriminator fields are named `type`
- `oneOf` and `anyOf` union schemas declare `discriminator.propertyName: "type"`
- discriminator schemas use `enum`, not `const`
- discriminator values match CAPS_CASE
- meaningful schema nodes include `examples`
- only supported keywords are used

Run it directly:

```bash
node scripts/schema-contracts.js profile \
  --schema schemas/upload/upload.schema.json
```

## Fixed Tree Policy

The `policy-tree` command applies the bundled profile plus fixed cross-file rules:

```bash
node scripts/schema-contracts.js policy-tree --root schemas
```

The tree policy is intentionally not configurable. It derives `upload` from `UPLOAD`, compares enum values to filenames, checks sibling schema references, and enforces the hierarchical file tree.

Unsupported:

- `schema-policy.json`
- `schema-profile/schema-policy.schema.json`
- project-specific `schemaProfilePath`
- `--policy`, `--policy-schema`, or custom `--profile` overrides

Keep this profile's implementation here. Repositories decide whether to adopt it.
