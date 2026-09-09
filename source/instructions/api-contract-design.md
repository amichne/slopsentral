# API Contract Design

Treat JSON Schema and OpenAPI documents as trust-boundary contracts. Validate
raw payloads before constructing domain values, require every domain fact that
callers need, and close object shapes unless an extension point is intentional.

Model finite alternatives as discriminated variants using a required `type`
field with CAPS_CASE enum values. Put case-specific fields on the case that owns
them, constrain primitive formats and bounds, and include examples that teach
the accepted shape. Expected API failures are finite typed variants, not free
text, nulls, booleans, or status-code folklore.

Keep each reusable schema in one canonical location and reference it. Update
schemas, examples, parsers, generated types, and validation checks together.
Do not widen a contract merely to accept incidental invalid data; name real
compatibility boundaries and migrations explicitly.
