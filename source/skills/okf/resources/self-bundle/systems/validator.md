---
type: Module
title: validate.py
description: PyYAML-backed checker that enforces the three hard OKF conformance rules and reports producer lints.
tags: [validator, python, pyyaml, conformance]
timestamp: 2026-06-16
---

# validate.py

The validator enforces the OKF [conformance rules](/reference/conformance-rules.md) and, with
`--strict`, reports producer lints. It parses via the shared
[okf_common.py](/systems/okf-common.md) module.

```
python scripts/validate.py <bundle>            # conformance (CI gate)
python scripts/validate.py <bundle> --strict   # + producer lints
```

- **Default (errors, exit 1):** every non-[reserved](/reference/reserved-files.md) `.md` has
  parseable frontmatter; a non-empty string [`type`](/reference/frontmatter-fields.md); and
  reserved files follow their structure.
- **`--strict` (producer lints, exit 1):** broken links, links missing `.md`, orphan concepts,
  missing `title`/`description`. These are quality lints, **not** spec violations — see
  [producer lints vs conformance errors](/decisions/producer-lint-vs-conformance.md).
- **Code-aware links:** link checks ignore links inside ``` fences and inline code (via
  `okf_common.strip_code`), and the broken-link and orphan passes normalize paths consistently.
- Exit `2` if PyYAML is missing — it refuses to guess. See
  [PyYAML over a hand-rolled parser](/decisions/pyyaml-over-hand-rolled.md).

Covered by the [test suite](/reference/testing.md) and hardened through an
[adversarial multi-agent audit](/decisions/adversarial-audit-process.md).
