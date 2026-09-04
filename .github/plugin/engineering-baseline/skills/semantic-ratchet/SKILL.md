---
name: semantic-ratchet
description: Use when validation, authorization, normalization, or state checks produce facts later code must retain. Replace primitive contracts, flags, sentinel states, string protocols, and call-order conventions with proof-carrying values in any language.
---

# Semantic Ratchet

Make established facts durable. A successful parse, validation, authorization,
lookup, normalization, or precondition check should normally return a
representation that carries the fact forward.

## Operating Contract

- Keep tiny, obvious, function-local facts local when they do not escape.
- Preserve non-local facts by default and cross-boundary facts by requirement.
- Treat primitive boundary inputs as untrusted; parse or wrap them before core
  logic receives them.
- Use the strongest local mechanism: static types, schemas, opaque construction,
  closed tagged values, module APIs, or focused contract checks.
- Choose the smallest model that prevents the named misuse. Do not add generic
  type machinery without a concrete invariant.
- Do not cast, suppress, weaken types, expose unchecked construction, or unpack
  a stronger value immediately to route around mechanical rejection.

## Workflow

1. Name the fact being established: validity, normalization, authorization,
   resolution, lifecycle phase, non-empty collection, external protocol value,
   or domain outcome.
2. Find where the fact is lost and classify the scope as local, non-local, or a
   public, module, service, storage, or repository boundary.
3. Choose the narrowest proof carrier: constrained value, closed variant or
   result, capability, state-specific value, constrained collection, schema, or
   generated model.
4. Change the contract so the old invalid call, state, or transition fails at
   the earliest available enforcement boundary.
5. Update callers by carrying the stronger value forward rather than recreating
   the primitive representation.
6. Prove one legal path and one named misuse with compilation, type checking,
   schema validation, exhaustive handling, or the smallest focused test.

## Reference Routing

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

- The established fact survives in the value or contract that crosses its
  boundary.
- The previously representable misuse fails mechanically or at the earliest
  available assertion boundary.
- Valid behavior still passes the narrowest relevant executable check.
