# Text Assessment

## Contract

Use `scripts/assess_text.py` as the only measurement entry point. Document
purpose never selects a different formula, threshold, or writing mode. The
supported boundary is UTF-8 English prose in `.md`, `.mdx`, or `.txt` files;
other formats must be supplied as a supported prose artifact, not guessed from
source code. Language is an explicit caller precondition, not an auto-detection
claim. Non-English assessments are unqualified.

The fixed policy reports:

- `fleschKincaidGrade`: `0.39 * words / sentences + 11.8 * estimatedSyllables / words - 15.59`.
  Counts come from the pinned Vale parser; the wrapper independently checks
  the arithmetic against the reported value, within its two-decimal precision.
- `wordsPerSentence` and a finding for a sentence exceeding 25 words, using
  Vale Std's occurrence rule. That rule's word regex is distinct from Vale's
  document metric tokenizer; do not imply that these counters are identical.
- Diction findings from the fixed local substitution list and Google excessive
  claims rule. Suggestions require a meaning-preserving review, not blind edits.
- Terminology findings for declared glossary aliases, noncanonical casing,
  and glossary markers outside the glossary. The existing glossary checker
  owns entry grammar, definitions, references, and lexical shadowing checks.

Grade 8 and 25 words are shared advisory defaults inherited from Vale resources,
not calibrated audience cutoffs or scientifically validated comprehension
thresholds. Lower scores are not always better: do not remove required facts,
split terms, or rename identifiers to improve a number. No composite quality
score, grade-level audience inference, or alternate compression metric is used.

## Run

Install the exact [Vale 3.24.0 release](https://github.com/vale-cli/vale/releases/tag/v3.24.0)
for the host, verifying the archive against its release checksums. A newer
package-manager version is not an equivalent engine. The skill does not
install binaries or download style packages during assessment.

From the skill directory:

```sh
python3 scripts/assess_text.py --glossary /path/to/GLOSSARY.md /path/to/README.md /path/to/runbook.md
```

Use `--vale-bin /absolute/path/to/vale` when the pinned executable is not on
PATH. Inputs must be explicit files. The procedure freezes each document and
the glossary once, disables global Vale configuration, strips `VALE_*`
environment overrides, and uses a temporary configuration containing only the
locked resources and glossary-derived literal rules. It never changes source
files. Inline Vale suppression comments are rejected.

Vale's native format parser determines prose boundaries, not a hand-written
Markdown stripper. In markup, code spans and blocks, URLs, math, and frontmatter
are excluded. Heading and table text can receive diction and terminology
findings, but Vale's summary metric excludes headings and table cells. Lists,
link labels, and blockquotes remain prose; review attributed quotes without
silently rewriting them. Plain text has no markup exclusions. Identical prose
receives the same measurement regardless of filename or document purpose;
equivalent rendered content is not claimed for arbitrary markup dialects.

## Outcomes

The canonical output contract is [text-assessment.schema.json](text-assessment.schema.json).

- `ASSESSED`: measurements and glossary checks ran. This is not a pass label.
- `INCOMPLETE`: measurements ran, but no glossary was provided. Do not claim
  checked terminology; the report retains useful evidence.
- `REJECTED`: a finite failure identifies the stage. Missing/wrong Vale,
  resource drift, invalid input/glossary, inline overrides, failed processes,
  malformed engine output, and no measurable prose cannot produce success.

Exit 0 means an assessed artifact has no automated findings; exit 1 means
findings remain; exit 2 means rejection or incomplete terminology coverage.
Keep the engine version, policy digest, glossary digest, document digests,
metrics, and located findings. Compare metrics only under the same policy and
glossary. Reports omit time and temporary paths, so repeated runs over the
same inputs can be byte-identical. Paths refer to the supplied artifacts.

Resolve a known alias against its definition before migrating it. An ordinary
word that coincides with a glossary term may need clarification, not forced
uppercase. The glossary's meaning outranks a generic diction suggestion. When
precision requires retaining a flagged sentence or term, record the rule,
location, and reason outside the source; the automated finding remains visible.
Do not add an exemption, switch thresholds, or create a synonym to hide it.

## Readability Validation

The report always says `comprehension.type: NOT_ASSESSED`. Flesch-Kincaid uses
counts and estimated syllables; it does not validate factual accuracy,
information order, grammar, or task completion. Even scrambled sentences can
receive the same score. Separately ask a fresh reader to identify the intended
action, prerequisites, and result from the document alone. Check those answers
against the authoritative source. Record who or what performed the test and
its unresolved questions; simulated reader review is not observed human proof.

## Resource Maintenance

The bundled policy reuses `vale-cli/readability`, `vale-cli/Std`, and selected
`vale-cli/Google` material. Read [provenance](provenance.md) for revisions and
licenses. Do not run `vale sync` with unpinned package names, load the full Google
style, or copy upstream agent skills into this repository. Direct Vale/editor
integration may preview the bundled `.vale.ini`, but only the wrapper verifies
integrity and loads the glossary; editor previews are not completion evidence.

Change the canonical policy, its lock digests, provenance, schema, fixtures,
and CI engine pin together when upgrading. Validate the upstream rule changes
and affected counts before accepting a new baseline. The lock is an integrity
record for reviewed source, not a signature or a guarantee against someone
editing both the rules and lock.

```sh
VALE_BIN=/absolute/path/to/vale python3 -m unittest discover -s scripts/tests -p 'test_*.py' -v
```

Fixtures prove hand-counted arithmetic, advisory activation, filename/context
invariance, separate-process repeatability, literal alias matching, markup
boundaries, and fail-closed input/configuration handling. Repository Node tests
also validate real reports and rejected shapes against the canonical schema.
