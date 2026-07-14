---
name: "github-ci-operations"
description: "Use when GitHub Actions, PR checks, workflow YAML, dispatches, caches, artifacts, secrets, permissions, release pipelines, or CI logs need repair."
---

# GitHub CI Operations

Use this skill for GitHub-hosted workflow and CI work. Keep it focused on the
repository's actual workflows and logs; do not guess from generic CI patterns
when the live run, YAML, scripts, or package metadata can be inspected.

## Operating Contract

- Use `npx -y gh-axi` as the sole remote GitHub interaction surface. Do not
  substitute the legacy GitHub CLI, a GitHub MCP tool, or direct HTTP calls.
- Verify the repository and AXI authentication context before remote work.
- Use live PR checks, workflow runs, logs, annotations, and job summaries as
  evidence when debugging failures.
- Before waiting on GitHub Actions, arm the script-backed observer with one
  target, event predicate, and bounded timeout. Let the Codex `Stop` hook await
  internally; the model should process only a transition, terminal result,
  timeout, or error.
- Prefer `--timeout auto`; inspect its duration-informed choice and override it
  deliberately when needed.
- Treat non-GitHub providers as external checks unless the repo has local
  tooling for them. Report their details URL rather than scraping unrelated
  systems.
- Fix root causes in code, tests, scripts, workflow YAML, or docs. Do not paper
  over failures by disabling checks unless the user explicitly asks and the risk
  is stated.
- Treat workflow optimization as a dependency-graph and proof-equivalence
  change. Budget expanded task cardinality and modeled critical-path duration;
  do not infer performance from YAML line count or one runner observation.
- Ask before changing secrets, environment protection, deployment targets,
  release tags, or destructive workflow state.
- Re-run the smallest relevant local check first, then use GitHub checks to
  confirm remote behavior when available.

## Workflow

1. Resolve the target.
   Identify the repo, branch, PR number or URL, workflow file, run URL, and
   whether the user wants diagnosis, a fix, workflow authoring, release work, or
   publication.

2. Inspect live state.
   Use `npx -y gh-axi api /user` to verify identity, then the AXI `pr` and `run`
   commands plus workflow YAML under `.github/workflows/`.
   Capture the failing job name, command, error snippet, run URL, head SHA, and
   owning local file. Treat AXI's structured TOON response and the observer's
   typed snapshot as evidence.

3. Classify the failure.
   Separate product/test failures from CI-environment failures, dependency
   install failures, cache issues, permissions/secrets problems, flaky tests,
   generated-output drift, and release/tag mistakes.

4. Fix narrowly.
   Edit the owning source, test, generator, script, or workflow file. Preserve
   existing matrix, permissions, concurrency, cache, and artifact conventions
   unless they are the cause.

5. Validate.
   Run the local equivalent and `actionlint` for workflow changes when present.
   For dependency, matrix, cache, or startup-latency changes, run the deterministic
   workflow graph model and preserve the baseline proof-output set.
   Re-read through AXI. For pending state, arm the observer and yield; process
   one continuation and re-arm only if work remains.

6. Hand off.
   Summarize the failed signal, root cause, files changed, checks run, and any
   remote check still pending.

## Reference Routing

- Load [ci-failure-triage.md](references/ci-failure-triage.md) for failed PR
  checks, failing runs, log extraction, or rerun decisions.
- Load [event-driven-observation.md](references/event-driven-observation.md)
  when waiting, selecting an event predicate, choosing a timeout, inspecting
  evidence, or sharing duration knowledge.
- Load [actions-workflows.md](references/actions-workflows.md) when creating or
  editing `.github/workflows/*.yml`.
- Load [workflow-graph-optimization.md](references/workflow-graph-optimization.md)
  when changing `needs`, matrices, fan-out gates, Gradle/cache grouping, OCI
  image validation, or workflow/task cardinality.
- Load [release-flow.md](references/release-flow.md) for GitHub releases, tags,
  generated notes, artifacts, or release automation.

## Completion Criteria

- The failing GitHub signal is identified with a run or check URL when
  available.
- The fix targets the owning source rather than masking the symptom.
- Local validation passed, or the missing environment/tool is stated.
- Remote checks were re-read through structured evidence, or the exact pending
  verification is documented.
