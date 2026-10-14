# Validation first ideation

Use this in a new planning chat, or attach it to an existing one. Add your rough idea and any relevant evidence. It works only where you supply it.

## Starter invocation

Use this validation-first playbook for my idea. Prefill what this chat already establishes, propose the smallest faithful test, and ask only the questions that would change the plan. Refine the validation plan before outlining implementation.

## Reusable prompt

Plan validation before implementation. Start with one consequential uncertainty. Let me skip or revise the flow. For tiny changes, use a few lines.

**1. Prefill before asking.** Extract the goal, constraints, current behavior, and evidence from this chat and supplied material. Label each consequential point Known, Inferred, or Unknown. Point to the supporting message, file section, or result. Separate supplied claims from direct observations. Do not imply access to other chats or unread sources. First response: only a compact working card with goal, acceptance, first test, and material questions, if any.

**2. Elicit selectively.** Ask 0–3 material questions per round. Skip answered questions. Offer a recommended answer with its tradeoff where useful. Prioritize answers that change acceptance, test boundaries, or safety. Ask about acceptance owner or access only when external decisions or environments matter. For reversible choices, proceed with explicit assumptions; do not require perfect certainty. Mark suggested thresholds as proposals for agreement, never measured facts.

**3. Define the decision.** State the desired real-world outcome and an observable, falsifiable success/failure criterion. Identify non-goals. Explain what result would reject the idea or change our approach.

**4. Choose the smallest faithful unit.** Preserve the mechanism that could cause success or failure while removing unrelated parts. Include necessary state, concurrency, lifecycle, topology, or scale. “Small” means few moving parts, not a test too small to expose the risk. Explain how this test bears on the real-world outcome. If the decisive uncertainty requires a real environment, start there with safe scope.

**5. Make the evidence trustworthy.** Specify the input, setup, observation, and expected result. Derive the expected result independently of the implementation. Use a baseline or counterexample where useful. Include a negative control that must fail or remain unchanged, plus likely confounders. A mock must not assume the result we want.

**6. Widen for a reason.** Prefer a deterministic focused regression, or a compiler/type proof for a static claim, before broader checks. If that cannot test the mechanism, explain why and choose the smallest decisive experiment. Widen when narrow evidence passes, becomes unrepresentative, or exposes a boundary issue; do not wait for narrow-test polish. For each wider layer, name what the earlier proof cannot establish and why the next boundary is necessary. Add integration, runtime, deployment topology, scale, or native UI checks only when relevant. Narrow success does not establish production behavior.

**7. Refine into a short plan.** Produce: outcome and acceptance; first test and oracle; wider checks with entry gates; assumptions and deferred evidence; stop conditions; implementation steps linked to tests. Update the same card each round; my corrections override inferred defaults. Preserve approvals, privacy, and production safety. Planning alone does not authorize execution.

**8. Keep results honest.** Separate Proposed, Run, Passed, Failed, and Blocked. Attach evidence to actual results. If a test fails, revisit the hypothesis before adding speculative changes. Stop when agreed acceptance and relevant risk checks pass; state remaining uncertainty. Stop or ask when evidence contradicts the approach, the agreed budget is exhausted, or authorization is missing.

## Copyable handoff card

At the end of a chat, ask the assistant to fill this card. Paste it with the reusable prompt in the next chat.

- Goal and acceptance:
- Known / Inferred / Unknown, with evidence pointers:
- Smallest faithful test and independent oracle:
- Results and evidence (artifact/version, source, inherited or directly observed); tests still proposed:
- Next wider boundary and why:
- Assumptions, deferred evidence, safety limits, and stop condition:

## Example

Idea: prevent duplicate processing when a request is retried.

First, test the real deduplication decision using two attempts with the same key. Assert one recorded effect using an independent effect ledger. A different-key control must record two effects. Use deterministic synchronization rather than hoping a race occurs.

That proves only the tested storage and process boundary. If workers use separate connections, widen to two workers and the real database: an in-memory test cannot establish transaction isolation. If retries cross process restarts, add a restart case. Add load only if capacity could change correctness. These are proposed tests, not results.
