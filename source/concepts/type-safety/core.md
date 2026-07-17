# Language-Agnostic Semantic Design Standard

## Scope

This standard applies to generated and hand-authored code, schemas,
configuration, APIs, messages, persisted records, state machines, and other
models whose shape carries meaning. Use the strongest enforcement mechanism the
local language and paradigm provide.

Inside a program, types are the preferred authority. At a boundary, use a named
schema, parser, generated model, constrained constructor, or equivalent
assertion. In a dynamic language, use module encapsulation, opaque constructors,
tagged records, exhaustive handlers, and executable contract checks to recover
as much of the same guarantee as the runtime permits.

This concept owns the shared semantic rules. Language, schema, and tool-specific
skills own only their realization and proof. `schema-driven-design` applies
these rules to serialized and external boundaries. Kotlin, Pkl, OpenAPI, and
JSON Schema guidance must not redefine weaker local versions.

## Quick Use

1. Name the domain concept, its valid states, and the operations each state
   permits.
2. Classify it as a constrained value, product, finite sum, lifecycle,
   capability, success/failure outcome, or intentional open extension point.
3. Identify the untrusted representation and the boundary that turns it into a
   trusted value.
4. Choose the representation that admits the smallest legal state space.
5. Make construction, transitions, and elimination exhaustive or mechanically
   checked.
6. Prove both a legal example and a named illegal state or operation that the
   model rejects.

## Representation Guide

| Domain fact | Preferred representation |
|---|---|
| Constrained scalar | Named refined, branded, opaque, or value type with controlled construction |
| Fixed labels with no case data | Enum, literal union, or equivalent closed enumeration |
| Fixed alternatives with case data | Fully discriminated sum type, sealed hierarchy, tagged union, or closed schema union |
| Several facts that must coexist | Product type, record, class, or closed object schema |
| Lifecycle phases | Typestate or state-specific variants with explicit transition functions |
| Expected success or failure | Closed result union whose failure variants carry recovery-relevant facts |
| Operation available to only some values | Capability-specific interface, trait, protocol, token, module, or endpoint |
| Meaningful absence | Option or nullable value only when absence itself is a legal domain state |
| Intentional third-party extension | Explicit open boundary with a typed registration or unknown-variant policy |

Do not choose a weaker representation merely because the transport uses a
string, number, boolean, null, list, or object. Transport shape is not domain
shape.

## Enforcement Order

Prefer the earliest mechanism capable of rejecting misuse:

1. compile-time construction, capability, transition, and exhaustiveness checks;
2. schema, IDL, generated-model, or configuration-evaluation rejection;
3. private construction plus centralized parsing and transition APIs;
4. exhaustive runtime dispatch backed by focused invalid-state tests;
5. repeated ad hoc validation only when no stronger local mechanism exists.

Moving a check earlier is a semantic improvement only when the trusted value
that emerges is stronger. A validator that returns the same untyped blob has not
completed the trust transition.

---

## Principle 1: Model concepts, not carriers

Represent identifiers, quantities, permissions, modes, paths, versions, and
other domain values with named semantic types. Prevent values with the same
carrier representation from being exchanged accidentally.

**Rule:** If two values share a primitive representation but have different
meaning or invariants, they must not be interchangeable by default.

---

## Principle 2: Bound every known universe

When a concept has a finite known set of values or shapes, enumerate that set.
Do not represent a closed universe as free text, arbitrary integers, an open
map, or a convention documented elsewhere.

Distinguish a genuinely open extension point from a closed family that merely
might evolve. If compatibility requires accepting a future external variant,
model an explicit `Unknown` or `External` boundary case that preserves the raw
identity without pretending core behavior understands it.

**Rule:** A consumer should be able to discover the complete currently supported
universe from the model, not from scattered branches or documentation.

---

## Principle 3: Fully discriminate variant hierarchies

Every member of a finite family needs an unambiguous identity and only the data
legal for that member. Serialized variants require a mandatory discriminator
whose value maps to exactly one closed payload shape. Nested families put the
nested discriminator at the node that owns the choice.

Avoid flat records with a tag plus many optional fields. They admit mismatched
tags, irrelevant payloads, and combinations no real variant owns.

**Rule:** Given a value, both tools and readers must be able to determine exactly
one legal variant without inference from missing fields or field combinations.

---

## Principle 4: Make illegal states and operations unrepresentable

Design each type so every constructible value is meaningful. Split mutually
exclusive states, require facts on the variant that needs them, and remove
operations from values that cannot perform them.

Tests are still required for behavior, but a test should not be the only thing
preventing a state or operation the model can exclude.

**Rule:** If callers can assemble an impossible combination or invoke an invalid
operation and only then receive an error, the public model is too permissive.

---

## Principle 5: Parse into proof-carrying values

Treat CLI arguments, files, environment values, database rows, API payloads,
messages, configuration, and deserialized objects as untrusted. Parse once at
the owning boundary. Successful construction must return a value whose type or
encapsulation records that the invariant now holds.

Normalize during this transition. Do not pass a validated primitive or generic
object inward and rely on consumers to remember what was checked.

**Rule:** Trusted code accepts the proven representation, never the raw value
plus a separate boolean, comment, or validation convention.

---

## Principle 6: Represent lifecycle with typestate

When legal data or operations change across a lifecycle, represent phases as
distinct types or closed state variants. Transitions accept only their source
state and return their destination state. State-specific facts and operations
belong only to the state that supports them.

If the language cannot encode typestate statically, centralize construction and
transition functions over a closed tagged state and test the full transition
graph. Do not scatter state checks across methods.

**Rule:** Illegal transitions and phase-inappropriate operations should be
absent from the reachable API, not rejected by a late runtime guard.

---

## Principle 7: Use closed failure representations

Expected parse, validation, authorization, conflict, unsupported-variant,
transition, and recoverable dependency failures are domain outcomes. Represent
them as a bounded, discriminated family visible to callers. Each variant carries
the facts needed for handling, such as a field path, stable code, retryability,
conflict identity, or source cause.

Reserve exceptions, panics, or traps for defects, violated internal assertions,
resource exhaustion, or an established platform contract. When an external
system has an open error universe, translate it into closed local categories and
retain an explicit unexpected-external variant for diagnostics.

**Rule:** Callers must not discover routine failure modes by parsing messages,
catching a universal exception, or inspecting an undocumented status value.

---

## Principle 8: Encode capabilities, not permission flags

If only some callers, states, implementations, or resources may perform an
operation, expose that operation only through a capability-bearing value or
interface. Prefer separate commands or operations over booleans that switch
authorization, mode, mutability, retry, or lifecycle behavior.

**Rule:** Possessing the value required by an operation should be evidence that
the caller may attempt it; a primitive flag is not evidence.

---

## Principle 9: Eliminate closed variants exhaustively

Behavior over a closed family must account for every variant through compiler
exhaustiveness, schema/code-generation checks, or an equivalent mechanical
gate. Avoid catch-all branches that hide a newly added known variant.

Use a fallback only when forward compatibility is an explicit part of the
contract, and keep it distinct from handling known variants.

**Rule:** Adding a supported variant must force every consumer that promises
complete handling to make a deliberate decision.

---

## Principle 10: Give every invariant one owner

Construction, encoding, defaults, transitions, discriminators, metadata, and
display rules each need an authoritative definition site. Attach variant
metadata to the variant or use a registration point mechanically tied to the
definition. Derive serialized and displayed forms from the semantic model when
possible.

**Rule:** If a semantic change requires synchronized edits in disconnected
tables or branches and tooling cannot identify every site, ownership is split.

---

## Principle 11: Keep state and effects explicit

Prefer immutable values and pure transformations for domain rules. Confine
mutation, I/O, time, randomness, environment access, and external capabilities
to owned boundaries. Reflect effectful or state-changing operations in the API
rather than hiding them behind getters, global state, or ambient context.

**Rule:** A value's meaning and legal next operations must not depend on hidden
mutable or ambient state that its representation cannot express.

---

## Principle 12: Evolve the state space deliberately

Treat changes to variants, constraints, failure cases, transitions, and meaning
as model changes. Adding a variant can break exhaustive consumers. Widening a
constraint can admit states downstream code never handled. Keeping a name while
changing its meaning is still a breaking change.

Version, migrate, or introduce a new variant when meaning changes. Preserve an
explicit compatibility boundary rather than weakening the trusted core model.

**Rule:** Review compatibility in terms of newly constructible values,
operations, failures, and transitions—not merely unchanged syntax.

## Anti-Patterns To Reject

| Anti-pattern | Replace with |
|---|---|
| Primitive obsession | Named constrained domain values |
| String or integer dispatch | Closed typed variants |
| Tag plus optional-field soup | Fully discriminated variant payloads |
| Boolean mode or permission flags | Variants, commands, or capabilities |
| Nullable lifecycle encoding | Typestate or state-specific variants |
| Validate-and-return-the-same-blob | Parse into a proof-carrying value |
| Message-only or universal failure | Closed typed failure family |
| Runtime capability checks | Capability-specific APIs |
| Catch-all branch over known variants | Exhaustive elimination |
| Parallel metadata keyed by strings | Co-located or enforced registration |
| Scattered transition checks | One closed transition authority |
| Hidden ambient mutation | Explicit state and effect boundaries |

## Reference Map

Kotlin examples beside this file demonstrate realizations, not Kotlin-only
rules:

- `kotlin/payment-method.kt`: finite variants and exhaustive behavior;
- `kotlin/value-construction.kt`: constrained construction;
- `kotlin/composite-encoding.kt`: one owner for encoding rules;
- `kotlin/config-value.kt`: typed dispatch over primitive tags;
- `kotlin/command-metadata.kt`: metadata attached to variants;
- `kotlin/email-display.kt`: explicit wrapper display representation.

## Conflict Handling

If local instructions, generated schemas, compatibility limits, or runtime
constraints conflict with this standard, do not weaken the model silently.
Name the conflict, preserve the strongest boundary assertion available, and
choose the narrowest exception. Record which illegal states or operations remain
representable and how executable proof covers them.

## Self-Audit

Before accepting a model, verify:

- Can callers construct a value the domain says is impossible?
- Is every finite universe explicit and every concrete variant discriminated?
- Does every successful parse produce a stronger trusted representation?
- Are lifecycle states and transitions visible in the model?
- Are expected failures closed, typed, stable, and assertable?
- Are capabilities exposed only to values allowed to use them?
- Does adding a known variant force exhaustive consumers to update?
- Are absence, empty, blank, unknown, invalid, and failed distinct where needed?
- Does every invariant, transition, default, encoding, and metadata fact have one
  owner?
- Are effects and mutation explicit and confined?
- Is there executable evidence for a legal case and a named rejected misuse?
