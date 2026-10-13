# Local Vale

This skill distributes a standalone Vale CLI setup with local rules.
It has no Vale CMS or MCP connection, account, server registration, or hosted text analysis.
It does not send project prose to a server.

## Install

Use uv 0.12.9 or later and Python 3.12 or 3.13.
From this skill directory, run:

```sh
uv run --locked --script scripts/install_vale.py --destination /path/to/repository/.vale-local
```

The destination must not exist.
The installer copies `.vale.ini`, rules, licenses, and the Vale executable into that directory.
It does not change PATH, a global configuration, Git hooks, or a plugin connection.
It refuses an existing destination before a download.

The installer pins Vale 3.24.0 and compares the archive with a fixed SHA-256 digest.
It supports macOS, Linux, and Windows on ARM64 and x86-64.
Its network adapter permits only HTTPS requests to GitHub and GitHub artifact hosts.
It ignores ambient proxy settings and rejects other redirect hosts.
uv can separately get Python from its distribution source if a compatible interpreter is absent.

For an offline installation, supply the official archive for the host platform:

```sh
uv run --offline --no-python-downloads --locked --script scripts/install_vale.py \
  --destination /path/to/repository/.vale-local \
  --archive /path/to/vale_3.24.0_macOS_arm64.tar.gz
```

The offline command needs a compatible local Python interpreter.
Rules come from the skill bundle in both installation modes.
The configuration has no `Packages` setting.
Do not run `vale sync` or register CMS or MCP services for this setup.

The installer reports `INSTALLED` only after the version command and two commit-message smoke cases pass.
A failure reports `FAILED` with a finite `code`.
An I/O failure during the final copy can leave a partial destination.
Examine that directory before you remove it or choose a new destination.

## Lint

From the repository, use the installed executable and explicit configuration:

```sh
./.vale-local/bin/vale --no-global --config=.vale-local/.vale.ini --output=JSON README.md docs/
```

On Windows, use `bin/vale.exe`.
For a commit message, use stdin with the commit view:

```sh
./.vale-local/bin/vale --no-global --config=.vale-local/.vale.ini \
  --output=JSON --path=COMMIT_EDITMSG < .git/COMMIT_EDITMSG
```

For a review comment, use the Markdown rules:

```sh
./.vale-local/bin/vale --no-global --config=.vale-local/.vale.ini \
  --output=JSON --path=review-comment.md < /path/to/comment.txt
```

Do not impose commit structure on a review comment.
Keep the requested comment length and supplied facts.
Only an error-level finding produces a nonzero Vale exit code.
Examine warnings and suggestions even when the command returns zero.

## Defaults

Markdown, MDX, and text files use the common writing rules.
The rules advise plain diction, uncontracted forms, direct modal verbs, and sentences with at most 25 words.
Flesch-Kincaid grades greater than 8 produce an advisory.
Numbered and bulleted lists in tutorials and how-to guides also use a 20-word sentence advisory.

Commit messages use Conventional Commits and the upstream Commit view.
The view separates the subject, blank separator, Markdown body, and trailers.
Defaults reject a missing type, malformed separator, final subject period, or subject with more than 72 characters.
The imperative rule advises a command in the subject.
The body-wrap rule advises lines with at most 72 characters and exempts URLs and trailers.
The view omits Git template comments and content after the scissors marker.

The document-type sections also match nested files within these directories:

| Path | Reader purpose | Defaults |
| --- | --- | --- |
| `**/tutorials/` | Learn through an exercise | State the outcome, use numbered steps, state expected results, and keep one path. |
| `**/how-to/` | Complete a known task | Name the goal, state the task, use numbered commands, and separate explanations. |
| `**/reference/` | Find technical facts | Use neutral descriptions and examples. Separate advice and walkthroughs. |
| `**/explanation/` | Understand a mechanism | State causes and choices. Separate procedural steps and exhaustive tables. |

For another directory layout, change these sections in the installed `.vale.ini`.
Keep the common writing rules in each document-type section.
The sections classify files by path, not by inferred intent.
The upstream `Tutorial.We` suggestion never supplies authority to invent personal facts or commitments.

## Evidence limits

Vale findings are lexical and structural evidence.
They do not prove factual accuracy, reader comprehension, complete Diataxis structure, or complete compliance with controlled-English rules.
Word counts use Vale tokens and can differ from a manual count of technical identifiers.
Review procedures outside list items against the 20-word rule yourself.
Examine the six-sentence paragraph limit, verb forms, condition order, and context-dependent word meanings separately.

The built-in spelling rules use local dictionaries.
Add source-backed product names to `styles/config/vocabularies/Slopsentral/accept.txt` in the installed copy.
The vocabulary does not replace the repository glossary.
Use the bundled `check_glossary.py` command when a repository glossary exists.
For glossary creation and term selection, read [glossary authoring](glossary-authoring.md).
Use established domain terms and evidence-backed meanings before adding vocabulary entries or substitution rules.
Keep unresolved findings with their rule, location, and technical reason.

## Bundle integrity and development

`assets/vale/resources.lock.json` records the exact local configuration, rule, vocabulary, and license digests.
The installer rejects changed files, unlisted files, malformed locks, duplicate keys, and paths outside the bundle.
Examine the bundle without network access:

```sh
uv run --offline --no-python-downloads --locked --script scripts/install_vale.py --self-test
```

This command proves bundle integrity only.
For script diagnostics and real CLI evidence, run these commands from `scripts/`:

```sh
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked pyright
TEST_VALE_ARCHIVE=/path/to/the/pinned/host/archive uv run --locked pytest
```

For package projections, keep the development environment and tool caches outside the skill directory.
Set `UV_PROJECT_ENVIRONMENT` and `RUFF_CACHE_DIR` to external directories, and use `pytest -p no:cacheprovider`.

Without `TEST_VALE_ARCHIVE`, pytest skips the real CLI cases.
The network-denial case uses the macOS sandbox and skips on other hosts.
Platform-selection cases do not prove Linux or Windows runtime behavior.

## Sources

The configuration uses the standalone CLI shape from [Vale quickstart](https://vale.sh/AGENTS.md).
It replaces runtime package downloads with bundled, pinned rules.
The installer uses [Vale 3.24.0](https://github.com/vale-cli/vale/releases/tag/v3.24.0).
Read the skill [provenance](provenance.md) for rule versions, licenses, and local changes.
