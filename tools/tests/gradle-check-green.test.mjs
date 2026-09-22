import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const hook = path.join(repoRoot, "source/hooks/gradle-check-green.sh");
const runner = path.join(
  repoRoot,
  "source/skills/kotlin-gradle-validation/scripts/run_gradle_task.sh",
);

function createGradleRepo() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-gradle-hook-"));
  fs.writeFileSync(path.join(directory, "settings.gradle.kts"), 'include(":app", ":lib")\n');
  for (const moduleName of ["app", "lib"]) {
    const moduleDirectory = path.join(directory, moduleName);
    fs.mkdirSync(path.join(moduleDirectory, "src/main/kotlin"), { recursive: true });
    fs.writeFileSync(path.join(moduleDirectory, "build.gradle.kts"), "plugins { kotlin(\"jvm\") }\n");
    fs.writeFileSync(path.join(moduleDirectory, "src/main/kotlin/Main.kt"), "class Main\n");
  }
  fs.writeFileSync(
    path.join(directory, "gradlew"),
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '%s\\n' \"$@\" > gradle-args.txt",
      "echo BUILD SUCCESSFUL",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return directory;
}

function runHook(directory, changedFiles, extraEnv = {}) {
  return spawnSync(hook, ["--repo", directory], {
    cwd: repoRoot,
    env: {
      ...process.env,
      INTELLIGENCE_CHANGED_FILES: changedFiles.join("\n"),
      INTELLIGENCE_GRADLE_LOG_DIR: "",
      INTELLIGENCE_GRADLE_CHECK: "",
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

function gradleArgs(directory) {
  return fs.readFileSync(path.join(directory, "gradle-args.txt"), "utf8").trim().split(/\n/);
}

test("gradle check requires an explicit task policy and creates no routine evidence", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = runHook(directory, [
    "app/src/main/kotlin/Main.kt",
    "lib/src/main/kotlin/Main.kt",
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /not configured/);
  assert.equal(fs.existsSync(path.join(directory, "gradle-args.txt")), false);
  assert.equal(fs.existsSync(path.join(directory, ".agent-turn")), false);
});

test("gradle check command can be configured by repository file", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, ".intelligence"), { recursive: true });
  fs.writeFileSync(path.join(directory, ".intelligence/gradle-check-command"), "check --stacktrace\n");

  const result = runHook(directory, ["app/src/main/kotlin/Main.kt"]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(gradleArgs(directory), [
    "--console=plain",
    "check",
    "--stacktrace",
  ]);
  assert.equal(fs.existsSync(path.join(directory, ".agent-turn")), false);
});

test("Gradle evidence capture requires an explicit log directory", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const logDirectory = path.join(directory, "handoff");
  const result = runHook(directory, ["app/src/main/kotlin/Main.kt"], {
    INTELLIGENCE_GRADLE_CHECK: ":app:test",
    INTELLIGENCE_GRADLE_LOG_DIR: logDirectory,
  });
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.exitCode, 0);
  assert.equal(evidence.task, ":app:test");
  assert.equal(path.dirname(evidence.logFile), logDirectory);
  assert.equal(fs.existsSync(evidence.logFile), true);
});

test("gradle check rejects inferred tasks and requests explicit repository tasks", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, ".intelligence"), { recursive: true });
  fs.writeFileSync(
    path.join(directory, ".intelligence/gradle-check-command"),
    "{changedTasks} --stacktrace\n",
  );

  const result = runHook(directory, ["app/src/main/kotlin/Main.kt"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /explicit.*tasks/);
  assert.equal(fs.existsSync(path.join(directory, "gradle-args.txt")), false);
});

test("gradle check skips configured command when no Gradle-owned files changed", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, ".intelligence"), { recursive: true });
  fs.writeFileSync(path.join(directory, ".intelligence/gradle-check-command"), "check --stacktrace\n");

  const result = runHook(directory, ["README.md"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no Kotlin or Gradle-owned changes detected/);
  assert.equal(fs.existsSync(path.join(directory, "gradle-args.txt")), false);
});

test("configured Gradle failure keeps its exit status without leaving logs", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "gradlew"), "#!/bin/sh\necho BUILD FAILED\nexit 1\n", { mode: 0o755 });
  const result = runHook(directory, ["app/src/main/kotlin/Main.kt"], { INTELLIGENCE_GRADLE_CHECK: ":app:test" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /BUILD FAILED/);
  assert.equal(fs.existsSync(path.join(directory, ".agent-turn")), false);
});

test("Gradle runner surfaces compilation errors before JUnit reports exist", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(directory, "gradlew"),
    [
      "#!/usr/bin/env bash",
      "echo \"e: file:///ExampleTest.kt:8:9 Unresolved reference 'expectedBehavior'\"",
      "echo 'FAILURE: Build failed with an exception.'",
      "echo \"* What went wrong:\"",
      "echo \"Execution failed for task ':app:compileTestKotlin'.\"",
      "echo 'BUILD FAILED in 1s'",
      "exit 1",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );

  const result = spawnSync(runner, ["--repo", directory, "--task", ":app:test"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).failureSummary, /Unresolved reference 'expectedBehavior'/);
});
