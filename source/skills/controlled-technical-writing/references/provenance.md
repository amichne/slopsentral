# Provenance

This is a local adaptation informed by Chris Banes's `grounded-writing` skill at
chrisbanes/skills, 84c2c53a26614236e644b3ea9eaf891c44704417, reviewed 2026-09-05.
The upstream distribution uses Apache-2.0; a copy is in [Apache-2.0.txt](Apache-2.0.txt).

Local changes: narrower routing, explicit completion evidence, repository-version
checks, and no assumed provider-specific agent. Examples and wording are locally
authored; upstream scripts and templates are not imported. For writing, keep
the user's voice and terminology rather than the upstream author's style profile.

## Vale Text Assessment

Reviewed 2026-10-08. The engine is
[vale-cli/vale v3.24.0](https://github.com/vale-cli/vale/releases/tag/v3.24.0).
The bundled files keep upstream copyright, MIT licenses, and Std's NOTICE:

- [vale-cli/readability, 20b367bc5febf7ec9b83e176b8e611d230855838](https://github.com/vale-cli/readability/tree/20b367bc5febf7ec9b83e176b8e611d230855838):
  `Readability/FleschKincaid.yml`; license in `assets/vale/licenses/readability/`.
- [vale-cli/Std, 5ce764fb447663c3eca000978c4fbab2aeb2b41c](https://github.com/vale-cli/Std/tree/5ce764fb447663c3eca000978c4fbab2aeb2b41c):
  `Std/Readability/SentenceLength.yml`; license and NOTICE in `assets/vale/licenses/Std/`.
- [vale-cli/Google, 9e2483e2f09e7f623bacbbc154adb9627bed563b](https://github.com/vale-cli/Google/tree/9e2483e2f09e7f623bacbbc154adb9627bed563b):
  `Google/ExcessiveClaims.yml`; license in `assets/vale/licenses/Google/`.

Local Slopsentral rules inherit those three rules, normalize their severity to
warning, and clarify the grade estimate's message. The diction substitutions
are locally authored. Only selected Google guidance
is imported: its full word list includes domain/product substitutions that
can change meaning. `assets/vale/resources.lock.json` records exact revisions and local file digests.

The workflow uses the official [CLI](https://docs.vale.sh/topics/cli),
[metric](https://docs.vale.sh/checks/metric), and
[scope](https://docs.vale.sh/topics/scopes) contracts. It does not import or
rebrand upstream agent skills. The shared thresholds keep the upstream
advisory defaults; they are not a new empirical calibration.

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
The local rules use the supplied writing guidance for diction, modal verbs, contractions, sentence limits, and commit limits.
The shared sentence-length and grade adapters also exist in Slopsentral's assessment source at `bb930bd`.
This setup reuses the existing local assessment engine and does not import a hosted service.
