# Skill evals

Promptfoo runs two suites: supplied-instruction decisions and fixture-backed
plugin execution. Keep their scores and evidence separate.

Run `npm run eval:skills` to assess decisions from ten source-owned skills.
The suite uses promptfoo and the pinned Codex SDK with a Codex login or an API key.
It contains 22 cases with deterministic expected answers: twelve core cases and
ten session-grounded regressions from PR #102.
Each case runs with the skill and with a control that omits the skill.
This is the shared runner for active decision evals; do not add a parallel
Markdown case catalog or one-off campaign runner for the same decisions.

Run `npm run eval:execution` for the 45 execution scenarios in five definitions
under `source/evals/promptfoo/execution/`. Without a ready fixture, a case records
nonpassing `BLOCKED_SETUP` and makes no model call. No ready fixture is currently
supplied, so this integration does not establish 45 live passes or measured improvement.

## Start a decision run

Use Node.js 22.22.0 or later and the repository's locked dependencies.

```bash
npm ci
npm run check:evals
codex login status
npm run eval:skills
npm run promptfoo -- view
```

If the login is absent, use `codex login` before the live command.
The SDK uses the existing Codex login when `OPENAI_API_KEY` and `CODEX_API_KEY` are unset.
Those variables select API authentication when set.
Do not place credentials in the configuration or a tracked environment file.

The live command uses `gpt-6-sol`, low reasoning effort, and two concurrent cases.
The full run makes 44 model calls.
Each case starts a fresh thread.
The provider uses a read-only workspace with shell tools and web search set to off.
The prompt supplies the skill text, explicitly selected bundled references, and case choices.
It tells the model to use that evidence without tools.
Each run uses a temporary Codex home and an empty workspace.
The runtime uses a link to the existing login file.
It excludes personal Codex settings and sets host skill discovery, plugins, and apps to off.
It removes the temporary runtime when the process exits normally.

The command disables promptfoo telemetry, update notices, sharing, and response caching.
It stores local results under ignored `.promptfoo/`.
The JSON report appears at `.promptfoo/results/latest.json`.
The local viewer keeps earlier runs in its database.
Export a named report when a comparison needs a stable file.

```bash
npm run eval:skills -- --output .promptfoo/results/baseline.json
npm run eval:skills -- --filter-pattern 'tdd:'
npm run eval:skills -- --filter-pattern 'session-c'
npm run eval:skills -- --filter-prompts 'Loaded skill'
npm run eval:skills -- --repeat 3
```

Promptfoo returns a nonzero exit code for assertion failures or provider errors.
An authentication error, timeout, or rejected output schema does not prove a skill failure.

## Read the decision result

The core set covers Semantic Ratchet, TDD, Git Change Flow, Kotlin Design Practices, Python Tooling, and Controlled Technical Writing.
These skills cover common repository workflows and the existing benchmark themes.
This selection does not claim a measured frequency ranking.

The session regressions add Technical Documentation, Skill Primitive Authoring,
Code Knowledge Base, and Personal Setup Management, plus two more TDD cases.
They cover real-interface evidence, rendered versus published docs, distribution
authority, functional knowledge depth, public HOME fixtures, and nearby scope
controls. The [historical audit](session-grounded-skill-campaign.md) and
[fixed execution rubrics](session-grounded-skill-cases.md) retain the original
observations and unassessed runs. These decision adaptations do not replay those
tasks or convert their historical ties into measured improvements.

Each case asks the model to select every justified action and explain the choice.
The grader compares the selected IDs with an independently authored answer set.
It rejects missing choices, extra choices, invented choices, duplicates, and malformed output.
The explanation must contain at least 20 characters. The grader does not assess its meaning.
Read explanations in the viewer before you accept a baseline.

The score measures a decision under supplied skill instructions.
Compare the two columns to examine decisions with and without the skill.
Equal scores do not show a benefit from the skill.
It does not prove automatic skill selection, successful edits, compiler results, or effects from tools.
These cases do not claim native-host qualification.

Each row records the skill path and hashes for its text, both tasks, the case set, and the grader.
`referenceSources` records each explicitly supplied reference path and content hash.
References are selected per case, not discovered automatically; the control
receives neither the skill nor its references.
The `sha256:` prefix keeps promptfoo's secret filter from hiding these public content hashes.
Promptfoo also records provider settings, outputs, and token usage.
Before you compare runs, examine these identities and settings.
A single run does not prove an improvement or a stable success rate.

## Add a decision regression

Edit `source/evals/promptfoo/cases.mts` to add a case.
Use a stable case ID and a real failure pattern from work.
Change the ID when the case changes meaning.
Keep the expected answer and its rationale outside the rendered prompt.
Include a legal answer and a plausible wrong choice.
Distribute correct choices across positions to limit position bias.
Use `references` for the owning skill's bundled files when the decision depends
on a routed procedure; list paths relative to that skill directory.
The harness fails if a selected file is missing and records the supplied bytes.

```bash
npm run check:evals
npm run eval:skills -- --filter-pattern 'your-case-id'
```

The offline command type-checks the configuration and exercises the real promptfoo pipeline with synthetic answers.
It accepts the expected answer and rejects a wrong answer for every case.
The unit tests also toggle each choice to expose a permissive grader.
Normal CI runs this command without credentials or model calls.
Offline scores are harness evidence only.

Keep this fast decision suite as a regression floor.
Do not loosen its oracle to accept a model failure without a source-backed reason.

## Run execution scenarios

The five execution definitions moved from `source/evals/plugin-benchmarks/`
without changes except their schema URI. Their 45 scenarios retain the original
prompts, checklists, routing expectations, and benchmark settings.
Historical notes that mention `plugin-eval analyze` remain provenance, not current
run instructions. Use the promptfoo reports below for new execution evidence.

Prepare an explicit, ignored JSON fixture registry and select it with
`SLOPSENTRAL_EXECUTION_FIXTURES`. Each entry binds a `caseId` to its target and
scenario, an absolute repository path, a full commit SHA revision, and a context
string. It also pins an independent host verifier by its absolute JS, MJS, or MTS
file path and SHA-256 content hash. Supply a real task fixture and its verifier;
the sample workspace paths in the definitions do not establish fixture readiness.

The registry is an array with this entry shape:

```typescript
interface Fixture {
  caseId: string; // "software-engineering/zero-selected-tests-is-not-green"
  repository: string; // absolute local Git repository path
  revision: string; // exact 40-character commit SHA, not a branch
  context: string; // supplied task data, never the expected answers
  prepare?: { file: string; sha256: string };
  verifier: { file: string; sha256: string };
}
```

Hashes use the `sha256:` prefix followed by 64 hexadecimal characters.
The optional pinned `prepare` script runs before initial status is recorded. Use
it to provision locked dependencies or seed unrelated dirty work in the private
fixture. It receives a JSON request-file path with `fixture`, `workspace`, and
`artifacts`. A nonzero exit blocks setup before inference. No dependency setup
or companion installation is inferred from a rubric.

```bash
SLOPSENTRAL_EXECUTION_FIXTURES=/absolute/path/to/ignored-fixtures.json \
  npm run eval:execution
npm run promptfoo -- view
```

Each fixture runs in a disposable private Git worktree with isolated `HOME` and
`CODEX_HOME`. Setup creates a fresh, validated Codex marketplace projection and
installs the native plugin. The custom provider in `tools/promptfoo/execution-runtime.mts`
streams a real turn through the pinned Codex SDK. It preserves each benchmark's
model, sandbox, and approval policy; the current definitions use `gpt-6-astra`,
`workspace-write`, and `never`. Web search and sandbox network access stay off.
Runs use no replay retries or response cache. Normal offline gates make no live
model calls.

Pkl 0.32.0 must be available for the fresh projection; select it with `PKL_BIN`.
`TMPDIR` for the agent points inside its worktree, so tests can create disposable
files without granting write access to other temporary directories. A run has a
ten-minute setup/execution budget and bounded post-run verification. These are
trusted local benchmark fixtures, not a hostile-code security boundary. Scripts
must be self-contained or pin their dependency closure independently. Review
preparation and verifier scripts before selecting them; they run as host code,
must stay within the disposable fixture, and have no authority for remote writes.

The independent host verifier receives a request-file path identifying the case,
workspace, evidence directory, and trace identity. It emits a check for every
exact `successChecklist` string, plus route and scope assessments. Each assessment
has status `pass`, `fail`, or `unassessed` and evidence references. The model
cannot grade itself. Missing or incomplete evidence never passes; a final answer
or a checklist copied from the definition is not an independent effect check.

The verifier request contains `schemaVersion: 1`, `case`, `fixture`, `workspace`,
`artifacts`, `traceSha256`, and `completed`. Write only the following JSON shape
to stdout; write diagnostic artifacts beneath `artifacts`:

```typescript
type Finding = {
  status: "pass" | "fail" | "unassessed";
  evidence: string[]; // retained regular-file paths relative to artifacts
};
interface Verification {
  caseId: string;
  traceSha256: string; // must match this run's request
  checks: (Finding & { requirement: string })[];
  route: Finding;
  scope: Finding;
}
```

Cover each exact checklist string once. Every passing finding needs retained
evidence; missing files, escaping paths, stale traces, and incomplete turns cannot
pass. The harness also runs the definition's original verifier commands and
retains their exit codes and output. A failed command prevents a pass; inspect
its cause before attributing it to the target skill.

The verifier owns semantic assessment: inspect successful tool results and the
delivered skill bytes, actual changed effects, forbidden actions, and preservation
of unrelated work. An echoed skill path is not activation. Passing neighboring
tests is not task proof. Archive external stage evidence before worktree cleanup;
leave unavailable native tools, companion routes, recovery, or performance proof
`unassessed`. The harness validates evidence identity and completeness, not the
truth of an arbitrary verifier. Never replace it with a script that copies
checklists into passing findings.

Retain execution evidence under ignored `.promptfoo/execution/`:

- JSONL SDK events, including events from failed partial turns;
- fixture revision and source, projection, and installation identities;
- initial and final Git status and diff;
- verifier requests, outputs, and referenced evidence.

The promptfoo report is `.promptfoo/results/execution.json`. Review it with the
retained traces and verifier evidence before claiming an outcome. Setup failures
are not target-skill failures, and static checks or successful installation are
not proof of task completion. A measured comparison needs ready fixtures at
identical revisions and settings, fresh turns, and independently verified effects.

## Keep evidence types separate

| Surface | Owner and command | What it establishes |
| --- | --- | --- |
| Active decision cases | `source/evals/promptfoo/cases.mts`; `npm run eval:skills` | Fresh model choices under supplied instructions, compared with a no-skill control. |
| Offline harness controls | `tools/promptfoo`; `npm run check:evals` | Type safety and acceptance/rejection of synthetic answers through promptfoo, not model behavior. |
| Routing contracts | `source/evals/routing`; `node tools/run-routing-evals.mjs --require-all-fixtures` | Golden fixture consistency and separate historical field evidence, not fresh routing. |
| Plugin execution | `source/evals/promptfoo/execution`; `npm run eval:execution` | Fresh tool-backed turns only for ready fixtures, scored from independent checklist, route, and scope evidence. Missing fixtures remain nonpassing `BLOCKED_SETUP`. |
| Archived campaign | `docs/session-grounded-skill-campaign.md` and its fixed cases | The original Pi/Codex screening and its limits, not an active parallel runner. |

Keep routing records separate from both live suites. Never import golden answers,
rubric checklists, or historical outcomes as fresh promptfoo responses. Offline
controls prove the harness contract, not live routing or execution behavior.

The decision provider follows [promptfoo's Codex SDK documentation](https://www.promptfoo.dev/docs/providers/openai-codex-sdk/).
Execution uses the custom streamed SDK provider described above.
The configuration uses [promptfoo's TypeScript configuration interface](https://www.promptfoo.dev/docs/configuration/reference/).
