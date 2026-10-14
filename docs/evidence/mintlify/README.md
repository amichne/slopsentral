# Slopsentral site evidence

This record covers 16 authored Mintlify pages and their navigation.
The source checkout starts at `154e0bb4bd273052506c12c46aca01ded166fe24`.
The site source is `docs/public`.
The documentation entry in the root README and the glossary scope also changed.

## Results

| Procedure | Outcome | Scope |
| --- | --- | --- |
| `mint validate` with CLI 4.2.879 | passed | Strict local site build |
| `mint broken-links` with CLI 4.2.879 | passed | Local link scan |
| Manifest comparison | passed | Five plugin skill lists, 28 unique skills, and 16 unique navigation paths |
| Missing-page negative control | passed | Strict validation rejected a nonexistent page in a disposable site copy |
| `node --test tools/tests/glossary-json.test.mjs` | passed | Two glossary schema and generated-view cases |
| `node tools/validate-source-graph.mjs` | passed | Current source graph |
| `node tools/catalog.mjs --check` | passed | Current generated catalog |
| `git diff --check` | passed | Diff whitespace |
| Local browser review | passed | Landing page, Reference navigation, source diagram, and Maintainers navigation |
| Fresh provider installation | not run | CLI help and provider documentation support the command syntax |
| Provider projections | not run | No marketplace or plugin composition changed |
| Full Python gate | not run | No Python implementation changed |
| Human reader review | not run | No independent reader feedback |
| Hosted Slopsentral deployment | created | `slopsentral.mintlify.site` exists. The prepared documentation still needs its Git connection. |

The signed-in Mintlify dashboard created the separate `slopsentral` deployment.
The deployment currently serves the Mintlify starter content.
The prepared documentation will use `feature/slopsentral-docs` and `docs/public` during review.
The existing Kast deployment keeps its Git source and content.

## Prose assessment

The assessment uses the checkout's canonical `controlled-technical-writing` script.
The local installer supplied Vale 3.24.0 from its pinned archive.
The JSON glossary remains provisional.
Its scope now includes the root README and public MDX pages.
No term definition or replacement target changed.

The initial report records the first draft and its input hashes.
The final report records the revised artifacts and their input hashes.
Both reports remain outside the public site.

```bash
uv run --locked --script source/skills/controlled-technical-writing/scripts/assess_text.py \
  --vale-bin /tmp/slopsentral-d059-docs-vale/bin/vale \
  --glossary docs/glossary.json \
  README.md docs/public/**/*.mdx docs/evidence/mintlify/README.md \
  > docs/evidence/mintlify/text-assessment.json
```

`ASSESSED` means that the procedure ran.
It does not mean that the report contains no findings.
Exit `1` records the grade advisories that remain.
The report does not assess reader comprehension.

## Reasons to keep grade advisories

Each listed finding uses `Slopsentral.Grade` at line `1` of the named artifact.
The location represents the whole-document estimate.
The prose keeps the named contracts and product terms after a wording review.
No rule, threshold, or vocabulary exception changed.

| Artifact | Technical reason |
| --- | --- |
| `README.md` | The existing overview names tools, contracts, source ownership, and evidence limits. The edit keeps those facts. |
| `docs/public/index.mdx` | The page names the three main plugins and separates installation from host consumption. |
| `docs/public/guides/controlled-writing.mdx` | The procedure names the assessment, terminology scope, finite outcomes, and report limits. |
| `docs/public/guides/install.mdx` | Provider names, marketplace configuration, inventories, and workspace enrollment define the installation result. |
| `docs/public/guides/troubleshooting.mdx` | The symptoms need exact provider, hook, glossary, projection, and Kast terms. |
| `docs/public/maintainers/contribute.mdx` | The procedure distinguishes authored ownership, strict analysis scope, gates, and publication authority. |
| `docs/public/maintainers/projection.mdx` | The description keeps Pkl models, provenance, digests, source freshness, and atomic publication distinct. |
| `docs/public/plugins/developer-tooling.mdx` | The description names Developer Tooling, Python Tooling, agent definitions, and explicit composition. |
| `docs/public/plugins/intellij-plugin-development.mdx` | The page keeps IntelliJ Plugin Development, Kotlin Engineering, PSI, and installed IDE evidence exact. |
| `docs/public/plugins/kotlin-engineering.mdx` | The page keeps Kotlin Engineering, constrained values, sealed hierarchies, compiler rejection, and workspace discovery exact. |
| `docs/public/plugins/repository-knowledge.mdx` | The page names the two writing skills and distinguishes source authority from generated knowledge. |
| `docs/public/plugins/software-engineering.mdx` | The page keeps Software Engineering, finite outcomes, consumer contracts, and publication authority distinct. |
| `docs/public/reference/architecture.mdx` | The reference names manifests, generated consumers, provenance, identities, and hook consumption. |
| `docs/public/reference/glossary.mdx` | The reference keeps terminology scope, synonymy, provisional status, and replacement targets distinct. |
| `docs/public/reference/profiles.mdx` | The reference names configuration, reconciliation, saved transactions, and installation effects. |
| `docs/evidence/mintlify/README.md` | The report keeps assessment outcomes, glossary scope, provenance, and comprehension limits exact. |

The README's initial diction finding at line `49` used `Slopsentral.Diction` for `retain`.
The final prose uses `keep` without a meaning change.

## Simulated reader review

The author reviewed the pages without the chat as a source for reader answers.
This review supplies no independent human evidence.

| Reader question | Answer in the pages |
| --- | --- |
| Which plugins serve Kotlin work? | Software Engineering and Kotlin Engineering. |
| Which plugin serves prose alone? | Repository Knowledge. |
| Which branch supplies each provider? | `harness/codex` and `harness/github-copilot`. |
| Where does a maintainer change a skill? | Its canonical directory under `source/skills`. |
| Does installation prove a model used a skill? | No. The pages state that limit. |
| Does a grade estimate prove comprehension? | No. A fresh reader result remains necessary. |
| How does the site connect to Mintlify? | Use `amichne/slopsentral`, branch `main`, and content directory `docs/public`. |

The remaining external step is the connection to the published documentation branch.
Actual agent host consumption, fresh installation, and human comprehension remain unproved.
