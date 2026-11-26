---
type: Decision
title: PyYAML over a hand-rolled parser
description: The validator requires PyYAML instead of reimplementing YAML, for correctness and determinism.
tags: [decision, validator, pyyaml, yaml]
timestamp: 2026-06-16
---

# Decision: PyYAML over a hand-rolled parser

**Context.** Early versions of the [validator](/systems/validator.md) shipped a minimal,
stdlib-only YAML parser to avoid a dependency. An
[adversarial fuzzer](/decisions/adversarial-audit-process.md) kept finding inputs where the
hand-rolled parser **passed** frontmatter that real PyYAML **rejected** — a non-deterministic
verdict (pass locally, fail in CI).

**Decision.** Require **PyYAML**. If it is missing, the validator exits with a clear message
(code `2`) instead of guessing.

**Why.** Chasing byte-for-byte YAML parity by hand is a bottomless pit; a one-line
`pip install pyyaml` makes the verdict identical to every other OKF consumer's. Simpler,
correct, honest. General principle: prefer a ubiquitous library over reinventing it.

Affects the [conformance rules](/reference/conformance-rules.md) and the
[validator](/systems/validator.md).
