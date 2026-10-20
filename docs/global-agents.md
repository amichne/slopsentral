# A portable engineering AGENTS.md

The [portable AGENTS.md](examples/global/AGENTS.md) states general engineering
principles without a language, framework, repository, or plugin dependency.
Use it as a complete starting document for global agent instructions.

This is a proposed synthesis of the authored sources at commit
`aea1ab920a72199a5b5b9119139b33346090b6e8`. It does not replace Slopsentral's
canonical source or change plugin composition. Its instruction text expresses
desired behavior. No model evaluation establishes compliance.

## Central principle

When an operation establishes a fact, preserve that fact in the contract that
later code accepts. A consumer must receive evidence of its preconditions.
A name or a remembered guard does not provide that evidence.

That rule connects representation, ownership, effects, failures, and tests.
A constrained value needs controlled construction. Its consumers must preserve
the constraint. External changes can create new obligations. Each claim needs
evidence from the mechanism that can establish it.

The synthesis favors constructive models over promises about primitive values.
It also preserves a limit: static acceptance cannot prove external behavior.

## Source map

The installed skill supplied with the request identifies the workflow.
The authored sources supply this synthesis. Installed caches remain consumers.

| Principle in the portable file | Authored sources | General rule |
| --- | --- | --- |
| Establish the contract | [Codebase preflight](../source/skills/tdd/references/codebase-preflight.md), [engineering baseline](../source/instructions/engineering-design.md) | Inspect the current owner and consumer before choosing reuse, extension, or a new model. |
| Preserve established facts | [Semantic Ratchet](../source/skills/semantic-ratchet/SKILL.md), [proof discipline](../source/skills/semantic-ratchet/references/proof-discipline.md), [domain values](../source/skills/semantic-ratchet/references/domain-values.md) | Successful refinement produces a value that downstream contracts accept directly. |
| Model legal alternatives and transitions | [Type-safety standard](../source/concepts/type-safety/core.md), [state and capabilities](../source/skills/semantic-ratchet/references/state-and-capability-modeling.md) | Constrain legal combinations and transitions with the strongest local mechanism. |
| Give each rule one owner | [Module rules](../source/skills/semantic-ratchet/references/module-boundaries.md), [API composition](../source/skills/semantic-ratchet/references/api-boundaries.md) | Keep invariant ownership singular and transport conversion explicit. |
| Keep decisions pure and effects explicit | [Function ownership](../source/skills/kotlin-design-practices/references/function-ownership-and-composition.md), [branch preservation](../source/skills/kotlin-design-practices/references/branch-preservation.md), [engineering baseline](../source/instructions/engineering-design.md) | Separate deterministic decisions from effects and preserve their sequencing. |
| Make failure behavior part of the contract | [Closed outcomes](../source/skills/semantic-ratchet/references/closed-outcomes.md), [API composition](../source/skills/semantic-ratchet/references/api-boundaries.md) | Preserve finite failure identities and facts that callers need. |
| Prove the claim at the necessary mechanism | [Executable-check contract](../source/skills/tdd/references/executable-check-contract.md), [Negative Capability Proof](../source/skills/negative-capability-proof/SKILL.md), [tracer bullets](../source/skills/tdd/references/tracer-bullets.md) | Exercise the actual obligation with accepted and rejected cases. |
| Complete the authorized outcome | [Agent execution](../source/instructions/agent-execution.md), [TDD](../source/skills/tdd/SKILL.md), [technical prose](../source/skills/controlled-technical-writing/SKILL.md) | Finish authorized work and report evidence with its limits. |

Kotlin Engineering contributes rules for semantic ownership, failure-preserving
composition, exhaustive cases, branch order, cleanup, and capability scope.
The portable file expresses those rules without Kotlin syntax.

## Exclusions and adaptations

- Language syntax stays in language guidance. The portable file names
  constrained values and closed variants without a preferred implementation.
- Python, uv, Gradle, Pkl, and framework choices stay in project instructions.
  The file asks for the project's necessary checks without naming a toolchain.
- Git commands, CI procedures, release channels, and personal delivery policies
  stay outside the portable principles.
- Plugin identifiers, hook events, provider layouts, and installation mechanics
  stay with their source owners.
- The file keeps contract-specific evidence requirements. It does not impose
  a fixed suite, arbitrary test count, score, or ceremony on every edit.
- Shared serialization becomes conditional on real consumers. It does not
  demand an abstraction before a concrete need exists.
- Tiny private facts need no new wrapper. Consumer obligations determine when
  an established fact needs a stronger representation.
- The document uses direct prose without copying the full local vocabulary
  policy into every project.

## Counterexamples that preserve the meaning

These are review cases for the instructions. They are not executed software
tests or observed agent results.

| Counterexample | Rule that rejects it | Remaining evidence |
| --- | --- | --- |
| A public wrapper accepts every integer despite a positive-value invariant. | Control construction and prove rejected misuse. | The parser needs runtime cases for its promised range. |
| A caller checks authorization and later supplies an unrestricted identifier. | Pass a capability scoped to the action and resource. | Revocation and external mutation need effect-level evidence. |
| A result combines a status tag with several unrelated optional fields. | Use closed cases with case-specific data. | Serialization needs accepted and rejected payload cases. |
| A broad exception handler reports success after a failed write. | Keep expected failures finite and preserve unknown failures. | Runtime evidence must establish the write outcome. |
| A mocked host passes while the real integration remains unexamined. | Match evidence to the claimed mechanism. | The claim needs a bounded interaction with the real host. |
| A command returns zero without selecting the intended assertion. | Treat zero selected tests as missing evidence. | Inspect native results for the assertion that ran. |

## Global placement

For Codex, the default global location is `~/.codex/AGENTS.md`.
`CODEX_HOME` can select another location. `AGENTS.override.md` takes precedence
at that global location. Project instructions add more specific guidance.
The [official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
describes discovery and precedence.

A home-directory `~/AGENTS.md` does not provide Codex's documented global scope.
A repository-root file applies within that repository's instruction chain.
Other agents need their own documented discovery rules.

The file stays self-contained so a copied document needs no Slopsentral paths.
The source map stays here for review and future source comparisons.
OpenAI's [instruction guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
also supports selective source reads and proportional procedures.

No installation command runs as part of this draft. Review the destination's
current instructions before replacing them. A source review and a prose
assessment cannot prove that a fresh session loads or obeys the file.
