# Core skill evals

Run `npm run eval:skills` to assess decisions from six source-owned skills.
The suite uses promptfoo and the pinned Codex SDK with a Codex login or an API key.
It contains twelve cases with deterministic expected answers.
Each case runs with the skill and with a control that omits the skill.

## Start a run

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
The full run makes 24 model calls.
Each case starts a fresh thread.
The provider uses a read-only workspace with shell tools and web search set to off.
The prompt supplies the skill text and case choices.
It tells the model to use that evidence without tools.
Each run uses a temporary Codex home and an empty workspace.
The runtime links the existing login file without copying its contents.
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
npm run eval:skills -- --filter-prompts 'Loaded skill'
npm run eval:skills -- --repeat 3
```

Promptfoo returns a nonzero exit code for assertion failures or provider errors.
An authentication error, timeout, or rejected output schema does not prove a skill failure.

## Read the result

The first set covers Semantic Ratchet, TDD, Git Change Flow, Kotlin Design Practices, Python Tooling, and Controlled Technical Writing.
These skills cover common repository workflows and the existing benchmark themes.
This selection does not claim a measured frequency ranking.

Each case asks the model to select every justified action and explain the choice.
The grader compares the selected IDs with an independently authored answer set.
It rejects missing choices, extra choices, invented choices, duplicates, and malformed output.
The explanation must contain at least 20 characters. The grader does not assess its meaning.
Read explanations in the viewer before accepting a baseline.

The score measures a decision under supplied skill instructions.
Compare the two columns to examine decisions with and without the skill.
Equal scores do not show a benefit from the skill.
It does not prove automatic skill selection, successful edits, compiler results, or effects from tools.
Existing routing fixtures and plugin benchmarks keep their separate purposes.
These cases do not claim native-host qualification.

Each row records the skill path and hashes for its text, both tasks, the case set, and the grader.
The `sha256:` prefix keeps promptfoo's secret filter from hiding these public content hashes.
Promptfoo also records provider settings, outputs, and token usage.
Compare runs only after examining these identities and settings.
A single run does not prove an improvement or a stable success rate.

## Add a regression

Edit `source/evals/promptfoo/cases.mts` to add a case.
Use a stable case ID and a real failure pattern from work.
Change the ID when the case changes meaning.
Keep the expected answer and its rationale outside the rendered prompt.
Include a legal answer and a plausible wrong choice.
Distribute correct choices across positions to limit position bias.

```bash
npm run check:evals
npm run eval:skills -- --filter-pattern 'your-case-id'
```

The offline command type-checks the configuration and exercises the real promptfoo pipeline with synthetic answers.
It accepts the expected answer and rejects a wrong answer for every case.
The unit tests also toggle each choice to expose a permissive grader.
Normal CI runs this command without credentials or model calls.
Offline scores are harness evidence only.

For deeper coverage, add isolated execution fixtures and independent effect assertions as a separate suite.
Keep this fast decision suite as a regression floor.
Do not loosen its oracle to accept a model failure without a source-backed reason.

The native provider contract follows [promptfoo's Codex SDK documentation](https://www.promptfoo.dev/docs/providers/openai-codex-sdk/).
The configuration uses [promptfoo's TypeScript configuration interface](https://www.promptfoo.dev/docs/configuration/reference/).
