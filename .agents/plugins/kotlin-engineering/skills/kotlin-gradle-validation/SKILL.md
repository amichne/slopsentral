---
name: "kotlin-gradle-validation"
description: "Diagnose and verify Kotlin or JVM Gradle builds with focused tasks and native reports. Use for failing tests, compiler diagnostics, build reports, coverage, or incremental-build problems."
---

# Kotlin Gradle Validation

Use this skill for a repeatable Kotlin or JVM build/test loop. Prefer the
repository's Gradle wrapper and native reports. Bundled parsers are optional
projections over existing reports; the runner is optional when a long command
needs a durable machine-readable handoff.

## Operating Contract

- Discover the Gradle project before running broad tasks.
- Prefer the target repository's Gradle wrapper.
- Let the invoking terminal or harness capture ordinary command output. Do not
  create a second log merely to prove a short command ran.
- Read JUnit XML, JaCoCo XML, Kotlin build reports, and Gradle problem reports
  before interpreting incomplete console text.
- Run targeted module or test tasks before full suites.
- Never call a build green until the relevant Gradle command exits successfully.
- Keep domain modeling and API shape in `kotlin-engineering`; keep CI
  topology in `github-ci-operations`. Use `gradle-performance-engineering` for
  performance baselines, Develocity API analysis, and cache/compilation experiments;
  this skill owns correctness and native report diagnosis.

## Workflow

1. Discover the build.
   Read settings, root build files, wrapper properties, version catalogs, and
   relevant module build files. Determine the JDK, Kotlin and Gradle versions,
   test framework, plugins, and narrowest owning task.

2. Name the claim.
   Choose one concrete target: compile, a specific test, module tests, coverage
   threshold, flaky-test cause, or incremental-build behavior.

3. Run the narrowest command directly.

   ```bash
   ./gradlew :module:test --tests 'com.example.FocusedTest'
   ```

   Use `scripts/run_gradle_task.sh` only when the result must survive an
   interruption or cross-process handoff. Use `--stacktrace` only when native
   reports are insufficient.

4. Read structured artifacts when diagnosis needs them.

   - `scripts/parse/junit_results .` summarizes JUnit XML failures.
   - `scripts/parse/jacoco_report .` summarizes JaCoCo XML.
   - `scripts/parse/kotlin_build_report .` summarizes incremental compilation
     causes.
   - Gradle problem reports own configuration and deprecation details.

   Parser stdout is enough for an uninterrupted turn; do not persist another
   JSON file unless a caller requires one.

5. Fix the narrow boundary.
   Map evidence to source, test, configuration, or infrastructure. Do not hide a
   focused failure behind a broad refactor or aggregate build.

6. Verify proportionately.
   Rerun the focused command. Widen to the owning module, direct consumers, or a
   required aggregate task only when the changed contract reaches that ring. Do
   not repeat an unchanged successful check merely to fill a sequence.

## Failure Handling

- Compilation: start with the first stable compiler diagnostic and source span.
- Tests: start with JUnit assertion data and the relevant stacktrace head.
- Coverage: inspect the lowest relevant class or branch; do not chase a number
  with implementation-mirroring tests.
- Configuration: check plugin, Gradle, and JDK compatibility plus generated
  sources.
- Flakiness: isolate time, randomness, ordering, filesystem, network, coroutine
  scheduler, and shared-container coupling.

## Completion

Report the exact commands and outcomes, native report paths or parser output
used for diagnosis, the fixed boundary, and any wider validation not run. A
claim is supported by the focused command result and relevant native artifact;
runner JSON and copied logs are optional transport, not stronger proof.

## Script Map

- `scripts/parse/junit_results`: JUnit XML failure summary. `status: parsed`
  and exit 0 prove parsing completed, not passing tests; inspect `failed`.
  Missing reports return `unavailable`; malformed, unsupported, unreadable, or
  invalid reports return `incomplete` when files were found. Both exit 1 with
  typed error kinds. Valid evidence from a mixed set stays under `partial` and
  must not be treated as a complete aggregate.
- `scripts/parse/jacoco_report`: JaCoCo XML coverage summary.
- `scripts/parse/kotlin_build_report`: Kotlin build report summary.
- `scripts/run_gradle_task.sh`: optional durable capture for a long-running or
  transferred Gradle command.

## Optional Automatic Checks

The `gradle-check-green` hook is opt-in. Without an explicit command it skips
and claims no verification. To require a focused command at Stop, configure
`INTELLIGENCE_GRADLE_CHECK` or a single argument line in
`.intelligence/gradle-check-command`, for example
`:app:test --tests com.example.FocusedTest`. Use explicit tasks;
`{changedTasks}` inference is unsupported. `off` disables the check.

An opted-in command runs when build-owned files changed, even if a manual
check already passed. Choose this extra repository gate deliberately; the hook
does not reuse a previous success without proof of identical inputs. The Codex
adapter does not rerun on a Stop continuation; report unresolved failures and
rerun the focused command directly when needed.

Ordinary invocation streams output without evidence files. Set
`INTELLIGENCE_GRADLE_LOG_DIR` only when durable capture is required. The Codex
adapter reports bounded outcomes without copying build output into model
context; use native reports or invoke the check directly for diagnosis.
