---
name: "repository-signature-indexing"
description: "Create or maintain compact repository signature indexes that help agents route source reads, back OKF concept documents, and understand documentation impact without opening every file. Use when a codebase needs generated type or symbol summaries, JVM fully qualified names, deterministic source maps, knowledge-base backing, or drift checks for signature-level documentation."
---

# Repository Signature Indexing

Use this skill to create dense, generated source maps that help agents decide
which files to read and which OKF concept documents may be affected by a source
change. Signature indexes are navigation and backing artifacts, not
hand-authored documentation. They should be deterministic, compact, and
regenerated from source.

## Operating Contract

- Treat signature indexes as generated artifacts.
- Define the output contract before generating or committing signature files.
- Keep generated entries minimal: package, imports, types, fields, methods, and
  stable source references are usually enough.
- Prefer fully qualified names for JVM types when package metadata exists.
- Include enough stable identity for OKF concepts to cite the index:
  repository-relative path, package or namespace, exported symbols, and any
  generated contract identifiers.
- Do not hand-edit generated signature files.
- Regenerate after package moves, refactors, generated-source changes, or public
  API changes.
- If signatures are stored as structured data, validate them with a schema,
  parser, or deterministic generator check.
- Treat provider-specific materialization as an adapter. The signature contract
  should be useful without Codex, Copilot, Claude, or a runtime cache.

## Workflow

1. Choose the scope.
   Identify source roots, generated-source roots to include or exclude,
   languages, package conventions, and the output directory.

2. Define the contract.
   Specify file naming, path mirroring, index format, required fields, ordering,
   and how unknown syntax is represented. Keep this contract beside the
   generator or in repo documentation.

3. Generate deterministically.
   Sort files and symbols, normalize whitespace, avoid timestamps, and make the
   same source tree produce byte-stable output.

4. Inspect representative output.
   Check the root index, a file with multiple types, a file with no top-level
   type, and a package or import edge case.

5. Wire impact and drift detection.
   Add a check command that regenerates to a temporary directory or verifies the
   checked-in index matches source. If the repository has source-backed
   OKF concepts, map changed source files or symbols to the concepts that cite
   those signatures.

6. Use the index as a routing and backing aid.
   Read signatures first for relevance filtering, then open source files only
   when the signature indicates likely relevance or the task needs body-level
   details. OKF concepts may cite signatures for discovery, but final claims
   still need concrete source files, symbols, schemas, or generated contracts.

## Recommended Text Contract

For a line-oriented `.sig` format, keep entries stable and machine-readable:

```text
file=<relative source path>
package=<package or default>
imports=<comma-separated imports>
type=<fqcn>|kind=<class|interface|object|enum|...>|decl=<normalized declaration>
fields:
- <normalized field signature>
methods:
- <normalized method signature>
contracts:
- <generated route/schema/command/catalog identifier>
```

Use an `INDEX.sig` file containing one sorted relative path per generated
signature file. If a repo chooses JSON instead, model the same facts with a
closed schema before writing the files.

## Completion Criteria

- The signature contract is explicit and located near the generator or repo
  docs.
- Generated output is deterministic across repeated runs.
- Source paths mirror the source tree or have a documented mapping.
- Drift detection is available before relying on the index.
- Impact detection can identify affected OKF concepts when the repo has
  source-backed docs.
- Agents use the index to choose reads and page refreshes, not as a substitute
  for source when implementation details matter.
