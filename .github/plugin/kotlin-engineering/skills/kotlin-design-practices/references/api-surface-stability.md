# API Surface Stability

Use when changing public, internal, or cross-module APIs.

- Default to `private` or `internal`.
- Keep constructors private when parsing or invariants are required.
- Expose read-only collection interfaces.
- Expose domain-owned types and focused capabilities across module boundaries.
- Keep framework, transport, persistence, serializer, engine, and SDK types out
  of public domain signatures. A framework-extension module may expose them only
  to its integration caller.
- Put concrete implementations in focused adapter modules. Let one minimal
  application or integration module select and configure them.
- Make an implementation swap change the adapter and integration wiring, not
  domain callers. Run the same contract suite against every supported binding.
- Enforce the boundary with an existing architecture check or a focused Gradle
  or test gate that rejects adapter dependencies and public implementation
  types in pure modules.
- Do not create an interface that mirrors every method and type of one
  dependency. Name the narrower domain capability.
- Treat public data class property changes as behavior changes.
- Adding a sealed subtype can break exhaustive `when` callers.
- Prefer deprecation with a migration path over removal.
- Use opt-in annotations for experimental APIs that callers may build around.
