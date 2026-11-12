# Closed Outcomes

Use a closed, discriminated family when the supported values or shapes are
finite. Each case owns exactly the data legal for that case, and consumers that
promise complete handling must be exhaustive.

Expected parse, validation, authorization, conflict, unsupported-variant,
transition, and recoverable dependency failures are domain outcomes. Give each
failure a stable identity and the facts needed to handle it, such as a field
path, conflict key, retryability, or source cause. Reserve exceptions, panics,
and traps for defects, violated internal assertions, resource exhaustion, or an
established platform contract.

When an external system has an open universe, translate known values into the
closed local model and preserve one explicit unexpected-external case for
diagnostics. Do not add a catch-all branch to an otherwise closed internal
family.

Reject free-form tags, tag-plus-optional-field records, message parsing,
universal exception handling, and nullable values with several undocumented
meanings. Adding a supported case should force deliberate updates to complete
consumers.
