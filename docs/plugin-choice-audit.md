# Plugin Choice Audit

Reviewed 2026-09-16. The implementation replaces twelve peer choices with one
engineering default, eight specialties, and one advanced policy option. All 68
direct primitive references are preserved, with no duplicate plugin ownership.
The [catalog](../source/CATALOG.md) is generated from current manifests; the
[migration map](../source/MIGRATION.md) lists retired IDs.

## Acceptance evidence

- Software Engineering alone includes everyday design, tests, Git, shell safety,
  data queries, mise, issues, PRs, and CI. CLI authoring, completion, and terminal
  interfaces belong to CLI Development.
- Kotlin setup selects two plugins; IntelliJ setup selects three. Documentation
  selects Technical Writing alone. Knowledge generation and skill-read policy
  remain optional.
- Catalog validation rejects unknown selection roles, competing defaults,
  duplicate primitive owners, hidden dependency overlap, and copied payloads.
- Local edits and TDD no longer require publication. Git and PR skill triggers
  distinguish the requested end state; onboarding selects useful capabilities
  rather than treating marketplace discovery as an installation mandate.
- Existing routing and benchmark contracts retain their cases under the new
  owners. Added behavioral scenarios are unobserved until run against a model.

## Plugin Eval findings

Plugin Eval 0.1.2 was run against Codex output from pinned projeKtor v1.2.0.
The evaluator's package reports CLI version 0.1.0. These are static inspections,
not measured usage or live routing results. No live benchmark was executed.

The inspection identified three relevant limits:

1. It rejects `hooks` arrays because its manifest checker accepts only strings.
   The projector emits arrays of relative paths. OpenAI explicitly supports this
   shape in [plugin-bundled hooks](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks).
   Keep the valid projection; do not hand-edit generated output to satisfy an
   older heuristic.
2. Aggregate invocation estimates sum the discoverable skill bodies, while
   deferred estimates include bundled reference and executable text. Larger
   engineering bundles receive size warnings. These totals do not show what a
   particular task loads. Retain focused skill triggers and deferred references;
   do not split the user-facing bundle solely to improve this static score.
3. Hook-only policy receives a missing-skills finding. That plugin intentionally
   exposes enforcement, not a task skill, and remains outside default profiles.

CLI Development had no actionable static deductions. Software Engineering still
has aggregate budget and existing Python complexity warnings. Kotlin also has
heuristic trigger and size warnings; these are not measured routing failures.
Technical Writing retains pre-existing Python complexity and function-length
warnings. No coverage report was supplied, and missing coverage is not evidence
that repository tests failed.

Raw reports stay outside source control. Reproduce after projecting Codex output:

```sh
plugin-eval start /tmp/slopsentral-codex/.agents/plugins/software-engineering \
  --request 'Evaluate this plugin.' --format markdown
plugin-eval analyze /tmp/slopsentral-codex/.agents/plugins/software-engineering \
  --format json
```

## Design sources

[OpenAI best practices](https://learn.chatgpt.com/guides/best-practices) informed
focused triggers and proportionate checks. [Iterating development workflows](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)
informed reuse of existing owners and the distinction between intended behavior
and observed evidence. The bundle layout is a local design decision. See
[provenance](../source/UPSTREAM.md) for the adaptation boundaries.
