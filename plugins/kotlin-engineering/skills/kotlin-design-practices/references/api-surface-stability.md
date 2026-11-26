# API Surface Stability

Use when changing public, internal, or cross-module APIs.

- Default to `private` or `internal`.
- Keep constructors private when parsing or invariants are required.
- Expose read-only collection interfaces.
- Expose domain-owned types and focused capabilities across module boundaries.
- Keep framework, transport, persistence, serializer, engine, and SDK types out
  of public domain signatures. A framework-extension module may expose them only
  to its integration caller.
- Put raw adapters with value construction in the group's registered boundary
  module. Let one minimal integration module select and configure typed capabilities.
- Make an implementation swap change the adapter and integration wiring, not
  domain callers. Run the same contract suite against every supported binding.
- Enforce the boundary with an existing architecture check or a focused Gradle
  or test gate. Allow core to depend on its registered boundary's domain-only
  API; reject direct implementation-library dependencies, public implementation
  types, and forbidden reverse edges. This isolates APIs, not runtime dependencies:
  Gradle `implementation` dependencies may remain on a consumer's runtime classpath.
  For example, allow `customer-core -> customer-boundary` through `CustomerId`
  and `CustomerLookup`; reject `customer-core -> HTTP client`, `HttpResponse`
  in `CustomerLookup`, and `customer-boundary -> customer-core`.
- Do not create an interface that mirrors every method and type of one
  dependency. Name the narrower domain capability.
- Treat public data class property changes as behavior changes.
- Adding a sealed subtype can break exhaustive `when` callers.
- Prefer deprecation with a migration path over removal.
- Use opt-in annotations for experimental APIs that callers may build around.
