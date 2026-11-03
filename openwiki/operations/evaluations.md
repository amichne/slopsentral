---
type: Evidence Model
title: Skill and plugin evaluation evidence
description: Separate routing expectations, decision responses, native execution traces, independent verification, and historical field records.
tags: [evals, evidence, routing, codex, fixtures]
verified:
  - by: openwiki/0.6.1
    at: 2026-11-03T17:57:45.987Z
sources:
  - id: openwiki-source-1e12eb7aff1ffc5476d523a1
    resource: repo://tools/promptfoo/execution-runtime.mts
  - id: openwiki-source-348082d7d3920c994271ae46
    resource: repo://tools/promptfoo/execution.mts
  - id: openwiki-source-f0a86d14d800938edb2bf80a
    resource: repo://tools/promptfoo/suite.mts
generated: { by: "codex", at: "2026-11-03T17:57:45.987Z" }
---

# Skill and plugin evaluation evidence

An evaluation result needs the exact input, source identity, runner conditions, and independent acceptance rule.
The [evaluation guide](../../docs/skill-evals.md) gives setup and report commands.
No fixture or offline control establishes a fresh model outcome.

## Decision responses examine supplied guidance

`source/evals/promptfoo/cases.mts` owns active decision cases and expected answers.
The [suite adapter](../../tools/promptfoo/suite.mts) reads canonical skill text and case-specific routed references.
It records their hashes and pairs skill inputs with no-skill controls.

The decision runner disables tool execution, automatic host skill discovery, apps, plugins, network access, and web search.
The response therefore shows a decision under supplied guidance.
It does not prove automatic routing, file changes, native tool use, or host installation.

```sh
npm run check:evals
npm run eval:skills
```

The first command runs types and offline controls.
The second gets fresh model responses through the pinned Codex SDK.
Normal CI runs the offline command without model calls or credentials.
Raw reports stay under ignored `.promptfoo/`.

## Execution scenarios need real pinned fixtures

Five [plugin benchmark definitions](../../source/evals/promptfoo/execution/repository-knowledge.json) declare 45 execution scenarios.
The [runtime](../../tools/promptfoo/execution-runtime.mts) needs an explicit fixture registry through `SLOPSENTRAL_EXECUTION_FIXTURES`.
Each fixture binds the target, scenario, absolute repository path, full source revision, context, and independent verifier file and digest.
Missing fixtures produce nonpassing `BLOCKED_SETUP` without a model call.

A ready case uses a disposable private checkout and worktree.
Its isolated `HOME` and `CODEX_HOME` preserve operator configuration.
The runner projects fresh packages, installs through the native host, and records identities before the model turn.
It preserves the benchmark's model, sandbox, and approval settings.
Network access, web search, retries, and caching stay disabled.

```sh
npm run eval:execution
```

The runner keeps streamed JSONL events, including failed partial turns, initial and final Git status, diffs, fixture identities, and verifier outputs.
The independent host verifier supplies evidence for every exact checklist item plus route and scope.
Missing or unassessed evidence cannot pass.
The model cannot grade itself.

## Preserve historical scope

Routing fixtures describe expected routes.
Archived assessments and field records describe their recorded inputs, revisions, and conditions.
A retired route needs a fresh replay before it supports its replacement.
Static package scores do not establish activation, useful outcomes, or measured improvement.

The [offline execution tests](../../tools/tests/promptfoo-execution.test.mjs) exercise adapters and grading contracts.
They do not turn missing live fixtures into synthetic passes.
A measured comparison needs matched conditions and actual fresh results.
Use [validation layers](../testing/validation.md) to state the mechanism that each result supports.
