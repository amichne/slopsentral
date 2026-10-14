import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const hookRoot = process.env.SLOPSENTRAL_GRADLE_HOOK_ROOT
  ? path.resolve(process.env.SLOPSENTRAL_GRADLE_HOOK_ROOT)
  : path.join(repoRoot, "source");
const hook = path.join(hookRoot, "hooks/gradle-check-green.py");
const runner = path.join(
  hookRoot,
  "skills/kotlin-gradle-validation/scripts/run_gradle_task.py",
);

function createGradleRepo() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-gradle-hook-")));
  const initialized = spawnSync("git", ["init", "--quiet", directory], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  const committed = spawnSync("git", ["-C", directory,
    "-c", "user.name=Slopsentral Fixture", "-c", "user.email=fixture@example.invalid",
    "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "--allow-empty", "--no-gpg-sign",
    "-m", "Fixture baseline"], { encoding: "utf8" });
  assert.equal(committed.status, 0, committed.stderr);
  fs.writeFileSync(path.join(directory, "settings.gradle.kts"), 'include(":app", ":lib")\n');
  for (const moduleName of ["app", "lib"]) {
    const moduleDirectory = path.join(directory, moduleName);
    fs.mkdirSync(path.join(moduleDirectory, "src/main/kotlin"), { recursive: true });
    fs.writeFileSync(path.join(moduleDirectory, "build.gradle.kts"), "plugins { kotlin(\"jvm\") }\n");
    fs.writeFileSync(path.join(moduleDirectory, "src/main/kotlin/Main.kt"), "class Main\n");
  }
  writeGradleWrapper(directory);
  return directory;
}

function writeGradleWrapper(directory, exitCode = 0, output = "BUILD SUCCESSFUL") {
  fs.writeFileSync(path.join(directory, "gradlew"), [
    "#!/usr/bin/env node",
    'const fs = require("node:fs");',
    "const args = process.argv.slice(2);",
    'fs.writeFileSync("gradle-args.txt", args.join("\\n") + "\\n");',
    'fs.writeFileSync("gradle-invocation.json", JSON.stringify({ cwd: fs.realpathSync(process.cwd()), args }));',
    `console.log(${JSON.stringify(output)});`,
    `process.exit(${exitCode});`,
    "",
  ].join("\n"), { mode: 0o755 });
}

function runHook(directory, changedFiles, extraEnv = {}, options = {}) {
  const environment = {
    ...process.env,
    INTELLIGENCE_GRADLE_LOG_DIR: "",
    INTELLIGENCE_GRADLE_CHECK: "",
    ...extraEnv,
  };
  if (changedFiles === undefined) {
    delete environment.INTELLIGENCE_CHANGED_FILES;
  } else {
    environment.INTELLIGENCE_CHANGED_FILES = changedFiles.join("\n");
  }
  delete environment.INTELLIGENCE_GRADLE_CHECK_COMMAND_FILE;
  return spawnSync(hook, options.args ?? ["--repo", directory], {
    cwd: options.cwd ?? repoRoot,
    env: environment,
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

for (const location of ["omitted --repo from nested cwd", "explicit --repo subdirectory"]) {
  for (const exitCode of [0, 7]) {
    test(`gradle check resolves the Git root with ${location} and preserves exit ${exitCode}`, (context) => {
      const directory = createGradleRepo();
      context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
      writeGradleWrapper(directory, exitCode, exitCode === 0 ? "BUILD SUCCESSFUL" : "BUILD FAILED");
      fs.mkdirSync(path.join(directory, ".intelligence"));
      fs.writeFileSync(path.join(directory, ".intelligence/gradle-check-command"),
        ':app:test --tests "example.SomeTest.with spaces" "-Pmessage=$(touch nested-hook-injected)" --stacktrace\n');
      const nested = path.join(directory, "app/src/main/kotlin");
      const options = location.startsWith("omitted")
        ? { cwd: nested, args: [] }
        : { cwd: repoRoot, args: ["--repo", nested] };

      const result = runHook(directory, ["app/src/main/kotlin/Main.kt"], {}, options);

      assert.equal(result.status, exitCode, result.stderr || result.stdout);
      assert.match(result.stdout, exitCode === 0 ? /BUILD SUCCESSFUL/ : /BUILD FAILED/);
      const invocation = JSON.parse(fs.readFileSync(path.join(directory, "gradle-invocation.json"), "utf8"));
      assert.deepEqual(invocation, {
        cwd: directory,
        args: ["--console=plain", ":app:test", "--tests", "example.SomeTest.with spaces",
          "-Pmessage=$(touch nested-hook-injected)", "--stacktrace"],
      });
      assert.equal(fs.existsSync(path.join(directory, "nested-hook-injected")), false);
      assert.equal(fs.existsSync(path.join(nested, "gradle-invocation.json")), false);
    });
  }
}

test("gradle check discovers Git changes from nested cwd without a changed-file override", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, ".intelligence"));
  fs.writeFileSync(path.join(directory, ".intelligence/gradle-check-command"), ":app:test --stacktrace\n");

  const result = runHook(directory, undefined, {}, {
    cwd: path.join(directory, "app/src/main/kotlin"), args: [],
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /BUILD SUCCESSFUL/);
  const invocation = JSON.parse(fs.readFileSync(path.join(directory, "gradle-invocation.json"), "utf8"));
  assert.deepEqual(invocation, {
    cwd: directory,
    args: ["--console=plain", ":app:test", "--stacktrace"],
  });
});

test("gradle check preserves configured execution in a standalone non-Git directory", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.rmSync(path.join(directory, ".git"), { recursive: true });
  fs.mkdirSync(path.join(directory, ".intelligence"));
  fs.writeFileSync(path.join(directory, ".intelligence/gradle-check-command"), ":app:test --stacktrace\n");

  const result = runHook(directory, ["app/src/main/kotlin/Main.kt"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /BUILD SUCCESSFUL/);
  const invocation = JSON.parse(fs.readFileSync(path.join(directory, "gradle-invocation.json"), "utf8"));
  assert.deepEqual(invocation, {
    cwd: directory,
    args: ["--console=plain", ":app:test", "--stacktrace"],
  });
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
  writeGradleWrapper(directory, 1, "BUILD FAILED");
  const result = runHook(directory, ["app/src/main/kotlin/Main.kt"], { INTELLIGENCE_GRADLE_CHECK: ":app:test" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /BUILD FAILED/);
  assert.equal(fs.existsSync(path.join(directory, ".agent-turn")), false);
});

test("Gradle runner surfaces compilation errors before JUnit reports exist", (context) => {
  const directory = createGradleRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeGradleWrapper(directory, 1, [
    "e: file:///ExampleTest.kt:8:9 Unresolved reference 'expectedBehavior'",
    "FAILURE: Build failed with an exception.",
    "* What went wrong:",
    "Execution failed for task ':app:compileTestKotlin'.",
    "BUILD FAILED in 1s",
  ].join("\n"));

  const result = spawnSync(runner, ["--repo", directory, "--task", ":app:test"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stdout).failureSummary, /Unresolved reference 'expectedBehavior'/);
});
