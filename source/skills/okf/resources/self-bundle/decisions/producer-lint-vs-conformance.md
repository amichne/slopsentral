---
type: Decision
title: Producer lints vs conformance errors
description: The validator separates the three hard conformance rules (errors) from quality lints (warnings).
tags: [decision, conformance, lint, validator]
timestamp: 2026-06-16
---

# Decision: producer lints vs conformance errors

**Context.** Broken links and missing `index.md` are common quality issues — but the OKF spec
says **consumers must tolerate them**, so they are *not* conformance violations.

**Decision.** The [validator](/systems/validator.md) reports only the three hard
[conformance rules](/reference/conformance-rules.md) as `ERROR`, and reports broken links,
missing-`.md` links, orphans, and missing recommended fields as producer `LINT` (under
`--strict`), with a note that lints are not spec violations.

**Why.** It keeps "is this valid OKF?" (a hard yes/no) distinct from "is this a high-quality
bundle?" (producer guidance), so users never mistake a quality nit for a spec violation.
