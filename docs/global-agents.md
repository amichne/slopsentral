# A portable engineering AGENTS.md

The [portable AGENTS.md](examples/global/AGENTS.md) states general engineering principles for an agent's instruction scope.
It connects source inspection, invariant design, executable evidence, knowledge maintenance, and authorized delivery.
It remains self-contained when copied without this repository.

The [installer](../tools/install_global_agents.py) can add a pinned local reference snapshot beside those instructions.
That snapshot supports source review after the checkout disappears.
Instruction text expresses desired behavior. No model evaluation establishes compliance with these instructions.

## Central principle

When an operation establishes a fact, preserve that fact in the contract that later code accepts.
The consumer receives evidence of its preconditions instead of a remembered guard.
Controlled construction, closed alternatives, explicit effects, and faithful executable evidence support that rule.

The same evidence discipline applies to system explanations.
Reuse an existing OKF owner, link claims to their source, and review affected knowledge after source changes.
A page's timestamp cannot establish factual freshness.
The repository guide at `docs/documentation.md` defines its concrete lifecycle and gates.
That checkout guide stays outside the portable reference snapshot.

## Source map

Authored source supplies the principles. Installed caches remain consumers.
The portable instructions express these rules without repository-relative links.
This guide keeps those links for provenance and future comparison.

| Portable principle | Authored sources | Preserved rule |
| --- | --- | --- |
| Establish the contract | [Codebase preflight](../source/skills/tdd/references/codebase-preflight.md), [engineering baseline](../source/instructions/engineering-design.md) | Inspect owners, contracts, consumers, and existing proof before design. |
| Preserve established facts | [Semantic Ratchet](../source/skills/semantic-ratchet/SKILL.md), [proof discipline](../source/skills/semantic-ratchet/references/proof-discipline.md), [domain values](../source/skills/semantic-ratchet/references/domain-values.md) | A successful refinement returns facts that consumers accept directly. |
| Model legal transitions | [Type-safety standard](../source/concepts/type-safety/core.md), [state and capabilities](../source/skills/semantic-ratchet/references/state-and-capability-modeling.md) | Exclude invalid combinations with the strongest local mechanism. |
| Give each rule one owner | [Module rules](../source/skills/semantic-ratchet/references/module-boundaries.md), [API composition](../source/skills/semantic-ratchet/references/api-boundaries.md) | Preserve invariant ownership and explicit transport conversion. |
| Keep decisions pure | [Function ownership](../source/skills/kotlin-design-practices/references/function-ownership-and-composition.md), [branch preservation](../source/skills/kotlin-design-practices/references/branch-preservation.md) | Separate decisions from effects and preserve their order. |
| Model expected failures | [Closed outcomes](../source/skills/semantic-ratchet/references/closed-outcomes.md) | Keep finite failure identities and the facts callers need. |
| Prove the actual claim | [Executable-check contract](../source/skills/tdd/references/executable-check-contract.md), [Negative Capability Proof](../source/skills/negative-capability-proof/SKILL.md), [tracer bullets](../source/skills/tdd/references/tracer-bullets.md) | Exercise the actual mechanism with accepted and rejected cases. |
| Maintain system knowledge | [Knowledge rules](../source/instructions/engineering-design.md), [document procedure](../source/skills/technical-documentation/SKILL.md) | Reuse the knowledge owner and review source-linked claims after changes. |
| Complete authorized work | [Agent execution](../source/instructions/agent-execution.md), [TDD](../source/skills/tdd/SKILL.md), [technical prose](../source/skills/controlled-technical-writing/SKILL.md) | Finish the requested result and report evidence with its limits. |

Language-specific sources inform the shared principles without forcing their syntax into other projects.
The Python automation section preserves the current project policy for mise, uv, and portable commands.
It does not replace another project's existing language toolchain.

## Exclusions and adaptations

Publication authority, repository delivery rules, provider layouts, and hook events stay with their project or host owners.
The portable file does not select plugins, install packages, or grant permission for external writes.
It does not create a knowledge store merely because a repository contains code.

A consumer obligation determines when a stronger representation earns its cost.
A small private fact needs no wrapper when it never escapes.
A shared serializer needs real consumers before a common abstraction adds value.
The instructions ask for necessary evidence, without a universal suite, score, or test count.

## Counterexamples that preserve the meaning

These cases explain the intended rules. They are not executed tests or measured model outcomes.

| Counterexample | Rule | Evidence still needed |
| --- | --- | --- |
| A public positive-value wrapper accepts every integer. | Control construction and reject named misuse. | Runtime cases for the parser's range. |
| A caller checks authorization and passes an unrestricted identifier. | Carry a capability scoped to the resource and action. | Evidence for revocation and external mutation. |
| A status tag permits unrelated optional fields. | Use closed cases with case-specific data. | Accepted and rejected serialized payloads. |
| A failed write becomes success through a broad exception handler. | Preserve expected failure identities and unknown failures. | Runtime evidence for the write outcome. |
| A mocked host passes while the live host remains unexamined. | Match evidence to the mechanism in the claim. | One bounded interaction with the real host. |
| A page receives a new date after its source changes. | Recheck the claim before it becomes current. | Source review and the freshness gate. |
| A runner returns zero with no selected assertions. | Treat the missing selection as absent proof. | Native results for the intended assertion. |

## Global placement

For Codex, the default global location is `~/.codex/AGENTS.md`.
`CODEX_HOME` can select another location. `AGENTS.override.md` takes precedence at that global location.
Project instructions refine the instruction chain within their scopes.
A home-directory `~/AGENTS.md` does not supply Codex's global scope.
Other hosts own their discovery and precedence rules.

Select an explicit installation destination for the host or repository in scope.
A successful file installation does not prove that a fresh host session loads or obeys the instructions.

## Install a pinned local snapshot

The installer needs uv and Python 3.12 or 3.13.
Its adjacent lock declares the Python dependencies.
The destination must already exist as a real directory.

From the checkout root, examine the asset manifest:

```sh
uv run --locked tools/install_global_agents.py manifest
```

For an explicitly authorized Codex global installation, use:

```sh
uv run --locked tools/install_global_agents.py install --destination "$HOME/.codex"
```

For a repository installation, select its root directory instead.
The installer preserves a different existing `AGENTS.md` or `.slopsentral` tree and rejects the operation.
An identical installation returns `UNCHANGED` without a rewrite.

`tools/global_agents.lock.json` records each asset path and SHA-256 digest.
Its digest names the snapshot:

```text
<destination>/
  AGENTS.md
  .slopsentral/
    <manifest-sha256>/
      docs/
      source/
      tools/
```

The installer captures source bytes and examines their digests before it writes the destination.
It stages the snapshot and examines the written bytes.
It publishes `AGENTS.md` last with an operation that rejects an existing target.
The installed file adds a relative link to this local source map.

The manifest includes transitive local Markdown references and companion files from linked skills and the type-safety concept.
Scripts, locks, schemas, examples, and license notices travel with those owners.
Tracked source defines the inventory. Caches and untracked files do not enter it.
External URLs remain citations that need network access.

Examine an installed snapshot without repair:

```sh
uv run --locked tools/install_global_agents.py verify --destination "$HOME/.codex"
```

The installer rejects changed, missing, unexpected, or symlinked assets.
It also rejects unsafe paths and duplicate JSON keys.
Both operations report the manifest and installed instruction digests as JSON.
Use `--expected-manifest-sha256 <64-lowercase-hex-characters>` to bind an operation to a separately saved digest.

The copied installer can examine the same destination after the checkout disappears:

```sh
uv run --locked --script "$HOME/.codex/.slopsentral/<manifest-sha256>/tools/install_global_agents.py" verify --destination "$HOME/.codex"
```

Local documents remain readable without the checkout or network.
The copied installer still needs its declared runtime and dependencies.
Digest agreement does not authenticate an attacker-controlled script and manifest.

## Refresh and recovery

After source review, refresh the committed inventory:

```sh
uv run --locked tools/install_global_agents.py manifest --write
```

Add new linked files to the Git index before this command.
Review the changed inventory with its source diff.
Installation never refreshes expected digests implicitly.
Existing snapshots remain pinned. A different snapshot needs a separate destination or an explicitly authorized replacement.

A fresh installation creates `.slopsentral` exclusively.
If root publication fails, the installer removes only its unchanged new snapshot.
When ownership remains unproved, `RECOVERY_NEEDED` preserves the paths for inspection.

Interruption can leave a snapshot without `AGENTS.md`.
A later installation rejects that partial state.
Examine the reported paths before recovery.
The procedure trusts the destination parent. It does not prove crash durability or resistance to a hostile concurrent writer.

The [installer tests](../tools/python_checks/test_global_agents.py) use temporary directories and real file operations.
They exercise accepted installation, conflicts, stale assets, unsafe paths, interrupted publication, and checkout-independent examination.
They do not prove host instruction consumption or model compliance.
