# AXI GitHub Run Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace model-driven GitHub Actions polling with an AXI-only observer that arms a meaningful event, waits inside a Codex `Stop` hook, and resumes the model once with structured evidence.

**Architecture:** A typed Python observer owns `gh-axi` command execution, TOON parsing, event classification, Git-owned runtime state, duration history, and timeout recommendations. The existing `ci_wait_for_actions` path becomes a thin arm/await/status/profile CLI. A provider-neutral hook delegates to that CLI, while authored skills, plugin composition, routing fixtures, and benchmarks move to `npx -y gh-axi` as the sole remote GitHub surface.

**Tech Stack:** Python 3 standard library, `unittest`, JSON/JSONL, Codex hook JSON, source-graph manifests, `npx -y gh-axi`, Node.js validation scripts, Kotlin `intelligence` marketplace materialization, and `plugin-eval`.

## Global Constraints

- Edit canonical `source/` files only; generated `.agents/plugins` and `.github/plugin` trees are proof artifacts.
- Every remote GitHub operation owned by this plugin must start with `npx -y gh-axi`; local `git` commands remain allowed.
- Preserve exit `0` for success/non-failing event, `1` for terminal failure, `2` for usage/dependency/state errors, and `124` for timeout.
- Store active state and raw history under `git rev-parse --git-path axi/github-actions`; routine observation must not dirty the worktree.
- Keep explicit timeout values within 30 through 3300 seconds; configure the Codex hook timeout to 3600 seconds.
- Keep `SKILL.md` compact and route detailed observation behavior to one reference and deterministic scripts.
- Compose the hook by reference from `source/plugins/git-ci-operations/plugin.json`; do not copy hook payloads into the plugin.
- Preserve unrelated user changes and stage only files named by each task.
- Use red-green-refactor for every behavior change and run the focused test before each commit.

---

### Task 1: Typed AXI observations and TOON parsing

**Files:**
- Create: `source/skills/github-ci-operations/scripts/ci_actions_observer.py`
- Modify: `source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py`

**Interfaces:**
- Consumes: `npx -y gh-axi run view <id>`, `npx -y gh-axi pr checks <pr>`, and `npx -y gh-axi api <path>` output.
- Produces: `TargetKind`, `WaitPredicate`, `Outcome`, `Target`, `Snapshot`, `AxiResult`, `AxiRunner`, `parse_run_view`, `parse_pr_checks`, `parse_run_api`, `fetch_snapshot`, and `state_key`.

- [ ] **Step 1: Replace the old runner tests with failing AXI contract tests**

```python
class RecordingRunner:
    def __init__(self, responses: list[observer.AxiResult]):
        self.responses = list(responses)
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, args: Sequence[str], cwd: Path) -> observer.AxiResult:
        self.calls.append(tuple(args))
        return self.responses.pop(0)


def test_run_observation_uses_only_gh_axi_and_parses_jobs(self) -> None:
    runner = RecordingRunner([observer.AxiResult(0, RUN_IN_PROGRESS_TOON, "")])
    snapshot = observer.fetch_snapshot(
        observer.Target(observer.TargetKind.RUN, "123"), Path("."), runner
    )
    self.assertEqual(snapshot.outcome, observer.Outcome.PENDING)
    self.assertEqual(snapshot.status, "in_progress")
    self.assertEqual(snapshot.details["jobs"][0]["name"], "test")
    self.assertEqual(runner.calls[0][:3], ("npx", "-y", "gh-axi"))


def test_pr_observation_classifies_pending_and_failure(self) -> None:
    pending = observer.parse_pr_checks(PR_PENDING_TOON, "42")
    failed = observer.parse_pr_checks(PR_FAILED_TOON, "42")
    self.assertEqual(pending.outcome, observer.Outcome.PENDING)
    self.assertEqual(failed.outcome, observer.Outcome.FAILURE)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
```

Expected: FAIL because `ci_actions_observer` and its typed contracts do not exist.

- [ ] **Step 3: Implement the typed observation boundary**

```python
class TargetKind(str, enum.Enum):
    RUN = "RUN"
    PR = "PR"


class WaitPredicate(str, enum.Enum):
    STATUS_CHANGE = "status-change"
    TERMINAL = "terminal"


class Outcome(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    ERROR = "error"


@dataclass(frozen=True)
class Target:
    kind: TargetKind
    value: str
    required: bool = False


@dataclass(frozen=True)
class Snapshot:
    target: Target
    outcome: Outcome
    status: str
    conclusion: str
    summary: str
    details: dict[str, Any]

    @property
    def state_key(self) -> str:
        payload = {
            "target": dataclasses.asdict(self.target),
            "status": self.status,
            "conclusion": self.conclusion,
            "details": self.details,
        }
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))


GH_AXI_PREFIX = ("npx", "-y", "gh-axi")


def run_gh_axi(args: Sequence[str], cwd: Path) -> AxiResult:
    process = subprocess.run(
        [*GH_AXI_PREFIX, *args], cwd=cwd, text=True, capture_output=True
    )
    return AxiResult(process.returncode, process.stdout, process.stderr)
```

Implement small, command-specific TOON parsers. They must parse only owned
fields, reject malformed required fields, ignore `help:` blocks, and never
fall back to display-text guessing.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
```

Expected: PASS for run/PR/API parsing and command-prefix assertions.

- [ ] **Step 5: Commit the observation boundary**

```sh
git add source/skills/github-ci-operations/scripts/ci_actions_observer.py \
  source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py
git diff --cached --check
git commit -m "feat: add typed AXI CI observations"
```

### Task 2: Git-owned state, duration history, and timeout recommendations

**Files:**
- Modify: `source/skills/github-ci-operations/scripts/ci_actions_observer.py`
- Modify: `source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py`

**Interfaces:**
- Consumes: `Target`, `Snapshot`, run API timestamps, a repository root, and an optional checked-in profile.
- Produces: `ActiveRequest`, `WaitResult`, `DurationSample`, `TimeoutRecommendation`, `StateStore`, `recommend_timeout`, `record_terminal_duration`, and `export_profile`.

- [ ] **Step 1: Add failing state and timeout tests**

```python
def test_state_store_uses_git_path_and_refuses_to_replace_active_request(self) -> None:
    store = observer.StateStore(repo_root, git_path_runner=fake_git_path)
    store.arm(ACTIVE_REQUEST)
    with self.assertRaisesRegex(observer.ObserverError, "already active"):
        store.arm(ACTIVE_REQUEST)
    self.assertTrue(store.active_path.is_file())


def test_auto_timeout_uses_p95_profile_with_bounds(self) -> None:
    samples = [100, 120, 130, 140, 200]
    recommendation = observer.recommend_timeout(samples, source="team-profile")
    self.assertEqual(recommendation.sample_count, 5)
    self.assertEqual(recommendation.source, "team-profile")
    self.assertGreaterEqual(recommendation.seconds, 300)
    self.assertLessEqual(recommendation.seconds, 3300)


def test_cancelled_samples_do_not_influence_timeout(self) -> None:
    eligible = observer.eligible_durations([
        sample(200, "success"),
        sample(3000, "cancelled"),
        sample(120, "failure"),
    ])
    self.assertEqual(eligible, [200, 120])
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
```

Expected: FAIL because persistent state and timeout recommendation types are missing.

- [ ] **Step 3: Implement state and profile contracts**

```python
@dataclass(frozen=True)
class TimeoutRecommendation:
    seconds: int
    source: str
    sample_count: int
    p50_seconds: int | None
    p95_seconds: int | None
    maximum_seconds: int | None


def recommend_timeout(durations: Sequence[int], source: str) -> TimeoutRecommendation:
    ordered = sorted(durations)
    if not ordered:
        seconds = 1800
    elif len(ordered) < 5:
        seconds = max(ordered) * 2 + 60
    else:
        seconds = math.ceil(percentile(ordered, 0.95) * 1.5 + 60)
    return TimeoutRecommendation(
        seconds=min(3300, max(300, seconds)),
        source=source,
        sample_count=len(ordered),
        p50_seconds=percentile(ordered, 0.50) if ordered else None,
        p95_seconds=percentile(ordered, 0.95) if ordered else None,
        maximum_seconds=max(ordered) if ordered else None,
    )
```

`StateStore` must resolve its directory through
`git rev-parse --git-path axi/github-actions`, write JSON atomically with a
temporary sibling and `Path.replace`, append schema-versioned JSONL samples,
quarantine malformed JSON with `.corrupt-<UTC timestamp>`, and export sorted
profile groups to `.axi/github-actions-duration-profile.json` only when asked.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
```

Expected: PASS for state isolation, corruption handling, duration filtering,
profile precedence, formulas, clamping, and deterministic export.

- [ ] **Step 5: Commit state and profiling**

```sh
git add source/skills/github-ci-operations/scripts/ci_actions_observer.py \
  source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py
git diff --cached --check
git commit -m "feat: persist CI observation timing"
```

### Task 3: Arm/await/status/profile CLI and transition-only waiting

**Files:**
- Modify: `source/skills/github-ci-operations/scripts/ci_wait_for_actions`
- Modify: `source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py`
- Delete: `source/skills/github-ci-operations/scripts/ci_check_evidence`

**Interfaces:**
- Consumes: Task 1 observation functions and Task 2 state/profile functions.
- Produces: `arm`, `await`, `status`, and `profile show|export` command behavior with stable exit codes and single-event output.

- [ ] **Step 1: Add failing CLI and wait-loop tests**

```python
def test_arm_records_baseline_and_resolved_timeout(self) -> None:
    result = cli_main([
        "--repo", str(repo_root), "arm", "--run-id", "123",
        "--until", "status-change", "--timeout", "auto", "--json",
    ], runner=runner, store=store)
    self.assertEqual(result.exit_code, 0)
    self.assertEqual(result.payload["request"]["predicate"], "status-change")
    self.assertEqual(result.payload["timeout"]["source"], "default")


def test_await_emits_only_the_changed_state(self) -> None:
    snapshots = [QUEUED, QUEUED, IN_PROGRESS]
    result = observer.await_event(
        ACTIVE_REQUEST,
        fetch_snapshot=lambda _: snapshots.pop(0),
        sleeper=clock.sleep,
        now=clock.now,
    )
    self.assertEqual(result.outcome, observer.Outcome.PENDING)
    self.assertEqual(result.previous.state_key, QUEUED.state_key)
    self.assertEqual(result.current.state_key, IN_PROGRESS.state_key)
    self.assertEqual(result.polls, 3)


def test_timeout_preserves_latest_state_and_returns_124(self) -> None:
    result = cli_main(["await", "--json"], runner=runner, store=store)
    self.assertEqual(result.exit_code, 124)
    self.assertEqual(result.payload["outcome"], "timeout")
    self.assertFalse(store.active_path.exists())
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
```

Expected: FAIL because the old CLI only accepts direct wait flags and polls raw `gh`.

- [ ] **Step 3: Rewrite the executable as a thin CLI**

```python
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Await meaningful GitHub Actions events through gh-axi.")
    parser.add_argument("--repo", default=".")
    subcommands = parser.add_subparsers(dest="command", required=True)
    arm = subcommands.add_parser("arm")
    target = arm.add_mutually_exclusive_group(required=True)
    target.add_argument("--run-id")
    target.add_argument("--pr", nargs="?", const="current")
    arm.add_argument("--until", choices=["status-change", "terminal"], default="terminal")
    arm.add_argument("--timeout", default="auto")
    arm.add_argument("--required", action="store_true")
    arm.add_argument("--json", action="store_true")
    subcommands.add_parser("await").add_argument("--json", action="store_true")
    subcommands.add_parser("status").add_argument("--json", action="store_true")
    profile = subcommands.add_parser("profile").add_subparsers(dest="profile_command", required=True)
    profile.add_parser("show").add_argument("--json", action="store_true")
    export = profile.add_parser("export")
    export.add_argument("--output", type=Path)
    export.add_argument("--json", action="store_true")
    return parser
```

The CLI must capture failure logs only after terminal failure via
`npx -y gh-axi run view <id> --log-failed`, return one compact result, and
remove `ci_check_evidence` because the observer's typed evidence replaces raw
`gh --json` post-processing.

- [ ] **Step 4: Run the CLI suite and syntax checks**

Run:

```sh
python3 -m unittest discover -s source/skills/github-ci-operations/scripts/tests
python3 -m py_compile \
  source/skills/github-ci-operations/scripts/ci_actions_observer.py \
  source/skills/github-ci-operations/scripts/ci_wait_for_actions
```

Expected: all tests PASS and both scripts compile without output.

- [ ] **Step 5: Commit the CLI migration**

```sh
git add -A -- \
  source/skills/github-ci-operations/scripts/ci_wait_for_actions \
  source/skills/github-ci-operations/scripts/ci_check_evidence \
  source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py
git diff --cached --check
git commit -m "feat: await CI events through AXI"
```

### Task 4: Codex hook primitive and plugin composition

**Files:**
- Create: `source/hooks/github-actions-await.py`
- Create: `source/hooks/github-actions-await.hook.json`
- Create: `source/hooks/codex/github-actions-await.hooks.json`
- Create: `source/hooks/tests/test_github_actions_await.py`
- Modify: `source/plugins/git-ci-operations/plugin.json`
- Modify: `source/adaptable.marketplace.json`

**Interfaces:**
- Consumes: hook payload JSON and the installed/source-relative `skills/github-ci-operations/scripts/ci_wait_for_actions` executable.
- Produces: `guard` and `stop` hook modes; one referential hook primitive composed by `git-ci-operations`.

- [ ] **Step 1: Add failing hook behavior tests**

```python
def test_guard_denies_raw_gh_observation(self) -> None:
    output = hook.guard_output({
        "tool_name": "Bash",
        "tool_input": {"command": "gh run watch 123"},
    })
    self.assertEqual(
        output["hookSpecificOutput"]["permissionDecision"], "deny"
    )


def test_guard_allows_gh_axi(self) -> None:
    self.assertIsNone(hook.guard_output({
        "tool_name": "Bash",
        "tool_input": {"command": "npx -y gh-axi run view 123"},
    }))


def test_stop_continues_model_once_for_observation_event(self) -> None:
    output = hook.stop_output(repo_root, fake_cli(exit_code=0, payload=EVENT))
    self.assertEqual(output["decision"], "block")
    self.assertIn("status-change", output["reason"])
```

- [ ] **Step 2: Run hook tests and verify RED**

Run:

```sh
python3 -m unittest discover -s source/hooks/tests
```

Expected: FAIL because the hook implementation does not exist.

- [ ] **Step 3: Implement thin hook behavior and manifests**

```python
RAW_GITHUB_COMMAND = re.compile(
    r"(?:^|[;&|]\s*)gh\s+(?:api|auth|issue|pr|release|repo|run|secret|variable|workflow)\b"
)


def guard_output(payload: dict[str, Any]) -> dict[str, Any] | None:
    tool_name = str(payload.get("tool_name") or payload.get("toolName") or "")
    if "github" in tool_name.lower() and tool_name.lower().startswith("mcp__"):
        return deny("Use npx -y gh-axi as the sole GitHub interaction surface.")
    command = hook_command(payload)
    if command and RAW_GITHUB_COMMAND.search(command) and "gh-axi" not in command:
        return deny("Raw gh polling is disabled; arm the AXI CI observer instead.")
    return None


def stop_output(repo_root: Path, run_cli: CliRunner = run_observer_cli) -> dict[str, Any]:
    status = run_cli(["--repo", str(repo_root), "status", "--json"])
    if status.payload.get("state") == "idle":
        return {"continue": True}
    event = run_cli(["--repo", str(repo_root), "await", "--json"])
    return {
        "decision": "block",
        "reason": "GitHub Actions observation event:\n" + compact_event(event.payload),
    }
```

The Codex adapter uses matcher
`^(Bash|mcp__.*github.*)$` for `PreToolUse`, no matcher for `Stop`, a
10-second guard timeout, and a 3600-second stop timeout. The neutral metadata
depends on `skills/github-ci-operations`. Add the hook to both the marketplace
hook catalog and the git plugin's `hooks` array.

- [ ] **Step 4: Validate hook code and source graph**

Run:

```sh
python3 -m unittest discover -s source/hooks/tests
python3 -m py_compile source/hooks/github-actions-await.py
python3 -m json.tool source/hooks/github-actions-await.hook.json >/dev/null
python3 -m json.tool source/hooks/codex/github-actions-await.hooks.json >/dev/null
node source/tools/validate-source-graph.mjs
python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin git-ci-operations
```

Expected: tests PASS, JSON and Python parse, source graph reports
`OK source graph quality`, and composition reports one hook with no findings.

- [ ] **Step 5: Commit hook composition**

```sh
git add source/hooks/github-actions-await.py \
  source/hooks/github-actions-await.hook.json \
  source/hooks/codex/github-actions-await.hooks.json \
  source/hooks/tests/test_github_actions_await.py \
  source/plugins/git-ci-operations/plugin.json \
  source/adaptable.marketplace.json
git diff --cached --check
git commit -m "feat: resume Codex on CI events"
```

### Task 5: AXI-only skill routing, references, routing fixtures, and benchmarks

**Files:**
- Modify: `source/skills/github-ci-operations/SKILL.md`
- Modify: `source/skills/github-ci-operations/references/ci-failure-triage.md`
- Modify: `source/skills/github-ci-operations/references/release-flow.md`
- Create: `source/skills/github-ci-operations/references/event-driven-observation.md`
- Modify: `source/skills/pull-request-lifecycle/SKILL.md`
- Modify: `source/skills/define-goal/SKILL.md`
- Modify: `source/evals/plugin-benchmarks/git-ci-operations.json`
- Modify: `source/evals/routing/daily-driver-workflows.json`
- Modify: `source/evals/routing/fixtures/golden-routing-observations.json`
- Modify: `source/skills/github-ci-operations/scripts/tests/test_ci_wait_for_actions.py`

**Interfaces:**
- Consumes: the Task 3 CLI and Task 4 hook.
- Produces: one AXI-only public workflow, an explicit event-observation routing case, and benchmark checks that reject manual polling.

- [ ] **Step 1: Add a failing authored-surface regression test**

```python
def test_composed_git_plugin_has_no_raw_github_commands(self) -> None:
    roots = [
        SOURCE / "skills" / name
        for name in (
            "define-goal", "tdd", "git-change-flow", "github-ci-operations",
            "shell-script-safety", "pull-request-lifecycle",
        )
    ]
    command_pattern = re.compile(
        r"(?m)(?:^|[`$]\s*)gh\s+(?:api|auth|issue|pr|release|repo|run|secret|variable|workflow)\b"
    )
    findings = [
        path for root in roots for path in root.rglob("*")
        if path.is_file() and command_pattern.search(path.read_text(encoding="utf-8"))
    ]
    self.assertEqual(findings, [])
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
```

Expected: FAIL and list the existing raw `gh` guidance files.

- [ ] **Step 3: Migrate routing and evidence language**

Use these canonical examples throughout the owned surface:

```sh
npx -y gh-axi pr view <pr>
npx -y gh-axi pr checks <pr>
npx -y gh-axi run view <run-id> --log-failed
python "<path-to-skill>/scripts/ci_wait_for_actions" arm \
  --run-id <run-id> --until status-change --timeout auto
```

`SKILL.md` must route event details to
`references/event-driven-observation.md`. The new reference explains arm,
Stop-hook waiting, re-arming after a pending transition, profile export, exit
codes, evidence paths, and the bounded nature of `PreToolUse` enforcement.

Update the benchmark scenario so success requires:

```json
[
  "The run uses npx -y gh-axi as the only remote GitHub interface.",
  "The run arms ci_wait_for_actions with an explicit predicate and timeout source.",
  "The model processes only meaningful transitions, terminal state, timeout, or error.",
  "The run records the observer evidence path and does not manually poll unchanged state."
]
```

Update matching daily-driver and golden observations to use the same contract.

- [ ] **Step 4: Run routing and source validation**

Run:

```sh
python3 -m unittest discover \
  -s source/skills/github-ci-operations/scripts/tests \
  -p 'test_ci_wait_for_actions.py'
node source/tools/run-routing-evals.mjs --require-all-observed
node source/tools/validate-source-graph.mjs
git diff --check
```

Expected: authored-surface scan PASS, all routing cases observed, source graph
quality OK, and no whitespace errors.

- [ ] **Step 5: Commit public routing and evals**

```sh
git add source/skills/github-ci-operations \
  source/skills/pull-request-lifecycle/SKILL.md \
  source/skills/define-goal/SKILL.md \
  source/evals/plugin-benchmarks/git-ci-operations.json \
  source/evals/routing/daily-driver-workflows.json \
  source/evals/routing/fixtures/golden-routing-observations.json
git diff --cached --check
git commit -m "docs: route GitHub operations through AXI"
```

### Task 6: Full verification, fresh materialization, and plugin evaluation

**Files:**
- Modify only if a verification failure identifies an authored-source defect in the files from Tasks 1 through 5.

**Interfaces:**
- Consumes: the complete authored source change.
- Produces: executable proof, fresh provider artifacts under `/tmp`, and final plugin-eval metrics.

- [ ] **Step 1: Run all deterministic Python proof**

```sh
python3 -m unittest discover -s source/skills/github-ci-operations/scripts/tests
python3 -m unittest discover -s source/hooks/tests
python3 -m py_compile \
  source/skills/github-ci-operations/scripts/ci_actions_observer.py \
  source/skills/github-ci-operations/scripts/ci_wait_for_actions \
  source/hooks/github-actions-await.py
```

Expected: all tests PASS and compilation exits zero without output.

- [ ] **Step 2: Run repository source and routing gates**

```sh
node source/tools/validate-source-graph.mjs
node source/tools/run-routing-evals.mjs --require-all-observed
python3 source/skills/plugin-composition-authoring/scripts/check_plugin_composition --plugin git-ci-operations
intelligence validate --repo /Users/amichne/code/slopsentral --portable
git diff --check
```

Expected: source graph and routing gates pass, composition has no findings,
portable validation succeeds, and diff hygiene is clean.

- [ ] **Step 3: Materialize with the current development CLI and validate hydrated output**

```sh
out=$(mktemp -d /tmp/slopsentral-axi-github-observation.XXXXXX)
/Users/amichne/code/intelligence/.local/intelligence/bin/intelligence \
  marketplace materialize --repo /Users/amichne/code/slopsentral \
  --provider all --out "$out"
/Users/amichne/code/intelligence/.local/intelligence/bin/intelligence \
  validate --repo /Users/amichne/code/slopsentral --portable --hydrated "$out"
```

Expected: materialization and hydrated validation pass; the generated Codex
plugin contains the AXI hook and all three interface URLs.

- [ ] **Step 4: Run plugin-eval against the fresh Codex plugin**

```sh
node /Users/amichne/.codex/plugins/cache/openai-curated-remote/plugin-eval/0.1.2/scripts/plugin-eval.js \
  analyze "$out/.agents/plugins/git-ci-operations" --format markdown
```

Expected: no structural failures, grade A, score at least 95, and the final
report records static token metrics plus the absence of observed-usage data.

- [ ] **Step 5: Review final scope and commit any verification-only correction**

```sh
git status --short
git diff --stat HEAD~5..HEAD
git diff --check
```

Expected: only the spec, plan, observer, hook, git-plugin composition, owned
skill routing, and matching eval files changed. If verification required a
source correction, stage only that correction and commit it as
`fix: complete AXI CI observation proof`.
