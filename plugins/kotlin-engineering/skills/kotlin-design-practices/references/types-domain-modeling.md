# Type-Safe Domain Modeling

Use for value classes, sealed state, nullability removal, and immutability.

- Value class: meaningful primitives such as IDs, names, ports, paths, and
  percentages.
- Enum: stable closed labels with no per-case data.
- Sealed hierarchy: closed states, outcomes, commands, and events with per-case
  data.
- Data class: immutable records that can be copied.
- Nullable type: boundary interoperability only; translate before entering core.
  Even genuine domain absence must have a named sealed case, such as
  `Lookup.Found(Customer)` versus `Lookup.Missing`, with non-null contents.
  Kotlin `T?` represents absence but cannot distinguish its domain reasons.
  Do not use `null`, empty strings, zero IDs, or flags as substitute cases.
- Generic contents: constrain to non-null types (`T : Any`) when needed; an
  unconstrained `T` or `Present<T?>` can reintroduce nullable payloads.
- Mutation: keep inside builders, adapters, caches, or measured hot paths.

Ask what invalid value can still be constructed, then add only the type needed
to remove it. Exhaustive `when` must force callers to handle each alternative.
Use [boundary enforcement](boundary-enforcement.md) for module ownership and
the semantic checks needed to enforce rules Kotlin itself does not prohibit.
