---
type: Runtime Flow
title: Hook delivery and instruction review
description: Trace canonical hook selection through Codex lifecycle events and
  Pi adapters, with explicit trust and evidence limits.
tags:
  - hooks
  - instructions
  - codex
  - pi
  - lifecycle
verified:
  - by: openwiki/0.6.1
    at: 2026-11-09T13:23:09.884Z
sources:
  - id: openwiki-source-fdb0ae7333144f405ddb6914
    resource: repo://source/hooks/agents-md-scope.py
  - id: openwiki-source-6cb3a0fccda440b2384712ba
    resource: repo://source/hooks/codex/agents-md-scope.hooks.json
  - id: openwiki-source-59e94a76c36256a0ceee4f2d
    resource: repo://source/hooks/pi/adapter.ts
  - id: openwiki-source-f0043ad3faf0db0ee3e62248
    resource: repo://source/hooks/pi/controls.ts
  - id: openwiki-source-d13b0baee21f61f7d567fec9
    resource: repo://tools/python_checks/test_agents_scope_hook.py
  - id: openwiki-source-1f54aadb050709a2d88f59a6
    resource: repo://tools/tests/pi-hooks.test.mjs
  - id: openwiki-source-36f60eb53c76242699a18af1
    resource: repo://tools/tests/pi-host.test.mjs
  - id: openwiki-source-59bfb60d11af1188e2f7c0c3
    resource: repo://tools/tests/pi-runtime.test.mjs
generated: { by: "codex", at: "2026-11-09T13:20:54.909Z" }
---

# Hook delivery and instruction review

A canonical hook declares an event adapter and its executable dependencies.
A plugin composition selects that hook. The host owns trust, discovery, and event delivery.

## Select one owner

Software Engineering composes its engineering context and instruction-scope hooks.
Repository Knowledge composes registered knowledge context and advisory drift hooks.
Kotlin Engineering selects no automatic hooks.
The retained Kotlin hook primitives need explicit custom composition.
Developer Tooling and IntelliJ Plugin Development add no automatic hooks.

The graph rejects duplicate hook selection through a profile's plugin closure.
That rule protects package composition. It does not establish invocation counts in the host.
See [source ownership](../concepts/source-ownership.md) for the graph contract.

## Review instruction scopes

The [scope hook](../../source/hooks/agents-md-scope.py) takes its first Git snapshot on `UserPromptSubmit`.
Preexisting changes create no retrospective review obligation.
Later prompt and `Stop` events compare source, instructions, renames, deletions, and new files with the prior snapshot.
The hook also tracks committed changes and external edits between events.

The hook refreshes changed instructions that apply to the working directory, a pending review path, or a path supplied by the host.
Other repository instructions stay queued until their scope applies.
A clean instruction change from a proven remote refresh does not create a review obligation.
Local instruction edits and changes from uncertain HEAD transitions keep their review obligations.
An agent examines the actual source and records either a necessary instruction change or a concrete no-change decision.
`Stop` requests a continuation while the current snapshot lacks that review.
A receipt records acknowledgment of the snapshot. It does not establish that the prose is complete or correct.

The hook stores repository-and-session state outside the checkout.
A proven remote refresh can avoid a new source-review obligation, but local changes and pending reviews remain visible.
Unproved Git history keeps the conservative review obligation.
The [scope guide](../../docs/agents-md-scope.md) explains the exact review commands and installation limits.

## Map canonical hooks into Pi

The [Pi adapter](../../source/hooks/pi/adapter.ts) maps startup context and prompt admission into `before_agent_start`.
It appends shared instructions to the request's system prompt.
A failed context or instruction load blocks tool calls until a later request succeeds.

`agent_before_settle` invokes the canonical `Stop` hooks after a completed turn.
Pi collects paths from successful `read`, `edit`, and `write` calls for the current user request.
The adapter passes those paths to the hook as scope evidence.
The Git snapshot detects file changes, including changes from shell tools.
An instruction rejection permits one automatic repair turn.
A repeated rejection remains visible without an automatic loop.
The adapter preserves messages and continuation requests from earlier extensions.

The `/hooks` controls persist each Slopsentral hook choice in Pi's global instruction directory.
Disabled hooks start no script processes.
Malformed saved choices stop hook effects instead of silently changing the selection.
Hook processes have time limits, output limits, and cancellation support.
For packages managed by the bootstrap, the adapter verifies the private runtime receipt and invokes its pinned interpreter directly.
The receipt binds the platform, relative executable path, and interpreter digest.
Runtime authority lives in personal home storage for both personal and project packages.
A project-local receipt cannot select an executable.
Missing or changed runtime files stop admission with an explicit failure.
Isolated imports and disabled bytecode writes keep invocation independent of system Python and uv.
The current hooks declare no third-party Python dependencies; a different dependency contract requires an explicit runtime update.
Direct native package installation bypasses that provisioning and retains the external uv requirement.
The [installation lifecycle](../integrations/installation.md) separates setup-time downloads from hook execution.
The hook's emitted status and review commands keep the private interpreter and instruction scope across recovery.
The runtime marker must name the running interpreter before those commands use it.
Other installations keep their uv launcher.

## Match evidence to the claim

[Adapter tests](../../tools/tests/pi-adapter.test.mjs), [hook tests](../../tools/tests/pi-hooks.test.mjs), and [instruction tests](../../tools/tests/instruction-delivery.test.mjs) cover configured behavior.
A passing adapter result does not prove that a user's trusted host delivers the event.
An installed package does not prove that a model consumes or obeys its context.
Use [validation layers](../testing/validation.md) to name the remaining mechanism.
