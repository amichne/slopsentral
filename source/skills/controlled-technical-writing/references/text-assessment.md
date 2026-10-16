# Text Assessment

## Contract

Use `scripts/assess_text.py` as the measurement entry point.
Supply explicit UTF-8 English prose files in `.md`, `.mdx`, or `.txt` format.
The procedure needs only the files and Vale 3.24.0.
Language is a caller precondition. Non-English results remain unqualified.

The fixed policy reports these properties:

- `fleschKincaidGrade` estimates complexity from word, sentence, and syllable counts.
- `wordsPerSentence` reports the mean sentence length.
- `Slopsentral.LongSentence` flags sentences with more than 25 words.
- Diction rules flag selected substitutions, excessive claims, contractions, and modal verbs.

Grade 8 and 25 words are advisory defaults. They are not calibrated audience thresholds.
Keep necessary facts, technical terms, and identifiers when you review a finding.
The engine does not establish grammar, factual accuracy, semantic equivalence, or reader comprehension.

## Run

Read [local Vale](vale-local.md) for explicit installation and offline archive support.
From this skill directory, run:

```sh
uv run --locked --script scripts/assess_text.py --vale-bin /path/to/vale /path/to/document.md
```

If the pinned engine is on PATH, omit `--vale-bin`.
For a local installation, use `/path/to/installation/bin/vale`.
The procedure never installs the engine or downloads styles during assessment.

The procedure freezes each file once and uses the same bytes for metrics and findings.
It ignores global Vale configuration and removes `VALE_*` environment overrides.
Its temporary configuration uses only the bundled rules whose digests match the policy lock.
It rejects inline Vale suppression comments and never changes the supplied files.

Vale's native parser selects prose from markup.
It excludes code spans, code blocks, URLs, math, and frontmatter.
Heading and table text can receive diction findings, but summary metrics exclude headings and table cells.
Lists, link labels, and blockquotes remain prose.
Plain text has no markup exclusions.

## Outcomes

[The JSON Schema](text-assessment.schema.json) defines report version 2.
Version 2 removes the glossary fields, terminology findings, and `INCOMPLETE` outcome.
The CLI no longer accepts `--glossary`.

- `ASSESSED` means that metrics and prose rules ran. Findings can remain.
- `REJECTED` identifies a finite failure and its stage.

Exit 0 means no automated findings.
Exit 1 means findings remain.
Exit 2 means that assessment failed.
Missing engines, wrong versions, invalid input, policy drift, malformed engine output, and absent prose cannot produce success.

Keep the engine version, policy digest, document digests, metrics, and findings with locations.
Compare metrics under the same policy.
Reports omit timestamps and temporary paths, so identical inputs can produce byte-identical reports.
When precision needs a flagged passage, record its rule, location, and reason outside the source.
Keep the finding visible.

## Specialized Rules

The distributed `.vale.ini` supplies commit and Diataxis rules for direct Vale use.
The assessment uses `assessment.ini` for the same prose rules across document purposes.
Only the direct configuration adds document-purpose rules and the 20-word advisory for instructions in lists.
Direct editor previews do not examine policy integrity and do not replace the assessment report.

## Evidence Limits

The report always states `comprehension.type: NOT_ASSESSED`.
Scrambled sentences can receive the same grade as ordered sentences.
Assess comprehension separately with a reader's task and answers from the document alone.
Keep human evidence separate from a simulated review.

The engine supplies counts for this fixed formula:

```text
0.39 * words / sentences + 11.8 * estimatedSyllables / words - 15.59
```

The wrapper independently examines the arithmetic within the engine's two-decimal precision.
The sentence advisory uses a different word tokenizer from the summary metric.
Do not present those counters as identical.

## Resource Maintenance

Read [provenance](provenance.md) for upstream revisions and licenses.
Change the policy, lock digests, schema, fixtures, and CI engine pin together when you upgrade.
The lock records reviewed bytes. It is not a signature.
Do not fetch unpinned styles or replace the selected formula.

From the repository root, run the focused suite:

```sh
VALE_BIN=/path/to/vale uv run --locked pytest source/skills/controlled-technical-writing/scripts/tests/test_assess_text.py
```

The suite covers independent counts, deterministic reports, core findings, markup exclusions, invalid input, and policy integrity.
Repository Node tests examine real reports against the JSON Schema.
