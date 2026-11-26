---
type: Reference
title: Conformance rules
description: The three hard rules that make an OKF bundle valid, versus the producer lints.
tags: [conformance, spec, validation, lint]
timestamp: 2026-06-16
---

# Conformance rules

A bundle is conformant when **all three hard rules** hold (checked by default by the
[validator](/systems/validator.md), reported as `ERROR`):

1. Every non-[reserved](/reference/reserved-files.md) `.md` file opens with a parseable YAML
   [frontmatter](/reference/frontmatter-fields.md) block.
2. That frontmatter has a **non-empty string `type`**.
3. [Reserved files](/reference/reserved-files.md) follow their structure (no `type`; only the
   root `index.md` may carry frontmatter, and only `okf_version`).

## Producer lints (not conformance)

`--strict` additionally reports **producer lints** as `LINT`: broken intra-bundle links, links
missing `.md`, orphan concepts, and missing recommended fields. Per the spec, **consumers must
tolerate** these — they are quality signals for the *producer*, **not** spec violations. See
[producer lints vs conformance errors](/decisions/producer-lint-vs-conformance.md).

Stress-tested in the [adversarial audit](/decisions/adversarial-audit-process.md) and covered by
the [test suite](/reference/testing.md).
