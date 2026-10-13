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
const hook = path.join(hookRoot, "hooks/gradle-wrapper-integrity.py");

function createWrapperRepo() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-wrapper-hook-")));
  const initialized = spawnSync("git", ["init", "--quiet", directory], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  const committed = spawnSync("git", ["-C", directory,
    "-c", "user.name=Slopsentral Fixture", "-c", "user.email=fixture@example.invalid",
    "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "--allow-empty", "--no-gpg-sign",
    "-m", "Fixture baseline"], { encoding: "utf8" });
  assert.equal(committed.status, 0, committed.stderr);
  fs.mkdirSync(path.join(directory, "gradle/wrapper"), { recursive: true });
  fs.writeFileSync(path.join(directory, "gradlew"), "#!/usr/bin/env node\nprocess.exit(0);\n", { mode: 0o755 });
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

function runHook(directory, extraEnv = {}, options = {}) {
  const environment = {
    ...process.env,
    INTELLIGENCE_CHANGED_FILES: "gradle/wrapper/gradle-wrapper.properties",
    INTELLIGENCE_GRADLE_WRAPPER_INTEGRITY: "normal",
    ...extraEnv,
  };
  if (options.discoverChanges) delete environment.INTELLIGENCE_CHANGED_FILES;
  return spawnSync(hook, options.args ?? ["--repo", directory], {
    cwd: options.cwd ?? repoRoot,
    env: environment,
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

for (const location of ["omitted --repo from nested cwd", "explicit --repo subdirectory"]) {
  for (const valid of [true, false]) {
    test(`wrapper integrity reads ${valid ? "valid" : "invalid"} root metadata with ${location}`, (context) => {
      const directory = createWrapperRepo();
      context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
      const nested = path.join(directory, "app/src/main/kotlin");
      fs.mkdirSync(nested, { recursive: true });
      if (!valid) {
        fs.writeFileSync(path.join(directory, "gradle/wrapper/gradle-wrapper.properties"),
          "distributionUrl=https://untrusted.invalid/gradle-8.14.2-bin.zip\n");
      }
      const options = location.startsWith("omitted")
        ? { cwd: nested, args: [] }
        : { cwd: repoRoot, args: ["--repo", nested] };

      const result = runHook(directory, {}, options);

      assert.equal(result.status, valid ? 0 : 2, result.stderr || result.stdout);
      if (valid) {
        assert.match(result.stdout, /wrapper metadata looks valid/);
      } else {
        assert.match(result.stderr, /distributionUrl must use https:\/\/services\.gradle\.org\/distributions\//);
      }
    });
  }
}

test("wrapper integrity rejects root metadata discovered by Git from nested cwd", (context) => {
  const directory = createWrapperRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const nested = path.join(directory, "app/src/main/kotlin");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(directory, "gradle/wrapper/gradle-wrapper.properties"),
    "distributionUrl=https://untrusted.invalid/gradle-8.14.2-bin.zip\n");

  const result = runHook(directory, {}, { cwd: nested, args: [], discoverChanges: true });

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /distributionUrl must use https:\/\/services\.gradle\.org\/distributions\//);
});

test("wrapper integrity accepts valid metadata in a standalone non-Git directory", (context) => {
  const directory = createWrapperRepo();
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.rmSync(path.join(directory, ".git"), { recursive: true });

  const result = runHook(directory);

  assert.equal(result.status, 0, result.stderr || result.stdout);
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
