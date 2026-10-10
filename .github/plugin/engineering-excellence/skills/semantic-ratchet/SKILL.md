---
name: semantic-ratchet
description: Use when validation, authorization, normalization, or state checks produce facts later code must retain. Replace primitive contracts, flags, sentinel states, string protocols, and call-order conventions with proof-carrying values in any language.
---

# Semantic Ratchet

Make established facts durable. A successful parse, validation, authorization,
lookup, normalization, or precondition check must return a representation that
carries the fact forward whenever later behavior requires it. The type system
remembers established knowledge; callers reason only about remaining obligations.

## Operating Contract

- Keep tiny, obvious, function-local facts local when they do not escape.
- Preserve non-local facts by default and cross-boundary facts by requirement.
- Treat primitive boundary inputs as untrusted; parse or wrap them before core
  logic receives them.
- Require proof in consumer contracts. Domain meaning must have a type; a name,
  alias, unchecked wrapper, prior guard, or comment cannot substitute for an invariant.
- Prefer intrinsic representations, such as a head plus tail for a non-empty
  collection, and closed case-specific shapes over wrappers that expose raw values.
- Parse into stronger values or closed typed failures at ingress. Expected
  failures must not use null, Boolean, sentinel, free text, or exception protocols.
- Keep discharged input checks out of application layers. Put pure decisions
  with their invariant owner; make effects and any new proof obligations explicit.
- Delegate encoding and format selection to output adapters through a shared
  serialization abstraction. Domain types do not own encoding methods.
- Use the strongest local mechanism: static types, schemas, opaque construction,
  closed tagged values, module APIs, or focused contract checks.
- Choose the smallest model that prevents the named misuse. Do not add generic
  type machinery without a concrete invariant.
- Do not cast, suppress, weaken types, expose unchecked construction, or unpack
  a stronger value immediately to route around mechanical rejection.

## Workflow

Choose the authorized mode first. For design or read-only review, inspect and
describe the required representation and proposed rejection check without edits
or execution beyond the requested scope. For implementation, inspect current
owners, contracts, callers, and tests before choosing reuse, extend, or add.
Verified reuse may satisfy the requirement without inventing a new type.

1. Name the fact being established: validity, normalization, authorization,
   resolution, lifecycle phase, non-empty collection, external protocol value,
   or domain outcome.
2. Find where the fact is lost and classify the scope as local, non-local, or a
   public, module, service, storage, or repository boundary.
   Trace value identity and callers where available. Report proof loss when a
   consumer requires an established fact that its input contract no longer
   carries. If the consumer obligation or value flow is unresolved, name the
   missing evidence instead of claiming a proven defect.
3. Choose the narrowest proof carrier: constrained value, closed variant or
   result, capability, state-specific value, constrained collection, schema, or
   generated model.
4. For authorized implementation, change the contract so the old invalid call,
   state, or transition fails at the earliest available enforcement boundary.
5. For authorized implementation, update callers by carrying the stronger value
   forward rather than recreating the primitive representation.
6. Prove one legal path and one named misuse with compilation, type checking,
   schema validation, exhaustive handling, or the smallest focused test.
   State which obligation each result proves, the trusted construction boundary,
   and unresolved effect or model limits. A typed capability alone does not prove
   single use, fresh authorization, or immutable external state.

## Reference Routing

- Read [proof-discipline.md](references/proof-discipline.md) when establishing
  the engineering standard, choosing a proof mechanism, or distinguishing
  constructive modeling from named wrappers.
- Read [kotlin-proof-example.md](references/kotlin-proof-example.md),
  [api-proof-example.md](references/api-proof-example.md), or
  [shell-proof-example.md](references/shell-proof-example.md) for a representative
  realization and its legal-path and forbidden-path checks. Use the relevant
  language or contract skill for production syntax and tool selection.
- Read [domain-values.md](references/domain-values.md) for constrained
  primitives, normalization, non-empty values, and compact domain vocabulary.
- Read [closed-outcomes.md](references/closed-outcomes.md) for finite variants,
  exhaustive handling, expected failures, and external unknown cases.
- Read [state-and-capability-modeling.md](references/state-and-capability-modeling.md)
  for lifecycle protocols, authorization, and discharged preconditions.
- Read [module-boundaries.md](references/module-boundaries.md) for public APIs,
  services, repositories, adapters, generated models, or persistence seams.
- Read [audit-checklist.md](references/audit-checklist.md) when reviewing code or
  planning a ratchet.
- Read [refactor-playbook.md](references/refactor-playbook.md) when implementing
  the change.

## Ownership Boundary

This skill owns the language-agnostic proof-preservation workflow. Language,
schema, framework, and repository-specific skills own syntax, tool selection,
and local verification commands.

## Completion Criteria

- Design or review names the fact, consumer obligation, representation,
  proposed rejection check, and evidence limits within the authorized scope.
  Implementation completion additionally requires the following observed results.
- The established fact survives in the value or contract that crosses its
  boundary.
- The previously representable misuse fails mechanically or at the earliest
  available assertion boundary.
- Valid behavior still passes the narrowest relevant executable check.
- Results retain the exact proof boundary. Proposed cases, static fixtures,
  observed compiler/schema results, and model behavior remain distinct.
