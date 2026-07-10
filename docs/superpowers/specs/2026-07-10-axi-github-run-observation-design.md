# AXI GitHub Run Observation Design

## Objective

Make `git-ci-operations` observe GitHub Actions without model-driven polling.
After an agent identifies a pending workflow run or PR check set, it can arm a
bounded observation and end its turn. A Codex `Stop` hook waits silently until
the requested event occurs, then continues the model once with a compact,
structured status update.

All remote GitHub interaction owned by this plugin must go through
`npx -y gh-axi`. Direct `gh` commands and GitHub MCP calls are outside the
plugin's supported interaction boundary.

## Scope

This change is owned entirely by the authored `slopsentral` source graph. It
does not modify the upstream `gh-axi` repository or generated provider trees.

In scope:

- run and PR-check observation after creation or discovery;
- event predicates selected by the agent;
- invocation-time wait limits, including a duration-informed `auto` value;
- clone-local raw duration history and an explicitly refreshed team profile;
- Codex hook wiring that resumes the model only for a meaningful event;
- migration of the composed git plugin from raw `gh` guidance to `gh-axi`;
- deterministic tests, routing cases, benchmark expectations, and fresh
  materialization proof.

Out of scope:

- changing how GitHub Actions emits events;
- adding a webhook relay or long-lived background service;
- changing `gh-axi` itself;
- automatically committing duration data after every workflow run;
- claiming that a Codex hook is an absolute security boundary.

## Constraints Established By The Audit

- `gh-axi` 0.1.26 provides `run watch`, but it waits only for terminal
  completion and does not expose an event predicate, timeout, or duration
  profile.
- Codex command hooks are synchronous. Asynchronous command hooks are parsed
  but skipped, so the design must not depend on a background callback.
- A `Stop` hook may return `decision: "block"` with a reason. Codex then creates
  a continuation prompt, which provides the required model wake-up boundary.
- `PreToolUse` interception is incomplete for some unified shell execution, so
  it is a guardrail and routing aid rather than the sole enforcement mechanism.
- The source manifest already owns the required interface URLs. The audit's
  initial 53/F result came from the stale Homebrew `intelligence` v0.2.3
  materializer. The current development materializer preserves the URLs and
  produces a 95/A plugin. This repository must validate current authored source
  and fresh provider output; it must not patch generated manifests.

Primary references:

- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [`gh-axi`](https://github.com/kunchenguid/gh-axi)

## Architecture

The feature has three independently testable units.

### AXI observation primitive

`source/skills/github-ci-operations/scripts/ci_wait_for_actions` remains the
stable executable entrypoint but is rewritten around `gh-axi`. It owns:

- target discovery for one run or one PR check set;
- TOON scalar parsing for the small set of fields returned by `gh-axi`;
- event classification and bounded backoff;
- active-request state, raw observation history, and duration statistics;
- structured evidence emitted once per meaningful event;
- duration-profile import and export.

The executable must never invoke `gh` directly. Tests inject the command runner
and assert that every remote GitHub command starts with
`npx -y gh-axi`.

### Provider-neutral hook adapter

`source/hooks/github-actions-await.py` reads Codex lifecycle JSON at its edge
and delegates all observation behavior to the skill script. It owns no GitHub
business logic.

The neutral hook metadata declares a dependency on
`github-ci-operations`. The Codex adapter wires two lifecycle events:

- `Stop` waits for an armed request and resumes the model after an event;
- `PreToolUse` denies obvious raw `gh` observation commands and supplies a
  concise instruction to use the AXI observer.

The `PreToolUse` handler must not rewrite arbitrary shell commands. A denial is
safer than attempting to preserve quoting or pipelines while substituting a
different command.

### Skill and plugin routing

`github-ci-operations` remains the canonical CI owner. Its main `SKILL.md`
stays a compact router; command details, state contracts, and recovery behavior
live in one focused reference. `pull-request-lifecycle` composes the observer
instead of defining another waiting loop.

The `git-ci-operations` plugin references the hook primitive by source-graph
reference. No hook payload is copied into the plugin directory.

## Command Contract

The observation script exposes these commands:

```text
ci_wait_for_actions arm (--run-id ID | --pr VALUE)
  [--until status-change|terminal]
  [--timeout auto|SECONDS]
  [--required]

ci_wait_for_actions await [--json]

ci_wait_for_actions status [--json]

ci_wait_for_actions profile show [--json]
ci_wait_for_actions profile export [--output PATH]
```

`arm` performs an initial AXI observation, records it as the baseline, and
writes one active request. It returns immediately with the selected predicate,
resolved timeout, target identity, baseline state, and state path.

`await` is silent while nothing changes. It returns exactly once when:

- `status-change`: the stable state key differs from the armed baseline;
- `terminal`: the target reaches success or failure;
- the configured timeout expires;
- an authentication, parsing, target, or command error makes further waiting
  unsafe.

The existing exit-code contract is preserved:

- `0`: requested event occurred and the observed outcome is not failure;
- `1`: requested event occurred with a terminal failure;
- `2`: usage, dependency, authentication, parsing, or state error;
- `124`: timeout with the latest known state preserved.

Only one request may be armed per Git worktree. A new `arm` command fails with
an actionable message while an active request exists; it never silently
replaces another observation.

## State And Duration Data

Runtime state is stored using `git rev-parse --git-path axi/github-actions` so
linked worktrees receive the correct Git-owned location without adding
worktree noise.

The directory contains:

- `active.json`: the single armed request and baseline;
- `last-observation.json`: the most recent completed event or timeout;
- `history.jsonl`: append-only terminal run samples.

Each terminal sample records:

- repository and workflow identity;
- run ID and attempt;
- event and conclusion;
- `run_started_at` and `updated_at` from
  `npx -y gh-axi api /repos/{owner}/{repo}/actions/runs/{id}`;
- computed duration seconds;
- observation timestamp and schema version.

Cancelled and startup-failure samples remain in history for diagnosis but do
not influence automatic timeout selection.

The optional team profile defaults to
`.axi/github-actions-duration-profile.json`. It is written only by
`profile export`, never by the hook. The generated document is deterministic,
versioned, and grouped by repository, workflow, and event. Each group includes
sample count, p50, p95, maximum duration, and last observation time.

Raw history is clone-local. The compact profile is the deliberate,
reviewable repository knowledge surface. Teams may commit it when the sample
set is representative; normal CI observation does not dirty the worktree.

## Automatic Timeout Selection

The agent may pass an integer timeout between 30 and 3300 seconds. The upper
bound leaves room beneath the Codex hook's fixed 3600-second command timeout.

`--timeout auto` resolves in this order:

1. Use a matching checked-in team profile when it has at least five samples.
2. Otherwise use matching clone-local history when it has at least five
   eligible samples.
3. With one to four samples, use twice the longest eligible duration plus
   60 seconds.
4. With no samples, use 1800 seconds.

For five or more samples, the recommended timeout is p95 multiplied by 1.5,
plus 60 seconds. Every automatic result is clamped to 300 through 3300 seconds.
The `arm` result states the selected value, formula source, sample count, and
duration statistics so the model can override it deliberately.

## Hook Data Flow

1. The agent uses `npx -y gh-axi` to create or discover a workflow run or PR.
2. The agent calls `ci_wait_for_actions arm` with the target, predicate, and
   timeout choice.
3. The agent completes any unrelated local work and attempts to stop.
4. The `Stop` hook finds the active request and invokes `await` silently.
5. The observer polls only inside the hook process with bounded exponential
   backoff. No unchanged state is returned to the model.
6. On the requested event, timeout, or error, the observer writes evidence and
   clears `active.json` atomically.
7. The hook returns `decision: "block"` with one compact reason containing the
   target, previous state, new state, outcome, elapsed time, timeout source, and
   evidence path.
8. Codex continues the model once. On the next `Stop`, no active request exists,
   so the hook allows the turn to end.

For `status-change`, a still-pending transition is intentionally returned to
the model. The model may process that transition and arm another wait. This
spends tokens per meaningful state change rather than per poll.

## Failure Handling

- Missing `npx`, Node.js, `gh-axi`, Git repository context, or GitHub
  authentication produces exit `2` with an exact recovery command.
- Malformed AXI output is a hard parse error. The observer records a redacted
  output prefix and does not guess a state.
- Transient command failures use at most three internal retries with bounded
  backoff. Authentication and validation failures are not retried.
- Timeout records the latest observation, clears the active request, and wakes
  the model with exit `124` semantics.
- Failure-log collection happens only after terminal failure and uses
  `npx -y gh-axi run view <id> --log-failed`. Long logs rely on the AXI
  `full_log` handoff rather than being copied into hook output.
- State files use write-to-temp plus atomic rename. A corrupt state file is
  preserved with a `.corrupt-<timestamp>` suffix before returning an error.
- Hook output contains no repository secrets, tokens, environment dumps, or
  full workflow logs.

## AXI-Only Boundary

The authored plugin surface will remove direct `gh` examples and helpers from:

- `github-ci-operations`;
- `pull-request-lifecycle`;
- other skills composed by `git-ci-operations` where GitHub examples appear;
- routing fixtures and plugin benchmark expectations.

The plugin may use local `git` commands for repository state. `gh-axi` itself
may depend on an authenticated `gh` installation internally; that dependency
does not authorize the agent or plugin scripts to invoke raw `gh`.

The `PreToolUse` hook protects the common Bash path, and deterministic tests
scan the composed authored surface for raw GitHub CLI commands. The completion
claim remains bounded: current Codex hooks are a guardrail, not a complete
cross-tool policy sandbox.

## Test Strategy

Development follows red-green-refactor slices.

Unit tests cover:

- AXI command construction and the prohibition on direct `gh`;
- TOON scalar parsing for run, PR-check, API, and failure-log output;
- state-key changes and terminal classification;
- explicit and automatic timeout selection at every sample threshold;
- exclusion of cancelled and startup-failure durations;
- atomic state transitions and corrupt-state recovery;
- transition-only evidence and existing exit codes;
- `Stop` hook allow, wait, continuation, timeout, and error outputs;
- `PreToolUse` denial for raw polling and allowance for `gh-axi`;
- deterministic profile export.

Integration tests use fake `npx` and `gh-axi` executables to exercise the
installed file layout without touching GitHub. One opt-in live smoke test may
observe an already-terminal public run through `gh-axi`; it is report-only and
not a deterministic gate.

Source-graph and marketplace validation must include:

```sh
python3 -m unittest discover -s source/skills/github-ci-operations/scripts/tests
python3 -m unittest discover -s source/hooks/tests
python3 -m py_compile source/skills/github-ci-operations/scripts/ci_wait_for_actions
python3 -m py_compile source/hooks/github-actions-await.py
node source/tools/validate-source-graph.mjs
python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin git-ci-operations
intelligence validate --repo /Users/amichne/code/slopsentral --portable
intelligence marketplace materialize --repo /Users/amichne/code/slopsentral --provider all --out /tmp/slopsentral-marketplace
intelligence validate --repo /Users/amichne/code/slopsentral --portable --hydrated /tmp/slopsentral-marketplace
git diff --check
```

The current development `intelligence` checkout is additionally used to verify
that Codex provider output retains interface URLs and that `plugin-eval`
reports at least 95/A with no structural failures. Any divergence from the
released Homebrew CLI is reported rather than hidden by editing generated
output.

## Acceptance Criteria

- No owned remote GitHub operation in the composed git plugin invokes raw
  `gh` or a GitHub MCP tool.
- A run or PR observation can be armed with `status-change` or `terminal` and
  an explicit or automatic timeout.
- The model receives no unchanged polling updates and is continued once when
  the requested event, timeout, or error occurs.
- Duration history informs automatic limits and can be exported into a compact,
  deterministic team profile without routine worktree churn.
- The observer preserves the established exit-code contract and terminal
  failure-log behavior through `gh-axi`.
- Hook metadata, adapter wiring, plugin composition, routing cases, benchmark
  expectations, unit tests, fresh materialization, and hydrated validation all
  pass.
- Unrelated existing worktree changes remain unstaged and unmodified.
