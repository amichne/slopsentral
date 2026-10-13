# Refactor Playbook

## 1. Find The Proof

Locate parsing, validation, normalization, authorization, lookup, lifecycle,
non-empty, uniqueness, persistence, or readiness checks. Inspect every caller
that depends on the established fact.

## 2. Name The Stronger Representation

Choose the smallest artifact that carries the proof: a constrained value,
closed result, capability, state-specific value, or constrained collection. Use
domain language instead of generic proof wrappers when the domain has a clear
name.

## 3. Move Construction To The Boundary

Put parsing and construction at the adapter, protocol, repository, or module
entry point. Each successful step should return a value downstream code could
not have created accidentally.

## 4. Break Weak Callers Intentionally

Change the contract first when possible. Let mechanical errors identify callers
that still assume the weaker world, then carry the proof forward. Do not add
casts, unchecked public constructors, null assertions, default branches, or
immediate primitive extraction as escape hatches.

## 5. Verify The Ratchet

Run the narrowest compile, type-check, schema, or test command. Confirm the weak
boundary is gone, complete handlers cover every known case, valid behavior still
works, and the original misuse now fails at the intended enforcement boundary.
