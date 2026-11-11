# Skill evals

Use the decision suite for choices under supplied instructions.
Use the execution suite for tool-backed tasks with pinned fixtures and independent host evidence.
Keep both results separate from offline controls and historical routing records.
Use the [session audit tool](session-audit.md) to examine Pi and Codex history.

| Evidence surface | Source owner | Entry point | Evidence limit |
| --- | --- | --- | --- |
| Decision cases | `source/evals/promptfoo/cases.mts` | `npm run eval:skills` | Supplied instructions and choices, without tools or automatic routing |
| Offline controls | `tools/promptfoo/smoke.ts` and unit tests | `npm run check:evals` | Synthetic answers exercise the grader and pipeline |
| Plugin execution | `source/evals/promptfoo/execution/` | `npm run eval:execution` | Ready fixtures, real turns, and independent effects evidence |
| Routing contracts | `source/evals/routing/` | `node tools/run-routing-evals.mjs --require-all-fixtures` | Golden consistency and separately recorded historical evidence |

The current decision catalog contains 33 cases across 12 skills.
Each case runs with supplied skill text and a control that omits it.
The five execution definitions contain 45 scenarios.
A missing fixture produces nonpassing `BLOCKED_SETUP` without a model call.
No tracked fixture registry establishes live execution results.

## Start a decision run

Use Node.js 22.22.0 or later and the locked dependencies.
Prepare the checkout before a live run:

```sh
npm ci
npm run check:evals
codex login status
```

If no login exists, run `codex login` before the live command.
The SDK uses the existing login when `OPENAI_API_KEY` and `CODEX_API_KEY` are absent.
Those variables select API authentication when present.
Keep credentials outside tracked files and reports.

Run the live suite and view its result:

```sh
npm run eval:skills
npm run promptfoo -- view
```

The [suite owner](../tools/promptfoo/suite.mts) selects `gpt-6-sol`, low reasoning effort, and concurrency of two.
The complete paired catalog schedules 66 calls.
Each case starts a fresh thread in an empty, read-only workspace.
Shell tools, web search, network access, host discovery, plugins, and apps stay off.

The prompt supplies the skill and case-selected references.
The control receives neither. The model must use the supplied evidence without tools.
The [runtime adapter](../tools/promptfoo/runtime.mts) creates a temporary Codex home and links the existing login file.
It excludes personal configuration and removes its temporary directory on normal process exit.

The command disables telemetry, update notices, sharing, and response caching.
The JSON report uses `.promptfoo/results/latest.json` under the ignored report tree.
The local viewer keeps earlier runs. Save a named report for a comparison:

```sh
npm run eval:skills -- --output .promptfoo/results/baseline.json
npm run eval:skills -- --filter-pattern 'tdd:'
npm run eval:skills -- --filter-pattern 'session-c'
npm run eval:skills -- --filter-prompts 'Loaded skill'
npm run eval:skills -- --repeat 3
```

Assertion failures and provider errors return nonzero status.
An authentication error, timeout, or malformed output needs diagnosis before attribution to a skill.

## Read the decision result

The [case catalog](../source/evals/promptfoo/cases.mts) owns each scenario, choices, expected answer, rationale, and routed references.
Cases include core engineering decisions, session regressions, and CI evidence scenarios.
Keep additions in this owner instead of a parallel campaign runner.

The [grader](../tools/promptfoo/grade.mts) compares the exact selected IDs with the independently authored expected set.
It rejects missing, extra, invented, duplicate, and malformed choices.
The explanation needs at least 20 characters. The grader does not assess its meaning.
Read explanations before you accept a baseline.

Each row records the skill path and content digest, supplied task digests, case-set digest, and grader digest.
`referenceSources` records every explicitly supplied reference and its digest.
The `sha256:` prefix preserves public content hashes through promptfoo's secret filter.
Provider settings, outputs, and token usage also belong to the result.

Compare runs only after their sources, cases, settings, and evidence match.
An equal paired score shows no measured decision benefit from the skill.
A decision score does not prove automatic routing, successful edits, compiler results, or native host consumption.
A single run does not establish a stable improvement.

The [historical campaign](session-grounded-skill-campaign.md) and [fixed execution cases](session-grounded-skill-cases.md) preserve earlier runs and unassessed conditions.
Decision adaptations do not replay those tasks or transform historical ties into improvement claims.

## Add a decision regression

Edit `source/evals/promptfoo/cases.mts`.
Use a stable ID for a concrete failure pattern.
When the case changes meaning, change its ID.
Keep the expected answer and rationale outside the rendered prompt.
Include a legal choice and its nearest plausible error.
Distribute correct choices across positions.

If the decision needs a bundled procedure, declare its skill-relative paths in `references`.
A missing reference fails the harness. The report records the supplied bytes.
Run the offline controls before the focused live case:

```sh
npm run check:evals
npm run eval:skills -- --filter-pattern 'your-case-id'
```

The offline command type-checks the configuration and sends synthetic answers through the real promptfoo pipeline.
It accepts each expected answer and rejects a wrong answer.
The [unit tests](../tools/tests/promptfoo-core.test.mjs) also toggle choices to expose a permissive grader.
Normal CI uses these controls without credentials or model calls.
A passing offline result establishes the harness contract only.

## Run execution scenarios

The [execution loader](../tools/promptfoo/execution.mts) reads each validated benchmark definition and its scenarios.
The [runtime](../tools/promptfoo/execution-runtime.mts) coordinates fixture setup, native installation, streamed turns, evidence, and independent assessment.
Historical `plugin-eval analyze` commands remain provenance, not current run instructions.

Supply an explicit, ignored fixture registry through `SLOPSENTRAL_EXECUTION_FIXTURES`.
Each entry binds a case ID to an absolute repository path, a full commit SHA, and task context.
The case ID selects its plugin target and scenario.
The entry also pins a host verifier by absolute path and content digest:

```typescript
interface Fixture {
  caseId: string;
  repository: string;
  revision: string;
  context: string;
  prepare?: { file: string; sha256: string };
  verifier: { file: string; sha256: string };
}
```

Script paths end in `.js`, `.mjs`, or `.mts`.
Hashes use `sha256:` plus 64 lowercase hexadecimal characters.
The revision uses the exact 40-character Git SHA.
Task context must not contain the expected answers.
Unknown and duplicate case IDs fail fixture admission.

An optional pinned `prepare` script provisions dependencies or seeds unrelated work before the initial status snapshot.
It receives a JSON request-file path with `fixture`, `workspace`, and `artifacts`.
A nonzero result blocks inference. The harness infers no dependency setup from a rubric.

```sh
SLOPSENTRAL_EXECUTION_FIXTURES=/absolute/path/to/ignored-fixtures.json npm run eval:execution
npm run promptfoo -- view
```

Each ready case uses a private Git clone and disposable worktree at the pinned revision.
The clone has no `origin` remote. Agent staging cannot change the operator's index or refs.
`HOME` and `CODEX_HOME` are isolated. Agent scratch stays inside its worktree.
Setup creates a fresh Codex projection and installs its native plugin.
Pkl 0.32.0 must exist on `PATH` or at `PKL_BIN`.

The current definitions select `gpt-6-astra`, `workspace-write`, and approval policy `never`.
The runtime preserves the definition's settings and disables web search, sandbox network, replay retries, and response caching.
Setup and execution share a ten-minute budget. Post-run assessment has separate bounded timeouts.
These trusted local fixtures do not form a hostile-code security mechanism.

Review preparation and verifier scripts before a run.
Their dependency closure must be self-contained or independently pinned.
They run as host code and must stay within the disposable fixture.
They receive no authority for remote writes.

## Assess execution evidence

The host verifier receives a request-file path with `case`, `fixture`, `workspace`, `artifacts`, `traceSha256`, and `completed`.
It emits JSON to stdout and writes diagnostic artifacts beneath `artifacts`:

```typescript
type Finding = {
  status: "pass" | "fail" | "unassessed";
  evidence: string[];
};
interface Verification {
  caseId: string;
  traceSha256: string;
  checks: (Finding & { requirement: string })[];
  route: Finding;
  scope: Finding;
}
```

Cover every exact `successChecklist` string once.
Assess route and scope separately.
Every passing finding needs a regular evidence file relative to the artifact directory.
The trace digest must match the request.
Missing files, escaping paths, stale traces, incomplete turns, and unassessed findings cannot pass.

The harness also runs each benchmark's original verifier commands and keeps their outputs and exit codes.
A failed command prevents a pass.
Examine its cause before you attribute failure to the target skill.
The host verifier must inspect actual effects, successful tool results, delivered skill bytes, forbidden actions, and unrelated-work preservation.
An echoed skill path or final answer cannot establish those facts.

The harness establishes evidence identity and completeness. It cannot establish the truth of an arbitrary verifier.
Never replace independent assessment with a script that copies checklist items into passing findings.
Leave unavailable native tools, companion routes, recovery, and performance evidence `unassessed`.

Keep the original SDK events, including failed partial turns, under ignored `.promptfoo/execution/`.
The same directory keeps fixture identities, projected bytes, installation records, initial and final status, diffs, verifier requests, and evidence.
The report uses `.promptfoo/results/execution.json`.
Read it with those artifacts before a result claim.

A measured comparison needs matching fixture revisions and settings, fresh turns, and independent effects evidence.
Successful installation, static controls, golden answers, and historical outcomes cannot substitute for that evidence.
Use the [documentation practice](documentation.md) when source changes make this guide or its linked explanation stale.
