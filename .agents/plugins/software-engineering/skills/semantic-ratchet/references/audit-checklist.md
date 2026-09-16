# Audit Checklist

## Find Proof Loss

- Which public or non-local functions return raw primitives, ambiguous nulls,
  untyped maps, booleans, or free-form status values?
- Which successful checks leave later code holding the original weak value?
- Which callers must remember prior validation, authorization, resolution,
  normalization, or call order?
- Which repeated guards enforce the same invariant?
- Which finite states, failures, roles, modes, or transitions are encoded as
  strings, flags, optional fields, or messages?

## Record Each Finding

Name the fact being asserted, where it is lost, the boundary it crosses, the
smallest representation that preserves it, and the compiler, type checker,
schema, exhaustive handler, or focused test expected to reject the old misuse.

## Acceptance Standard

Prefer a fix that changes the contract so old invalid calls stop compiling or
validating. Moving a check, adding comments, or adding tests while preserving the
same primitive ambiguity is not a completed ratchet.
