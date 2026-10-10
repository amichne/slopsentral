# Let The Program Remember

## Standard

When later behavior requires a fact, encode it in the representation that
behavior accepts. A parser establishes a stronger value; a consumer requires
that value. The parser cannot be omitted while leaving the consumer type-correct.
The representation must preserve the fact through transformations and transitions.

This reduces the space of incorrect programs that remain mechanically acceptable.
The compiler retains established obligations across edits, callers, and sessions.
Reasoning then concerns the unmet requirement, rather than reconstructing a fact
from a previous guard, naming convention, comment, or remembered call order.

## Choose A Representation That Carries The Proof

Prefer constructive representations. A non-empty collection can store a required
head and a tail. A finite domain can be an enum. A closed family can give each
case exactly its legal data. A transition can accept only the source-state type.
Adding a case must expose incomplete consumers through exhaustive handling.

An opaque type with a parser is useful when the language cannot express the
invariant structurally. Its guarantee depends on construction and mutation being
controlled. A type alias adds no barrier; a wrapper with an unchecked constructor
only changes the name; exposing a raw value to application consumers discards
the proof they need. Put operations with the invariant owner so callers can use
the stronger representation directly.

Preserve every consequential non-local fact. Tiny function-local observations
that never leave their reasoning context need no invented domain vocabulary.
This allowance does not permit primitive domain contracts or repeated checks
across application layers.

## Contract Before Implementation

Define the legal states, source and destination of each transition, required
facts, and closed expected outcomes before choosing operations. Required facts
belong in their owning case. Do not encode a family as a tag plus optional fields
or encode a failure through a nullable result, Boolean, arbitrary text, or exception.

Untrusted transport primitives enter an explicit parser or schema boundary.
Success materializes the required knowledge. Failure identifies a supported
condition and the data necessary to handle it. Unknown external behavior has
an explicit boundary outcome and cannot manufacture a success value.

Pure application decisions operate on the stronger model. I/O, mutation, clocks,
and process execution remain explicit capabilities. Serialize to primitives at
the adapter that owns the transport; preserve the domain contract on both sides
of that adapter.

## Proof Has A Scope

Compiler rejection establishes the encoded type obligation. It does not establish
the correctness of a parser body, a remote service, or mutable external state.
Schema rejection establishes the declared payload constraints, not agreement
with an external service or correctness of generated types. Explicit shell
control flow can prevent a later stage after failure; it supplies no static
type proof. Use focused evidence for each remaining obligation.

During review, trace the established fact to the consumer that requires it.
Identify where the representation stops carrying that fact. A textual pattern
alone cannot establish a defect; unresolved value flow or consumer requirements
are missing evidence. An incomplete review cannot establish absence of proof loss.

An authorization or resource witness is scoped to what it actually establishes:
principal, action, resource identity, version, and lifetime as applicable. Ordinary
Kotlin typestate does not make values linear or prove a capability is used once.
Filesystem names do not prove immutable bytes. Effects must establish new facts
at the boundary where they are needed and retain the outcomes.

## Review A Ratchet

Name the fact, its construction boundary, its consumer contract, and the misuse
the new representation excludes. Check transformation and construction escape
paths. A successful change removes the invalid composition, rather than moving
the same guard or adding a test around unchanged primitive ambiguity.

Use the Kotlin, API, and shell examples for the smallest representative proof.
Choose production checks from the consuming repository. Do not run every bundled
example for an unrelated edit or turn sample checks into a universal ceremony.

Alexis King's [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)
explains retaining established facts in types. [Names are not type safety](https://lexi-lambda.github.io/blog/2020/11/01/names-are-not-type-safety/)
distinguishes constructive representations from named wrappers.
