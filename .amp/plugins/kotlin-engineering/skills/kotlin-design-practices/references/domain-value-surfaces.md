# Domain Value Surfaces

Use this reference for single-field domain distinctions, constrained
construction, data-class boundaries, equality, serialization, Java interop, or
boxing-sensitive code.

## Choose The Representation

| Situation | Prefer |
| --- | --- |
| Single field with domain identity or an invariant | `@JvmInline value class` with constrained construction when compatible |
| Multiple fields forming one valid state | Focused data class with constrained construction when needed |
| Finite states or outcomes with variant-specific data | Sealed interface or sealed class |
| No domain meaning and no invariant | Keep the primitive local |
| Custom equality beyond the wrapped value | Data class or another explicit type |

Do not use a type alias for domain meaning. It changes spelling without adding a
compiler barrier. Keep unchecked constructors private or internal and expose a
parser or factory returning the refined value or a closed typed failure.

## Contract Checks

- **Serialization:** verify whether the wire shape is a primitive, object, or
  discriminated variant before changing representation.
- **Equality:** value-class equality follows the wrapped value. Use another type
  when canonicalization or domain equality differs.
- **Java and reflection:** verify mangled methods, boxing, erased signatures,
  framework construction, and nullable or generic use.
- **Performance:** nullable, generic, interface, `Any`, and vararg positions can
  box value classes. Measure a proven hot path before trading away domain type
  safety.
- **Compatibility:** data-class property changes, destructuring order, `copy`,
  constructor visibility, and new sealed subtypes are observable API changes.

Do not expose raw wrapped values across a core module boundary merely for caller
convenience. Convert to transport primitives at the named outer adapter.

## Proof

Compile the affected public surface and exercise parsing, equality,
serialization, and interop behavior that the change can alter. For a negative
capability claim, prove that the prior invalid construction or operation is no
longer reachable.
