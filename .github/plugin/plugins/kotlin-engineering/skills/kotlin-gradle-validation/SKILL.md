---
name: "kotlin-gradle-validation"
description: "Iterate on Kotlin, JVM, and Gradle projects with structured build evidence. Use when running Gradle tasks, fixing failing tests, reading JUnit or JaCoCo reports, diagnosing Kotlin compilation or incremental-build problems, improving coverage, or getting a Kotlin/Gradle build green."
---

# Kotlin Gradle Validation

Use this skill when Kotlin or JVM work needs a repeatable build/test loop. The
workflow favors structured artifacts over raw console output: Gradle output is
captured, test and coverage reports are parsed from files, and every fix is
verified with the narrowest useful task before broad validation.

Use the bundled scripts whenever they are available. They make the workflow
observable: raw Gradle output goes to log files, report parsers emit JSON, and
the final answer can cite evidence files instead of terminal scrollback.

## Operating Contract

- Discover the Gradle project before running broad tasks.
- Prefer the Gradle wrapper in the target repo.
- Capture command output to logs and summarize from structured artifacts when
  possible.
- Read JUnit XML, JaCoCo XML, Kotlin build reports, and Gradle problem reports
  before interpreting console text.
- Run targeted module or test tasks before rerunning full suites.
- Never claim the build is green until the relevant Gradle command exits
  successfully.
- Preserve schema-driven rules for generated or persisted build summaries.

## Workflow

1. Discover the build.
   Read `settings.gradle(.kts)`, root build files, version catalogs, wrapper
   properties, and module build files. Record modules, dependency edges, JDK,
   Kotlin, Gradle, test frameworks, coverage tools, and notable plugins.

2. Establish the goal.
   Make the acceptance criteria concrete: compile, specific test, full test
   suite, coverage threshold, flaky test diagnosis, or incremental build
   performance.

3. Run the narrowest task.
   Prefer `./gradlew :module:test --tests ...` or `:module:compileKotlin`
   before full `test` or `build`. Use the runner so the command produces JSON
   evidence and a log file:

   ```bash
   bash scripts/run_gradle_task.sh \
     --repo . \
     --task :module:test \
     -- --tests 'com.example.FocusedTest'
   ```

   Use `--stacktrace` only when the structured report is insufficient.

4. Parse artifacts.
   Inspect:

   - `python3 scripts/parse/junit_results.py .` for
     `build/test-results/**/TEST-*.xml` failures;
   - `python3 scripts/parse/jacoco_report.py .` for
     `build/reports/jacoco/**/jacoco*.xml` coverage;
   - `python3 scripts/parse/kotlin_build_report.py .` for Kotlin build reports
     when incremental compilation matters;
   - Gradle problem reports when configuration or deprecation issues appear.

5. Fix from evidence.
   Map each failure to source, tests, configuration, or infrastructure. Avoid
   broad refactors until the failing boundary is understood.

6. Verify in widening rings.
   Run the targeted task, then the owning module task, then the requested
   aggregate task. Record exact commands and outcomes.

## Failure Handling

- For compilation errors, inspect the first stable compiler diagnostic and the
  referenced source before changing code.
- For test failures, prefer assertion messages and stacktrace heads from JUnit
  XML, then read the test and subject code.
- For coverage gaps, start with the lowest covered classes or branches rather
  than adding broad snapshot tests.
- For configuration failures, check plugin versions, Gradle/JDK compatibility,
  repository configuration, and generated sources.
- For flaky tests, repeat the narrow task and look for time, randomness,
  ordering, filesystem, network, or coroutine scheduler coupling.

## Evidence To Report

Report:

- discovery summary when it affected the command choice;
- runner JSON, log files, commands run, and exit outcomes;
- report parser JSON used for diagnosis;
- failing tests or modules fixed;
- remaining risk when full validation was not run.

## Completion Criteria

- The relevant Gradle task succeeds.
- Test, coverage, or compile claims are backed by runner JSON, report parser
  JSON, report files, or command output.
- Fixes are scoped to the failure evidence.
- Any generated summaries or persisted structured build data have a schema,
  parser, or validation path.

## Script Map

- `scripts/run_gradle_task.sh`: run one Gradle task with optional extra Gradle
  arguments, capture raw output to a log, and emit structured JSON evidence.
- `scripts/parse/junit_results.py`: summarize JUnit XML suites and failures.
- `scripts/parse/jacoco_report.py`: summarize JaCoCo XML coverage and lowest
  covered classes.
- `scripts/parse/kotlin_build_report.py`: summarize Kotlin build reports and
  non-incremental compilation causes.
