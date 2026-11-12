# Python proof boundaries

Use frozen, slotted dataclasses for immutable records, Enum or Literal for finite
vocabulary, unions for case-specific outcomes, Protocol for explicit capabilities,
and `assert_never` for exhaustive elimination. A NewType separates identities
statically but does not validate a value. Parse unknown JSON through `object`
and structured shape checks; never pass Any into the core.

A private implementation and public parser narrow construction authority; Python
privacy is a checked convention, not an unforgeable capability. Keep mutation,
reflection, deserialization, and foreign code outside the trusted core. A frozen
dataclass does not freeze nested mutable containers. Prefer tuples and immutable
members. Test constructors and parsers at runtime where static proof ends.

Domain failures are union cases, not exceptions. A documented OSError at a file
adapter can become Unreadable; a parser returns InvalidInput. Do not catch
Exception to hide a broken invariant. Programmer defects remain defects and
must terminate verification. Preserve KeyboardInterrupt and cancellation.
Closure purity is enforced through explicit signatures, review, and tests that
forbid capability calls on rejected paths; Python cannot prove it statically.

Tests should cover boundaries and laws: valid and invalid values, each failure,
exhaustive mapping, retained failure identity, and no effect after rejection.
The template has a negative type fixture that must fail for the intended Pyright
rule. A process failure or missing import is not a successful negative check.
