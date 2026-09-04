# Language-Agnostic Type-Driven Design Standard

## Scope

This standard applies to generated and hand-authored code. Use the strongest
local construct that makes domain meaning and invalid states mechanically
visible.

Inside a program, types are the preferred authority. At a boundary, use a named
schema, parser, generated model, constrained constructor, or equivalent
assertion. In a dynamic language, recover the same guarantees with module
encapsulation, opaque constructors, tagged records, exhaustive handlers, and
focused contract checks.

Language-specific examples live beside this file. Kotlin representations are in
`kotlin/`.

## Quick Use

1. Name the domain concept rather than its transport representation.
2. Identify its constrained values, legal alternatives, lifecycle phases,
   capabilities, expected failures, and intentional extension points.
3. Choose the representation with the smallest useful legal state space.
4. Put unchecked construction at the owning boundary and return a stronger
   value after a successful check.
5. Make changes to variants, invariants, and transitions fail loudly through
   compilation, schema validation, exhaustive handling, or a focused check.

## Representation Guide

| Domain fact | Preferred representation |
|---|---|
| Constrained scalar | Named refined, branded, opaque, or value type |
| Fixed labels | Enum, literal union, or closed enumeration |
| Fixed alternatives with case data | Discriminated sum, sealed hierarchy, tagged union, or closed schema union |
| Facts that must coexist | Product type, record, class, or closed object schema |
| Lifecycle phases | State-specific variants with explicit transitions |
| Expected success or failure | Closed result whose cases carry handling facts |
| Restricted operation | Capability-specific interface, token, module, or endpoint |

Transport shape is not domain shape. A string, number, boolean, null, list, or
object at the edge does not justify the same representation in trusted code.

## Principle 1: Model concepts, not carriers

Represent identifiers, quantities, permissions, modes, paths, versions, and
other domain values with named semantic types. Values that share a primitive
carrier but have different meaning or invariants must not be interchangeable by
default.

## Principle 2: Make illegal states and operations unrepresentable

Enumerate finite alternatives, put case-specific data on the case that owns it,
and remove operations from states or callers that cannot perform them. Use an
explicit unknown or external case only when forward compatibility is part of
the contract.

## Principle 3: Parse into stronger values

Unchecked input enters through a constructor, parser, factory, schema, or
generated decoder. Success must return a representation that records the
established invariant. Trusted code must not receive a raw value plus a
boolean, comment, call-order convention, or request to validate again.

## Principle 4: Handle closed alternatives exhaustively

Dispatch on typed variants rather than primitive tags. Adding a supported case
must force every consumer that promises complete handling to decide what it
means. Catch-all handling is reserved for an intentional open boundary.

## Principle 5: Give every rule one owner

Construction, encoding, defaults, transitions, discriminators, metadata, and
display rules each need one authoritative definition site. Derive other forms
from that owner when possible; do not synchronize parallel tables by memory.

## Principle 6: Keep effects and evolution explicit

Confine mutation, I/O, time, randomness, environment access, and external
capabilities to owned boundaries. Treat changes to valid values, variants,
failures, operations, and transitions as model changes even when syntax remains
compatible.

## Reference Map

- `kotlin/payment-method.kt`: finite variants and exhaustive behavior.
- `kotlin/value-construction.kt`: constrained construction.
- `kotlin/composite-encoding.kt`: one owner for encoding rules.
- `kotlin/config-value.kt`: typed dispatch over primitive tags.
- `kotlin/command-metadata.kt`: metadata attached to variants.
- `kotlin/email-display.kt`: deliberate wrapper display.

## Conflict Handling

If local instructions, generated schemas, compatibility limits, compiler
constraints, or runtime behavior conflict with this standard, do not weaken the
model silently. Name the conflict, preserve the strongest boundary assertion
available, and record the narrowest remaining invalid state or operation plus
its executable proof.

## Anti-Patterns To Reject

| Anti-pattern | Replace with |
|---|---|
| Primitive domain APIs | Named constrained values |
| String or integer dispatch | Closed typed variants |
| Tag plus optional-field soup | Fully discriminated case payloads |
| Boolean mode or permission flags | State variants, commands, or capabilities |
| Nullable lifecycle encoding | State-specific variants and transitions |
| Validate and return the same blob | Parse into a stronger value |
| Message-only routine failures | Closed failure cases with handling facts |
| Parallel metadata keyed by strings | Co-located or enforced registration |
| Hidden ambient mutation | Explicit state and effect boundaries |

## Self-Audit

- Can a caller construct a value the domain says is impossible?
- Does successful validation produce a stronger representation?
- Are finite alternatives discriminated and handled exhaustively?
- Are lifecycle operations available only in legal states?
- Are expected failures and capabilities explicit?
- Does each invariant, transition, default, encoding, and metadata fact have one
  owner?
- Are effects and compatibility changes visible at the boundary?
- Is there executable evidence for a legal case and a named rejected misuse?
