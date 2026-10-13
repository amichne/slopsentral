---
type: Reference
title: Test suite
description: A pytest suite covering the validator and the shared parser, including a regression test for the code-block link bug.
tags: [tests, pytest, ci, quality]
timestamp: 2026-06-16
---

# Test suite

The tooling ships a **pytest** suite at `scripts/tests/` (run `pytest`). It covers
[validate.py](/systems/validator.md) and [okf_common.py](/systems/okf-common.md):

- the code-block link **regression** — links inside ``` fences / inline code must be ignored;
- reference-style links, autolinks, and HTML `href` detected outside code;
- BOM / CRLF frontmatter;
- exit codes (0 / 1 / 2);
- the three [conformance rules](/reference/conformance-rules.md) and the reserved-file rules;
- producer lints (broken link, missing `.md`, orphan, missing recommended fields);
- path-normalization consistency between passes;
- a visualizer smoke test.

`pytest>=7` is a dev dependency. Added after the
[adversarial audit](/decisions/adversarial-audit-process.md) showed why tests were needed.
