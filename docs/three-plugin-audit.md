# Repository Knowledge, Software Engineering, and CLI Development audit

Reviewed 2026-09-22. The three plugins retain separate owners: source-backed
knowledge artifacts, general engineering and delivery, and CLI product design.
Each plugin was evaluated as a fresh Codex projection from authored source with
Plugin Eval 0.1.2 and projeKtor v1.2.0. The results below are static estimates,
not observed model token usage or live benchmark outcomes.

| Plugin | Static score before → after | Estimated trigger tokens | Estimated implicit invocation ceiling |
| --- | ---: | ---: | ---: |
| Repository Knowledge | 77 → 77 | 215 → 135 | 2,107 → 1,978 |
| Software Engineering | 58 → 58 | 577 → 577 | 10,708 → 10,465 |
| CLI Development | 100 → 100 | 228 → 228 | 2,390 → 2,479 |

Repository Knowledge had a real false-success path: `impact --from-git` returned
an empty impact result when Git status failed, and a missing bundle also looked
like a successful empty check. Its hook maintained a separate parser and source
matching implementation. The checker now emits bounded stage and code failures,
validates the bundle, normalizes changed paths, and handles malformed rename
records. The hook calls the same checker while preserving its advisory exit
behavior. The signature-format example moved behind a conditional reference.
Focused checker and hook tests cover successful matching and failure signals,
and the projected hook was run outside the source checkout.

Software Engineering's TDD skill contradicted itself: it allowed local RED/GREEN
work but required every checkpoint to be pushed at completion. The completion
rule now follows the requested end state or applicable repository policy, with
a regression check that failed before the correction and passes after it.
Shell-review examples are deferred, and the helper command resolves from its
installed skill directory. The projected helper, repository tests, source
validation, routing replay, and both harness projections passed.

CLI Development had no actionable Plugin Eval deduction. Its CLI authoring
workflow nevertheless required a `resolve` command even when an external system
has no human-readable identifiers, and terminal design required a new motif for
routine refinements. Both are now conditional. The CLI authoring skill now requires a documented finite JSON error-code set
and a nonzero exit status on failure. The source graph, routing replay,
composition check, and both harness projections passed. No live CLI benchmark
was run.

Plugin Eval's hook-path deduction expects a single string, while the valid
projeKtor output contains a hooks array. Its Python complexity check counts
lexical decisions across whole files and does not recognize functions with
return annotations. Deferred token totals include code, tests, schemas, and
references that a task need not load. The repository's [earlier audit](plugin-choice-audit.md)
documents these limits. We retained working hook and skill layouts rather than
changing them to improve a heuristic score. Missing coverage artifacts were
reported by Plugin Eval; the listed local tests are separate evidence.
