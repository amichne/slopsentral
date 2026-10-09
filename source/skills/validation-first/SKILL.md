---
name: validation-first
description: "Plan validation before implementation when explicitly invoked as $validation-first. Prefill from the current chat, resolve consequential uncertainties, and refine a short test plan. This invocation plans work; it does not authorize execution."
---

# Validation first

Use this flow only when explicitly requested. The user may skip, shorten, or revise it.
For a trivial change, use a few lines and zero questions when the chat already
supplies enough context.

## Start with the same working card

Prefill the goal, acceptance, constraints, current behavior, and evidence from
the current chat and supplied readable material. Label consequential points
**Known**, **Inferred**, or **Unknown**, with message, file section, or result
pointers. Distinguish a supplied claim from your direct observation. Do not imply
access to other chats or unread sources. User corrections override inferred defaults.

The first response is only a compact card and any material questions:

- **Goal and acceptance:** desired real-world outcome, observable success/failure,
  non-goals, and what would reject the idea or change the approach.
- **Consequential uncertainty:** the first claim that could change the decision;
  mark its knowledge status and evidence source.
- **Smallest faithful test and independent oracle:** input, setup, observation,
  independently derived expected result, and a counterexample or negative control.
- **Widening gap and next step:** what this test cannot establish, the next necessary
  boundary and entry gate, assumptions, and stop condition.
- **Evidence status:** Proposed, Run, Passed, Failed, or Blocked, with artifact/version,
  source, and whether evidence is inherited or directly observed.

Ask **0–3 material questions per round**; skip answered questions. Ask only about
answers that change acceptance, test boundaries, or safety. Offer recommended
defaults and their tradeoffs where useful. Ask about an acceptance owner or
environment access only when an external decision or environment matters.
Use explicit assumptions for reversible choices; keep required answers pending.
Suggested thresholds are proposals for agreement, never measured facts.

## Make the test decisive

Preserve the mechanism that could cause success or failure: relevant state,
lifecycle, concurrency, topology, and scale. Small means few moving parts,
not omission of the risk. Explain how the test bears on the real-world outcome.
If only a real environment can answer the uncertainty, propose that environment
with the smallest safe scope and required authorization.

Derive the oracle independently of the implementation. Use a baseline,
counterexample, or control to distinguish competing explanations. Include a
negative control that must fail or remain unchanged and likely confounders.
Mocks must not encode the desired conclusion. Prefer a deterministic focused
regression or compiler/type proof for a static claim when it tests the mechanism.

Freeze the input fixture, independently derived oracle, command, and source
identity before comparing candidates. A changed fixture or assertion requires
a new comparison. Label each claim as source-confirmed, reproduced at the named
boundary, qualified in the target environment, or untested. These labels describe
proof scope; they do not replace the card's test execution status.

Widen when a narrower layer passes and a new claim needs proof, when the fixture
is unrepresentative, or when a boundary issue appears. Do not wait for narrow-test
polish. Name the claim the earlier evidence cannot establish and why integration,
runtime, deployment topology, scale, or native UI is needed. Narrow success does
not establish production behavior.

## Refine and hand off

Update the same card each round. When useful, add short implementation steps
linked to tests, wider checks with entry gates, deferred evidence, and stop
conditions. Keep proposed tests distinct from observed results; attach evidence
to actual results. If evidence fails or contradicts the approach, revisit the
hypothesis before proposing speculative changes. Stop at the agreed budget or
missing authorization.

**Stop at planning unless execution is separately requested.** Preserve existing
approvals, privacy, and production safety. A planning invocation itself permits
no implementation, test execution, production mutation, or external messages.

For a new chat, provide this card with evidence pointers, source/version,
inherited-versus-observed status, deferred checks, and the next boundary.
Never silently upgrade inherited claims into observations.

Adapted from the original [playbook](references/playbook.md); read it for the
starter prompt, handoff template, or deduplication example when needed.
Original playbook retrieved 2026-10-06; source version identified by SHA-256
`ba598d43a505c76525fabb6722f152fcf4d415b452ac8e380ff085596c8e047f`.

Read [provenance](references/provenance.md) when revising this skill.
