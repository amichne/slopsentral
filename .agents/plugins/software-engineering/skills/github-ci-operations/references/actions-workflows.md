# GitHub Actions Workflows

Use this reference when creating or editing `.github/workflows/*.yml`.

## Discovery

- Read all relevant workflow files before adding a new one.
- Inspect package scripts, build files, lockfiles, Dockerfiles, release scripts,
  and repo docs to find the real validation commands.
- Reuse existing action versions, setup conventions, and cache style unless
  they are stale or broken.
- Check whether workflows run on `pull_request`, `push`, `workflow_dispatch`,
  tags, schedules, or reusable `workflow_call`.

## Workflow Shape

- Give each workflow a narrow purpose: CI, release, docs, deploy, or scheduled
  maintenance.
- Draw the expanded task graph before editing YAML. Treat every matrix cell and
  reusable-workflow invocation as a separate execution node, and make each
  `needs` edge name a proof or artifact the consumer actually requires.
- Fan out after the cheapest deterministic preflight. Keep toolchain installs,
  compilation, packaging, and network-heavy work out of a shared fan-out gate
  unless every downstream job consumes that work.
- Join only at the consumer that requires all joined outputs. A required job may
  remain independently required without becoming an unrelated consumer
  dependency.
- Prefer reusable workflow boundaries (`workflow_call`) or versioned repo
  scripts when multiple workflows need the same setup, validation, or
  publication logic.
- Use explicit `permissions`; start with read-only and add write scopes only
  for jobs that need them.
- Use `concurrency` for branch or deployment workflows where duplicate runs are
  wasteful or risky.
- Use matrix jobs for supported versions or platforms; avoid copy-pasted jobs.
- Split a matrix behind reusable workflow calls when a consumer needs one
  matrix cell rather than the whole matrix. Depending on one matrix job is a
  join over every expanded cell, including unrelated slow platforms.
- Use package-manager setup actions with built-in caching when available.
- Upload artifacts only when a later job, release, or human debugging path uses
  them.
- Keep secrets in GitHub secrets or environments, never in workflow files.
- Prefer OIDC for cloud deployment when the repo already supports it.

## Editing Rules

- Change the smallest workflow surface that owns the behavior.
- Keep shell snippets short; move complex logic into versioned scripts.
- Keep reusable CI scripts provider-neutral when practical, then call them from
  GitHub Actions, hooks, or local validation with explicit arguments.
- Pin third-party actions to stable versions already used by the repo, or
  explain a version change.
- Do not disable a required check to get a green PR unless the user asks and the
  replacement gate is clear.

## Validation

- Run `actionlint` when installed.
- If no workflow linter exists, at least parse YAML with local tooling and check
  indentation, event filters, permissions, expressions, and referenced scripts.
- Run the commands invoked by the changed jobs locally when practical.
- For graph or latency changes, use the deterministic model described in
  [workflow-graph-optimization.md](workflow-graph-optimization.md). Gate on
  median-modeled critical path and proof-output equivalence; keep observed mean
  and runner wall time as report evidence.
- Run `python3 source/skills/shell-script-safety/scripts/check_shell_safety`
  on touched Bash CI scripts and `bash -n` on the same scripts.
- For docs or generated-output jobs, run the generator before local tests.
