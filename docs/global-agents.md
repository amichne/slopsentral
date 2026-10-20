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

## Install a pinned local snapshot

The [installer](../tools/install_global_agents.py) installs `AGENTS.md` and a
`.slopsentral` directory inside an explicit destination. The destination must
already exist as a real directory. The script needs uv and Python 3.12 or 3.13.
Its adjacent lock pins the Python dependencies.

From the checkout root, examine the committed asset manifest:

```sh
uv run --locked tools/install_global_agents.py manifest
```

To install Codex global instructions, use this explicit destination:

```sh
uv run --locked tools/install_global_agents.py install --destination "$HOME/.codex"
```

For a repository-root installation, select that repository directory instead.
The script preserves a different existing `AGENTS.md` or `.slopsentral` tree
and rejects the installation. It has no overwrite option.
An identical installation returns `UNCHANGED` without rewriting files.

The committed `tools/global_agents.lock.json` records each asset's repository
path and SHA-256 digest. Its own digest names the installed snapshot:

```text
<destination>/
  AGENTS.md
  .slopsentral/
    <manifest-sha256>/
      docs/
      source/
      tools/
```

The installer captures and hashes source bytes before it writes the destination.
It stages the snapshot and examines the written digests. It publishes `AGENTS.md`
last with an operation that rejects an existing file. The installed file keeps
the portable principles and adds a relative link to the local source map.

The snapshot keeps repository-relative paths, so its local links still resolve.
The manifest includes transitive Markdown links and companion files from linked
skills and the type-safety concept. This includes examples, scripts, locks,
schemas, and license notices. The parser supports inline links, reference links,
images, and tables. External URLs remain citations and need network access.
Source caches and untracked files stay outside the asset inventory.

To examine the installation without repair, use:

```sh
uv run --locked tools/install_global_agents.py verify --destination "$HOME/.codex"
```

Both commands report the manifest digest and installed `AGENTS.md` digest as
JSON. They reject changed, missing, unexpected, or symlinked assets.
The installer also rejects unsafe manifest paths and duplicate JSON keys.
To bind an operation to a separately saved manifest digest, supply
`--expected-manifest-sha256 <64-lowercase-hex-characters>`.

The snapshot includes the installer and its dependency lock. After the checkout
disappears, the copied installer can examine the same destination:

```sh
uv run --locked --script "$HOME/.codex/.slopsentral/<manifest-sha256>/tools/install_global_agents.py" verify --destination "$HOME/.codex"
```

The local documents remain readable without the checkout or network.
The installer needs its declared Python runtime and dependencies.
SHA-256 proves agreement with the selected manifest. It does not authenticate
an attacker-controlled script and manifest.

## Refresh and recovery

After a deliberate source change, refresh the committed manifest:

```sh
uv run --locked tools/install_global_agents.py manifest --write
```

The refresh uses tracked source files. If a new linked file is absent from
the Git index, add that file before the refresh. Review digest changes with
the source diff. Installation never refreshes expected digests implicitly.
Existing snapshots remain pinned. A different snapshot needs a different
destination or a separate, deliberate replacement of the prior installation.

A fresh installation creates its own `.slopsentral` directory exclusively.
If root publication fails, the script removes only its unchanged new snapshot.
If cleanup cannot establish ownership, it reports `RECOVERY_NEEDED` and keeps
the affected paths for inspection.

A process interruption can leave a snapshot without `AGENTS.md`.
The next installation rejects that partial state. Inspect the reported paths
before recovery. The procedure assumes a trusted destination parent.
It does not establish crash durability or resist a hostile concurrent writer.

The tests use temporary directories and real file operations.
A prose assessment or successful installation cannot prove that a fresh agent
session loads or obeys the instructions.
