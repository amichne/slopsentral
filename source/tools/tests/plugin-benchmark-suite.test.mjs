import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

test("every plugin publishes one safe benchmark definition", () => {
  const schema = readJson("source/schemas/evals/plugin-eval-benchmark.schema.json");
  assert.deepEqual(schema.$defs.runner.properties.sandbox.enum, ["workspace-write"]);
  assert.deepEqual(schema.$defs.runner.properties.approvalPolicy.enum, ["never"]);
  assert.deepEqual(schema.$defs.workspace.properties.setupMode.enum, ["git-worktree"]);
  assert.deepEqual(schema.$defs.workspace.properties.preserve.enum, ["never"]);

  const pluginNames = fs
    .readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const benchmarkNames = fs
    .readdirSync(path.join(repoRoot, "source/evals/plugin-benchmarks"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();

  assert.deepEqual(benchmarkNames, pluginNames);
  for (const pluginName of pluginNames) {
    const benchmark = readJson(`source/evals/plugin-benchmarks/${pluginName}.json`);
    assert.equal(benchmark.targetName, pluginName);
    assert.equal(benchmark.runner.sandbox, "workspace-write");
    assert.equal(benchmark.runner.approvalPolicy, "never");
    assert.deepEqual(benchmark.runner.extraArgs, []);
    assert.equal(benchmark.workspace.setupMode, "git-worktree");
    assert.equal(benchmark.workspace.preserve, "never");
    assert.ok(benchmark.scenarios.length > 0);
    for (const scenario of benchmark.scenarios) {
      assert.match(scenario.userInput, /\bDo not\b.*\b(?:remote state|remote writes)\b/u);
    }
  }
});

test("raw Plugin Eval artifacts cannot enter source control", () => {
  const ignoreLines = fs
    .readFileSync(path.join(repoRoot, ".gitignore"), "utf8")
    .split(/\r?\n/u);
  assert.ok(ignoreLines.includes(".plugin-eval/"));

  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  assert.deepEqual(
    tracked.filter((file) => file.split("/").includes(".plugin-eval")),
    [],
  );
});

test("CI validates benchmark definitions without executing agents", () => {
  const workflowRoot = path.join(repoRoot, ".github/workflows");
  const workflows = fs
    .readdirSync(workflowRoot)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => fs.readFileSync(path.join(workflowRoot, name), "utf8"))
    .join("\n");

  assert.match(workflows, /node source\/tools\/validate-source-graph\.mjs/u);
  assert.doesNotMatch(workflows, /plugin-eval\s+benchmark/u);
});
