---
type: Decision
title: Adversarial multi-agent audit
description: The validator and skill were hardened by repeated independent multi-agent audits that tried to break them.
tags: [decision, audit, testing, quality]
timestamp: 2026-06-16
---

# Decision: adversarial multi-agent audit

**Context.** A tool that ships an OKF [validator](/systems/validator.md) has to actually be
correct. Single-pass, manual testing missed cases.

**Decision.** Harden it with **independent, adversarial multi-agent audits**: agents that test
functionality, check the skill against the official OKF spec, judge real-world usefulness, and
red-team the validator — followed by deterministic dual-mode tests (with and without PyYAML)
over fuzzed inputs.

**Why.** Each round surfaced real defects single-pass testing missed — e.g. the parser
non-determinism that led to [requiring PyYAML](/decisions/pyyaml-over-hand-rolled.md), and gaps
in the [conformance rules](/reference/conformance-rules.md). Findings were verified by
reproduction, not trusted on claim.
