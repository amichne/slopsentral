# Provenance

This is a local adaptation informed by Chris Banes's `grounded-writing` skill at
[chrisbanes/skills, 84c2c53a26614236e644b3ea9eaf891c44704417](https://github.com/chrisbanes/skills/tree/84c2c53a26614236e644b3ea9eaf891c44704417/skills/grounded-writing), reviewed 2026-09-05.
The upstream distribution uses Apache-2.0; a copy is in [Apache-2.0.txt](Apache-2.0.txt).

Local changes: narrower routing, explicit completion evidence, repository-version
checks, and no assumed provider-specific agent. Examples and wording are locally
authored; upstream scripts and templates are not imported. For writing, keep
the user's voice and terminology rather than the upstream author's style profile.

## Editorial guidance

Factory's examples informed the rules on vague attribution and claims of importance.
[Factory human-writing 2.1.0](https://github.com/factory-ai/factory-plugins/blob/e63e519a736140c86f37be95a529a0c44dc9a96e/plugins/droid-evolved/skills/human-writing/SKILL.md).
Its pattern catalogue, reviewed 2026-11-27, also informed the pattern rules below.
The repository at that revision has no license file, so no upstream text or examples are copied.
Factory's own revisions add facts in 13 of its 23 pairs. Its voice section asks for invented opinions and first person.
This skill rejects both under the [grounding rules](grounding.md).

A locally written reference of before-and-after examples was evaluated on 2026-11-27 and then removed.
The revision eval ran gpt-6.1-sol, gpt-6.1-terra, and claude-sonnet-5-5 at low effort, with two repetitions.
The skill with the examples passed 47 of 48 revisions, the skill without them passed 46, and no skill passed 40.
The examples added 5,764 bytes to each load and raised the mean claude-sonnet-5-5 cost per call from $0.0091 to $0.0130.
The one-revision difference is within the noise of two repetitions, so the cost was not justified.

The pattern rules `Vocabulary`, `Chatbot`, `Framing`, and `Trailing` are local work, along with the `Repetition` rule for a repeated word.
Two corpora set their tokens. The first was 150 package README files sampled from this repository's `node_modules` with seed 20261127 (132,547 words).
The second was the 23 "before" passages in Factory's skill.
The pinned policy before this change flagged a pattern in 2 of the 23 passages. The policy after it flags 12 and none of the 23 revisions.
Tokens that the README sample showed in ordinary use were left out. Examples are "feel free to", ", ensuring", and "serves as".
In the same sample, these changes removed measured false positives:

- `indicate` to `show` changed the meaning in each of its 5 hits, so the swap was removed.
- "The simplest way", "the best way", and "the best match" were 8 of 19 claim hits and are now excluded.
- `Vale.Repetition` split dotted names such as `3.x.x` in 7 of 16 hits. `Slopsentral.Repetition` replaces it.
- The glossary-marker rule matched section citations such as "RFC 4291 §2.7". A marker must now start with a letter.
- 23 general software terms, such as `namespace`, `boolean`, and `middleware`, were added to the vocabulary. Spelling hits fell from 2,630 to 2,203.

Eve's editorial checklist informed the rules on voice and passage-level review.
[Eve human-writing evaluation](https://github.com/vercel/eve/blob/cbe71057bf2de70af08378e51900e35740f780b9/.agents/skills/human-writing/eval.md).

## Vale Text Assessment

Reviewed 2026-10-08. The engine is
[Vale 3.24.0](https://github.com/vale-cli/vale/releases/tag/v3.24.0).
The bundled files keep upstream copyright, MIT licenses, and Std's NOTICE:

- [`vale-cli/readability`, 20b367bc5febf7ec9b83e176b8e611d230855838](https://github.com/vale-cli/readability/tree/20b367bc5febf7ec9b83e176b8e611d230855838):
  `Readability/FleschKincaid.yml`; license in `assets/vale/licenses/readability/`.
- [`vale-cli/Std`, 5ce764fb447663c3eca000978c4fbab2aeb2b41c](https://github.com/vale-cli/Std/tree/5ce764fb447663c3eca000978c4fbab2aeb2b41c):
  `Std/Readability/SentenceLength.yml`; license and NOTICE in `assets/vale/licenses/Std/`.
- [`vale-cli/Google`, 9e2483e2f09e7f623bacbbc154adb9627bed563b](https://github.com/vale-cli/Google/tree/9e2483e2f09e7f623bacbbc154adb9627bed563b):
  `Google/ExcessiveClaims.yml`; license in `assets/vale/licenses/Google/`.

The procedure-length rule inherits the Std word counter. The assessment reports
the Flesch-Kincaid estimate with the other document metrics. The diction substitutions
and glossary-marker rule are locally authored. Only selected Google guidance
is imported: its full word list includes domain/product substitutions that
could change meaning. Glossary-specific literal rules are generated per run
from the existing registration checker, not fetched from another style package.
`assets/vale/resources.lock.json` records exact revisions and local file digests.

The workflow uses the official [CLI](https://docs.vale.sh/topics/cli),
[metric](https://docs.vale.sh/checks/metric), and
[scope](https://docs.vale.sh/topics/scopes) contracts.
The local sentence rule uses length and repeated
condition words to locate passages for review.

## Complexity Research Boundary

The Safari reading and added repository informed the choice, not more
runtime modes. [Ladderpath complexity](https://arxiv.org/html/2606.11531v1) and
[morphological complexity](https://www.lingref.com/cpp/wccfl/26/paper1657.pdf)
address different properties from a technical reader's task comprehension.
The [T.E.R.A. comparison](https://dergipark.org.tr/en/download/article-file/375100)
does not establish a universal cutoff for our documents. The
[Flesch-Kincaid overview](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests)
was background; the executable formula comes from the pinned Vale resource.

[julienijs/Linguistic-complexity, 570d674e64ed9ff758dacfce676501c4d3c19811](https://github.com/julienijs/Linguistic-complexity/tree/570d674e64ed9ff758dacfce676501c4d3c19811)
uses deletion/compression measures. Its scripts contain unseeded randomized
deletion and a different iteration count from the README. They are not used
as a deterministic prose readability gate. No claim is made that the selected
count-based estimate captures every form of linguistic complexity.

## Local Vale distribution

The local installer pins [Vale 3.24.0](https://github.com/vale-cli/vale/releases/tag/v3.24.0), examined on 2026-10-13.
The official release metadata supplies the archive digests in the script.
The installed archive supplies Vale's MIT license.
The [standalone quickstart](https://vale.sh/AGENTS.md) informs configuration and explicit CLI commands.
The skill excludes its hosted lookup advice and all CMS and MCP integration.

The bundle keeps these upstream rule files unchanged:

- [Commits v0.2.0](https://github.com/jdkato/commits/releases/tag/v0.2.0): the core rules, shared rule definitions, Conventional style, and Commit view.
  The release archive SHA-256 is `ed383cd2233d24ca725e4546fa3a51e3e85684906c61420df9246ac889a52e39`.
- [Diataxis v0.1.0](https://github.com/jdkato/diataxis/releases/tag/v0.1.0): Tutorial, HowTo, Reference, and Explanation styles.
  The release archive SHA-256 is `46d16f98b049d90fcf14f55b2b76f5c634f9a9477db3f53904934186ab23cc0b`.
- [Std at 5ce764fb447663c3eca000978c4fbab2aeb2b41c](https://github.com/vale-cli/Std/tree/5ce764fb447663c3eca000978c4fbab2aeb2b41c): the sentence-length rule and its licenses.
- [readability at 20b367bc5febf7ec9b83e176b8e611d230855838](https://github.com/vale-cli/readability/tree/20b367bc5febf7ec9b83e176b8e611d230855838): the Flesch-Kincaid rule and its MIT license.

`assets/vale/licenses/` keeps the upstream licenses and notices.
Diataxis names Daniele Procida's framework and its CC BY-SA 4.0 provenance in its notice.
The package does not claim affiliation with that framework.

Slopsentral owns the installer, configuration, vocabulary, and rules under `styles/Slopsentral/`.
We calibrated word choice against [Pierre’s Diffs documentation](https://diffs.com/docs).
The edit-state guide uses `retain` for data kept in memory. The beta notice uses `may` for a possible change.
The local rules accept both uses. Paired assessment tests cover wordy substitutes, hedged commands, and unsupported claims.
This setup reuses the existing local assessment engine and does not import a hosted service.

## Glossary protocol

The glossary protocol and template are local work based on the user's naming requirements.
They need current domain usage, standalone definitions, and evidence of equivalence before synonym registration.
They do not treat conceptual similarity as equivalence.
The [authoring reference](glossary-authoring.md#prior-work) cites the terminology sources examined on 2026-10-13.
It uses Microsoft's domain-language guidance, Google's audience guidance, and W3C SKOS's distinctions between labels and concepts.
The ISO 704:2022 overview supplies scope information only, not a claim of full access or compliance.
The glossary's domain sources support the chosen names. Repository contracts determine Slopsentral's local meaning.
Vale's pinned source and local behavior support lexical tooling only.
No upstream protocol, remote server, or terminology service is imported.

## Structured glossary contract

The JSON Schema, immutable parser, traversal, and reader-view generator are local work.
The same skill owns the structured contract and the existing Markdown parser.
External usage URLs remain inert citations.
The [jsonschema documentation](https://python-jsonschema.readthedocs.io/en/stable/validate/) supplies the local schema-validation API.
The contract uses the [W3C SKOS distinctions](https://www.w3.org/TR/skos-primer/) between concept identity, labels, relationships, and scope notes.
It does not implement SKOS or claim that a lexical match proves semantic equivalence.
The first eight entries remain provisional and contain no invented replacement targets.
