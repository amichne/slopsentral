import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const hook = path.join(repoRoot, "source/hooks/gradle-wrapper-integrity.sh");

function createWrapperRepo() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-wrapper-hook-"));
  fs.mkdirSync(path.join(directory, "gradle/wrapper"), { recursive: true });
  fs.writeFileSync(path.join(directory, "gradlew"), "#!/usr/bin/env bash\n", { mode: 0o755 });
  fs.writeFileSync(
    path.join(directory, "gradle/wrapper/gradle-wrapper.properties"),
    "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.2-bin.zip\n",
  );

  const jar = path.join(directory, "gradle/wrapper/gradle-wrapper.jar");
  const zipResult = spawnSync(
    "python3",
    [
      "-c",
      [
        "import sys, zipfile",
        "with zipfile.ZipFile(sys.argv[1], 'w') as jar:",
        "    jar.writestr('org/gradle/wrapper/GradleWrapperMain.class', b'class')",
      ].join("\n"),
      jar,
    ],
    { encoding: "utf8" },
  );
  assert.equal(zipResult.status, 0, zipResult.stderr);
  return directory;
}

function runHook(directory, extraEnv = {}) {
  return spawnSync(hook, ["--repo", directory], {
    cwd: repoRoot,
    env: {
      ...process.env,
      INTELLIGENCE_CHANGED_FILES: "gradle/wrapper/gradle-wrapper.properties",
      ...extraEnv,
    },
    encoding: "utf8",
  });
}

test("wrapper integrity accepts valid wrapper metadata and JAR", (context) => {
  const directory = createWrapperRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = runHook(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /wrapper metadata looks valid/);
});

test("wrapper integrity strict mode requires a distribution checksum", (context) => {
  const directory = createWrapperRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = runHook(directory, {
    INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY: "strict",
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /strict mode requires distributionSha256Sum/);
});

test("wrapper integrity rejects a non-wrapper JAR", (context) => {
  const directory = createWrapperRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "gradle/wrapper/gradle-wrapper.jar"), "not a jar\n");

  const result = runHook(directory);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be a readable JAR file/);
});

test("wrapper integrity ignores unrelated changes", (context) => {
  const directory = createWrapperRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = spawnSync(hook, ["--repo", directory], {
    cwd: repoRoot,
    env: {
      ...process.env,
      INTELLIGENCE_CHANGED_FILES: "README.md",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no Gradle wrapper changes detected/);
});
