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
- Prefer `--timeout auto`, which uses the repository's shared duration profile,
  then clone-local run history, before falling back to 30 minutes. Read the
  resolved timeout in the arm result and override it deliberately when needed.
- Treat non-GitHub providers as external checks unless the repo has local
  tooling for them. Report their details URL rather than scraping unrelated
  systems.
- Fix root causes in code, tests, scripts, workflow YAML, or docs. Do not paper
  over failures by disabling checks unless the user explicitly asks and the risk
  is stated.
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
   Use `npx -y gh-axi api /user` to verify authenticated identity, then
   `npx -y gh-axi pr view`,
   `npx -y gh-axi pr checks`, `npx -y gh-axi run view`,
   `npx -y gh-axi run list`, and workflow YAML under `.github/workflows/` as
   appropriate.
   Capture the failing job name, command, error snippet, run URL, head SHA, and
   local file that owns the failing behavior. AXI's structured TOON response is
   the evidence source; the observer parses it into a typed snapshot:

   ```sh
   npx -y gh-axi pr checks <pr-number>
   python3 "<path-to-skill>/scripts/ci_wait_for_actions" --repo . \
     arm --pr <pr-number> --required --until status-change --timeout auto --json
   ```

3. Classify the failure.
   Separate product/test failures from CI-environment failures, dependency
   install failures, cache issues, permissions/secrets problems, flaky tests,
   generated-output drift, and release/tag mistakes.

4. Fix narrowly.
   Edit the owning source, test, generator, script, or workflow file. Preserve
   existing matrix, permissions, concurrency, cache, and artifact conventions
   unless they are the cause.

5. Validate.
   Run the local equivalent of the failing command. For workflow YAML changes,
   run `actionlint` when present, parse YAML with available tooling when not,
   and then re-read the relevant state through AXI. When the remote state is
   pending, arm `scripts/ci_wait_for_actions`, end the turn, and let the hook
   hold the wait. On continuation, process the event once; if work remains,
   arm a new baseline instead of manually rechecking an unchanged state.

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
- Load [release-flow.md](references/release-flow.md) for GitHub releases, tags,
  generated notes, artifacts, or release automation.

## Observer Commands

- `scripts/ci_wait_for_actions --repo . arm --run-id <id> --until
  status-change --timeout auto --json` records a baseline and arms one event.
- `scripts/ci_wait_for_actions --repo . arm --pr <number> --required --until
  terminal --timeout <30-3300> --json` watches required PR checks to terminal.
- `scripts/ci_wait_for_actions --repo . await --json` performs one bounded
  internal wait when the Codex hook is unavailable. Do not invoke it repeatedly.
- `scripts/ci_wait_for_actions --repo . status --json` inspects local armed
  state without a remote call.
- `scripts/ci_wait_for_actions --repo . profile show --json` explains the
  duration knowledge used by automatic timeout selection. `profile export`
  refreshes `.axi/github-actions-duration-profile.json` only when explicitly
  asked to share that knowledge with the repository.
- Exit codes are stable: `0` for a non-failing event, `1` for terminal failure,
  `2` for usage, dependency, or state error, and `124` for timeout.

## Completion Criteria

- The failing GitHub signal is identified with a run or check URL when
  available.
- The fix targets the owning source rather than masking the symptom.
- Local validation passed, or the missing environment/tool is stated.
- Remote checks were re-read through structured evidence, or the exact pending
  verification is documented.
