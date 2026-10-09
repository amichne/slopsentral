# Engineering Excellence

Engineering Excellence expresses a strict design standard: preserve established
knowledge in mechanically enforced representations. Downstream code must require
the proof it depends on. Domain APIs carry domain values, closed outcomes, and
state-specific capabilities. Construction and transformations retain invariants;
illegal calls, combinations, and transitions are rejected at the strongest
available boundary.

The plugin owns the Semantic Ratchet procedure and the canonical engineering-design
policy. It provides concise design guidance and representative Kotlin, API, and
shell examples with focused legal-path and forbidden-path checks.

## Select The Plugin

Select `engineering-excellence@slopsentral` through the host marketplace after
the source change is published. Use it alone for design or proof-loss review;
add Software Engineering for implementation, tests, Git, and delivery. The
standard code profiles include both. Add Kotlin Engineering or API Contracts
when the production language or schema syntax needs its dedicated procedure.

Semantic Ratchet remains independently useful and has one install owner.
Software Engineering 1.4.0 transfers that skill and the engineering-design policy
to Engineering Excellence 1.0.0; the canonical paths remain stable. Update both
plugins together. See [migration](../source/MIGRATION.md).

The context hook delivers concise policy at startup, resume, clear, and compact.
The host owns discovery and trust. This source change does not install or trust
the plugin, and successful projection does not establish host consumption.
The skill includes its own task rules and selectively routed references so it
works without the hook.

## Use The Standard

Name the invariant and the consumer that requires it. Inspect existing owners,
contracts, callers, and checks. Change the contract so the consumer requires a
representation that retains the fact. Parse untrusted values at ingress into
stronger values or finite typed failures. Keep primitive extraction at explicit
adapters and pure application decisions with the owner of their invariant.

Kotlin examples demonstrate constructive non-empty data, opaque construction,
closed outcomes, legal transitions, and compiler rejection. API examples use
exclusive closed variants, required `type` tags in CAPS_CASE, reused schemas,
and positive and negative payload checks. Shell examples centralize stage
transitions, preserve staged input, expose finite outcomes, and inject failures
that must prevent later actions.

Choose checks for the actual changed obligation. A compiler result proves an
encoded type constraint; parser correctness and effect failures need their own
evidence. Schema acceptance does not establish external agreement. Shell does
not provide static type proof. Ordinary typestate does not prove single use or
current authorization. An incomplete semantic model cannot establish absence
of proof loss.

## Inspect The Evidence

The skill's [reference router](../source/skills/semantic-ratchet/SKILL.md) links
the design guidance, examples, and check commands. The repository
suite exercises source ownership, profile composition, complete context-hook
output, and contract examples. The Kotlin example runner also checks forbidden
programs fail for the intended compiler diagnostic.

Routing fixtures and benchmark definitions describe desired behavior. They
are unobserved until a real model evaluation is run. The proposed benchmark
uses `gpt-6.1-sol`.
