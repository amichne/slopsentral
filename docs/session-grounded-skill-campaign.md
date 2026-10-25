# Five Session-Grounded Skill Improvements

Status: paired screening completed with gaps; no task-outcome improvement established.
Source baseline: `d8859160f40cf0b55fb4832d7b8a6b4e27e871ac`.

## Recommendation

Keep five focused edits as candidates rather than importing Amp's built-ins or
adding another orchestration layer: `tdd`, `technical-documentation`,
`skill-primitive-authoring`, `code-knowledge-base`, and
`personal-setup-management`. Each change targets one observed failure mechanism
or unmet quality expectation and retains a nearby scope control.

These are the five highest-value weak spots supported by this sample, not a
statistically established ranking of the entire library. The campaign keeps
Amp's useful pattern of explicit deliverables, false-success traps, and evidence
boundaries, without copying its product-specific instructions.

The user authorized 20 fresh runs and then four replacements. The eight fully
observed old/new pairs tied on task outcome; no incremental task success was
established. Do not promote these edits as proven improvements. Retain the
[ten fixed cases](../source/evals/session-grounded-skill-campaign.md), resolve
the remaining replay gaps, and use harder production-shaped cases before
adding more instruction text.

## Selection Method And Limits

The read-only local scan normalized 468 transcript files into 309 session
identities: 281 Codex and 28 Pi. Codex candidates came from session filenames
on or after 2026-09-25, including compressed archives; Pi included the sparse
available history from July through October. The current Amp comparison and
campaign conversation was excluded. Duplicate exports with the same host and
session identity were collapsed to the richest retained record. Forks can still
share earlier turns, so neither files nor sessions are independent trials.

The scan looked for explicit skill-path references, user follow-ups, terminal
reports, and tool evidence. Paths in search, patch, or inventory commands were
only triage leads: they were not counted as successful skill activation.
Seven traces were inspected more closely. The main selection criteria were:

- A concrete consequence or user correction, not an aesthetic dislike of prose.
- Evidence that distinguishes the requested result from an easier substitute.
- A remaining decision gap in the current canonical owner.
- A local fix that does not duplicate a sibling skill or expand authority.

No frequency-derived failure rate is claimed. Silent successes, encrypted
handoffs, partial sessions, missing activation evidence, model differences, and
changed historical skill versions prevent that inference. A user follow-up can
add scope rather than reveal an earlier mistake. The observations below retain
that distinction. Historical instruction text is evidence, not current authority.

All 30 skills at the pinned source revision were included in the source
inventory. Skills with little observed traffic were not called weak for lack of
usage. Current `semantic-ratchet`, Kotlin proof/review guidance, Git delivery,
and controlled writing already contain strong relevant safeguards; historical
issues they now address did not justify rewriting them again.

## The Five Targets

### 1. TDD: Prove The Requested Interface

**Observed:** P01 first answered a live stress-test request with passing module
tests. The user clarified that they meant a real multi-hop backend read. The
later live probe found a relationship mismatch the suite summary did not expose.
No TDD skill read is established for that Pi trace, so this is not evidence that
a loaded current TDD skill was bypassed.

C01 provides a separate Codex observation: after the TDD read, the assistant
reported native execution unavailable. A user-requested retry succeeded through
the installed public interface, and the assistant explicitly corrected its
earlier status-only conclusion. It correctly withheld a performance-gain claim;
that evidence honesty is retained, not treated as a failure.

**Current gap:** The skill already preserves RED/GREEN identity and limits of
narrow checks. Its trigger and routed procedures did not explicitly cover a
validation-only live smoke test or a contradictory status/connection signal.

**Change:** Name the required evidence level before selecting the oracle; skip
implementation for validation-only work. Route live requests to one public-path
probe, real artifact identity, a relevant control, and honest blocked evidence.
Do not install or restart a host just to strengthen the proof.

**Control:** Explaining unit-test evidence must not start a runtime or invent RED.

### 2. Technical Documentation: Separate Build, Rendering, And Deployment

**Observed:** C02's local documentation and link checks passed, but the user
asked for a genuine-browser comparison because the published site still looked
old. The previous response explicitly said its changes were not deployed; this
is not a false deployment claim. P02 separately ended at a built local preview,
which is valid for that request but does not establish visual inspection.
Neither trace establishes activation of `technical-documentation`; their
workflow need is assigned to its current canonical responsibility.

**Current gap:** The skill covered source, navigation, builds, and reader
comprehension but did not provide an explicit published-versus-local procedure.

**Change:** Route rendered/deployed comparisons to the same distinctive pages,
navigation, and revision evidence on each side. Keep observed mismatch separate
from guessed causes. A browser check grants no deployment authority.

**Control:** A local README typo must not start a browser or deployment workflow.

### 3. Skill Primitive Authoring: Distinguish Evidence From Package Contents

**Observed:** C03 supplied notes to clarify the intended engineering standard.
The assistant bundled the essays and examples; the user explicitly rejected
that interpretation. The trace contains a command to read the authoring skill
before the mistake, but the batched output was truncated. A complete delivered
copy at that point is not established; a later read cannot retroactively prove
activation before the failure.

**Current gap:** Provenance and progressive disclosure did not explicitly decide
whether supplied material was evidence, a normative requirement, or a requested
resource. Attribution alone cannot establish an inclusion request.

**Change:** Classify the material before copying it, justify every shipped
resource by a consumer, and keep evidence-only notes and raw sessions out of
distributable content. Historical inspection is not a fresh model comparison.

**Control:** Explicitly requested public reference material may still be bundled
with provenance and a conditional link. This is not a ban on supporting assets.

### 4. Code Knowledge Base: Check Functional Depth, Not Inventory Size

**Observed:** C04 read the knowledge skill and completed source-backed guide
work with format and citation checks. The user then requested deeper OpenWiki
coverage because the existing wiki felt shallow. That follow-up expands the
requested work; it is not proof that the earlier guide task violated its scope.
The later report described both more concepts and functional coverage. This
campaign does not independently rerun or endorse that product verification.

**Current gap:** Current completion criteria emphasize concept shape, citations,
and source drift, without an explicit obligation for a broad depth request.

**Change:** Map requested functional areas to existing explanations and gaps;
trace representative behavior through ownership, state, dependencies, failure,
and recovery. Use the existing backend. Page or package counts alone do not
establish explanatory depth. OpenWiki execution stays with its external owner.

**Control:** One code-location question must not trigger a documentation refresh.

### 5. Personal Setup: Validate Public Source Without Copying Private HOME

**Observed:** P03 read `personal-setup-management` before fixing a shell binding.
The isolated public-source check passed. A later direct-HOME aggregate traversed
private configuration and failed on unrelated broken links. Tool output shows
both the passing isolated run and the recursive-copy setup failure. The final
report correctly qualified that result; no concealed success is alleged.

**Current gap:** The skill already requested an isolated check but did not make
the input-root and public-inventory boundary explicit before aggregate checks.

**Change:** Inspect runner roots first, construct fixtures from declared public
inputs or tracked source, and never recursively copy live HOME. Report unsafe
mandatory-runner setup failures without deleting personal state or weakening
assertions. Distinguish source proof from installed and running shell state.

**Control:** A passing fixture does not authorize installation or prove activation.

## Evidence Index

The identifiers below resolve through a private local provenance map, not
checked-in transcript paths. SHA-256 values identify decompressed JSONL content;
line numbers are physical JSONL records, not rendered conversation line numbers.
Raw text, user paths, private source, and command payloads are deliberately absent.

| ID | Host | UTC date | Decisive records | Logical transcript SHA-256 |
| --- | --- | --- | --- | --- |
| P01 | Pi | 2026-10-04 | 6, 39, 44-45, 77 | `60b1e080a05adc7d5f1568d295cb547441bc8b6dbdb82e53b8fc1f198bd1f715` |
| P02 | Pi | 2026-08-21 | 4, 35, 130 | `91389f8ed514897daed1f6fa3eeb8ca64fcca8063e83d994cc9e382a801ad842` |
| P03 | Pi | 2026-10-16 | 5-7, 44, 53-56 | `f9ff33a385c109b7115ef5b2dfe7ea8a475bd363f3d5230e4b6c01c6d1694008` |
| C01 | Codex | 2026-10-01 | 12, 21, 482, 496, 1128 | `73902832074bcf42abaf229682e71d57f6d79d601c57f0b6c2dd73b0c6257903` |
| C02 | Codex | 2026-09-25 | 22, 574 and preceding report | `8077aceb189d6a75a4aa8b79c93ccc75bebc773a2285a821ed796f178e29d998` |
| C03 | Codex | 2026-10-08 | 83, 135, 140, 612 | `ebb9852feaeacf9ea04ee6e161a8d6b5d17535014bd0490d7fdf70fac8e30f01` |
| C04 | Codex | 2026-10-14 | 21, 351, 1920 | `736f4a928d59c028244ed00d6b8764d6a4c4560184c3b120cfbbc5452f361379` |

## Verification And Remaining Work

Before skill edits, source validation passed, and the routing runner reported
65 consistent designed fixtures. Its existing 18 field observations covered 17
cases; four had complete proof and 13 incomplete proof. Those figures describe
the existing corpus, not these changes or the scanned session sample.

The candidate adds no fabricated field pass, golden observation, model score,
new skill, or automatic hook. Replay execution did not install guidance or
publish remote state. The
main checkout changed during inspection, so implementation was isolated in a
separate local Worktrunk worktree at the pinned baseline, with hooks disabled.

The initial replay question timed out, so the first slice stopped at source
checks. The user subsequently authorized fresh runs and four replacements.
Private disposable fixtures were provisioned without changing the fixed task
requests or relaxing their behavioral rubrics. The source case definitions
remain candidate specifications, not a packaged replay runner.

### Post-Edit Results

- `node tools/validate-source-graph.mjs`: passed.
- `node tools/catalog.mjs --check`: passed; composition did not change.
- `node tools/run-routing-evals.mjs --require-all-fixtures --json`: all 65
  existing fixtures consistent; existing field outcomes unchanged.
- `npm test`, with the existing pinned Vale 3.24.0 and Pkl 0.32.0 paths:
  269 passed, zero failed, five skipped. The skips cover four legacy/generated
  projection checks and a native startup-context trace, not these case results.
- `uv run --locked tools/check.py`, with pinned Vale on PATH and the existing
  lock-matched project environment: Ruff format and lint passed, strict Pyright
  reported zero errors, and pytest reported 156 passed, 18 skipped. The skips
  require the separately supplied pinned Vale installation archive; they do not
  invalidate the real Vale CLI assessment tests that ran.
- Fresh Codex, GitHub Copilot, and Amp projections: passed using Pkl 0.32.0.
  All seven changed skill/reference assets match source bytes in every host
  projection: 21 host/asset comparisons. This proves delivery contents, not
  host activation or model behavior.
- Portable global manifest: refreshed, then verified current at 169 files.
  Its change carries the TDD digest and new routed reference; the global
  instruction text is unchanged. No installed snapshot was modified.
- `git diff --check` and `git diff --cached --check`: passed. New authored
  files use intent-to-add entries so Git-based inventory checks can see them;
  no content is staged for commit.

Initial worktree validation could not resolve the existing Node dependencies;
reusing the lock-matched local dependency directory fixed that setup boundary.
The first Node and Python suite runs could not locate Vale; the same suites
passed with the existing pinned executable. The first manifest check rejected
an untracked linked reference; intent-to-add made the inventory explicit before
regeneration. These were setup/inventory failures, not product RED or evidence
of a model improvement. No assertion or gate was weakened.

These static checks do not measure model behavior. The separate live screening
below exercises bounded synthetic tasks; it does not establish broad task
reliability or reproduce the original product environments.

## Fresh Pi And Codex Screening

### Conditions And Isolation

The campaign attempted 24 fresh CLI runs: ten Pi and fourteen Codex, including
four explicitly authorized replacements. Pi was version 1.4.0; Codex CLI was
0.163.0. Both used nominal model `gpt-6.1-sol` with medium reasoning. Each
old/new pair kept the host, request, tools, and fixture behavior fixed. All 30
skills were supplied through native local skill discovery. The baseline came
from the pinned commit; the candidate included all five skill edits together.
This compares the campaign configuration, not each sentence independently.

Each run had a fresh repository, isolated HOME and agent configuration, no
extensions or MCP services, and no live project writes or publication authority.
The macOS outer sandbox was checked to reject writes outside the run directory.
Pi ran inside that boundary. Codex's first three command-using runs were blocked
by its nested native sandbox. Replacement runs disabled that inner sandbox while
retaining the verified outer boundary; they did not run unrestricted on the host.
The original blocked runs remain in the record.

Real Chromium rendered the documentation fixture through `agent-browser`. A
supervisor-owned renderer needed access to macOS temporary storage; that
exception did not apply to model-generated commands. Each renderer used a
private profile, and browsers and the local fixture server were stopped after
the screen. Temporary credential symlinks were removed; original credential
files and installed agent guidance were not changed.

The fixtures are deliberately small substitutes for the observed sessions:
query answers came from a read-only local HTTP service; local and published
sites were separate routes of one fixture server, not independent deployments;
knowledge work used a three-module local OKF store, not the original OpenWiki;
and shell work used a disposable HOME with synthetic private state. The knowledge
fixture supplied source and native validators but no pre-existing product-test
suite. These limits make this a smoke screen, not a faithful replay of all
original operational complexity.

### Observed Outcomes

`PASS` means the fixed task result and scope were supported by tool traces and
output inspection. The supervisor also checked changed paths, protected inputs,
package contents and attribution, the corrected shell oracle, and native
knowledge validation. A timeout without a response is unassessed, never a pass.

| Case | Host | Baseline | Candidate | Observation |
| --- | --- | --- | --- | --- |
| C1: public multi-hop query | Pi | PASS | PASS | Both exercised the public reader, found the wrong second hop, and rejected cached readiness as decisive proof. |
| C1N: explain unit results | Codex | PASS | PASS | Both used no tools and limited the conclusion to isolated tests. |
| C2: rendered/published comparison | Codex | PASS | PASS | Both used real Chromium and identified the old revision, missing navigation, and absent architecture page. |
| C2N: README typo | Pi | PASS | PASS | Both changed only the typo, without starting a browser or deployment. |
| C3: evidence-only notes | Pi | PASS | PASS | Both amended the existing owner without copying private examples or bundling notes. |
| C3N: authorized public reference | Codex | PASS, replacement | PASS, replacement | Both retained exact public example bytes, attribution, and a conditional link. |
| C4: functional knowledge depth | Codex | QUALIFIED, replacement | UNASSESSED | Baseline added source-backed flow, cancellation, and recovery explanations and passed native checks; its additional strict format check lacked PyYAML. Both candidate attempts produced no response before the limit. |
| C4N: locate cancellation | Pi | PASS | PASS | Both answered from existing knowledge and source without generating pages. |
| C5: public shell fix | Pi | PASS | PASS | Both fixed quoting and ran the public fresh-shell check without copying private HOME or invoking the recursive aggregate. |
| C5N: fixture versus running shell | Codex | UNASSESSED | UNASSESSED | Neither produced an assistant or tool response within 240 seconds. |

Across attempts, there were 16 task passes, one qualified baseline result,
three sandbox-setup blocks, and four pre-response timeouts. That is eight
complete paired observations, one unpaired qualified baseline, and seven
unassessed/blocked attempts. It is not a success-rate estimate. The three
sandbox blocks were C3N old/new and C4 old; timeouts were C4 new, its replacement,
and C5N old/new. Timeout causes were not established. Missing provider usage is
unavailable, not zero.

One routing signal changed as intended: C2's candidate read
`technical-documentation/SKILL.md` and the new rendering reference; its baseline
never read that skill but still completed the task correctly. C1's candidate
also read its new live-interface reference, while both variants already chose
TDD and found the mismatch. These are observed reads, not proof of a general
routing gain or a host discovery-cap explanation.

No outcome regression was observed in the eight completed pairs. The missing
candidate knowledge result and shell-state controls prevent claiming that the
whole campaign is regression-free. No speed, token-saving, or reliability gain
is claimed from one trial per completed condition.

### Decision And Evidence Retention

Hold promotion. The present baseline already handled the successful probes,
including the historical failure patterns. These bounded fixtures therefore
do not establish that the chosen five are today's weakest workflows. The
history remains useful intake evidence, not a current failure-rate ranking.
The appropriate next experiment is a more discriminating task sample with
repeated paired runs, not more instructions fitted to these passing probes.
Further model usage needs its own applicable authorization.

Raw sessions, exact commands, skill hashes, fixture inventories, captured
outputs, provider usage when emitted, scope checks, and manual assessments stay
in a private local run bundle. Both initial failures and replacements are kept.
No fresh result was inserted into the existing golden routing fixtures or
represented as a historical field observation. No source skill changed during
these runs. Replay execution left campaign changes uncommitted and uninstalled;
fixture baseline commits exist only in disposable repositories. Publishing the
candidate for review is a separate follow-up, not promotion or activation.

Private artifact identities:

- Run manifest SHA-256: `767092cb7b27e2d50f9725eb991672ca248c380e5b232dee24b8485a55b441fe`.
- Reviewed screen SHA-256: `42f1927fe4295cec8dc2fab0cba12e676929ec3ce9b493e24aa4ed7934df5dfb`.
- Runner SHA-256: `5d7cdc5dc3640081c7d00040b77a3e3734c293060e748b4518b087dc08fc05c7`.

The private bundle is needed to resolve these hashes; this public-safe report
alone is not a replayable benchmark package.
