# Evaluation Scaffold

Use this reference when a skill needs evidence that it improves behavior or
when overlapping skills are being consolidated.

## Durable Assets

Inspect the repository's existing eval owner and runner before adding assets.
Extend that case set instead of introducing a second catalog, campaign runner,
or promotion-history framework for the same claim. Use promptfoo when it is
the established runner; keep authored cases, expected answers, and graders in
their current source owners and use the existing report format.

Keep stable case IDs, source provenance, independent expected outcomes, and
nearby scope controls. Supply routed references explicitly when a decision
depends on them, and record their content identities with the skill and prompt.
Keep expected answers and grading rationale outside the model's prompt.

Transient benchmark workspaces, review HTML, raw model outputs, and scratch
feedback should live outside the packaged skill.

## Evidence Levels

Offline controls prove harness acceptance and rejection, not model behavior.
A supplied-text decision suite measures choices, not automatic skill discovery,
tool use, edits, or runtime effects. Execution claims require disposable fixtures,
actual tool traces, and independent assertions at the requested interface.
Do not turn historical results or rubric checklists into fresh model responses.
Preserve historical audits and missing evidence when adapting their decisions
to the shared runner; the adaptation does not supersede the execution record.

## Case Lifecycle

- `candidate`: newly added and not yet trusted.
- `holdout`: stable enough to block obvious regressions.
- `core`: permanent non-regression gate.
- `retired`: kept for history but no longer active.

Promote cases only after successful accepted runs. Do not claim improvement by
removing hard cases.

## Benchmark Shape

For each case, compare the candidate skill against an explicit baseline:

- `with_skill` against `without_skill`;
- `candidate_skill` against `old_skill`;
- `consolidated_skill` against one or more legacy siblings;
- named model variants when model portability matters.

Keep per-case metadata with the run artifacts so aggregate reports can join
outputs back to stable case ids.

## Consolidation Proof

A consolidated skill is stronger only when evidence shows it covers the useful
legacy behavior with less overlap. The proof should show:

- the legacy skills or sources being replaced;
- the union of cases or representative prompts;
- the candidate result compared with each baseline;
- any tolerated regression and why it is acceptable;
- the retained provenance for future cleanup.
