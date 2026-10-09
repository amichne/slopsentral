import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");

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

  assert.match(workflows, /node tools\/validate-source-graph\.mjs/u);
  assert.doesNotMatch(workflows, /plugin-eval\s+benchmark/u);
});

function rubricFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-rubric-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repoRoot, 'source'), path.join(root, 'source'), { recursive: true });
  const file = path.join(root, 'source/evals/plugin-benchmarks/software-engineering.json');
  const benchmark = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scenario = benchmark.scenarios.find(entry => entry.id === 'pr-feedback-repair-rechecks-current-head');
  // Isolate the mutation from the historical inverted criteria being repaired.
  scenario.successChecklist = ['The run retains current-head evidence.'];
  return { scenario, check() {
    fs.writeFileSync(file, JSON.stringify(benchmark));
    return spawnSync(process.execPath, [path.join(repoRoot, 'tools/validate-source-graph.mjs'), '--repo', root],
      { encoding: 'utf8' });
  } };
}

test('benchmark success cannot repeat a linked forbidden action', t => {
  const fixture = rubricFixture(t);
  fixture.scenario.successChecklist.push('Reuse a passing check or review from an older PR head.');
  const result = fixture.check();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /successChecklist.*repeats forbidden action.*pr-feedback-repair-rechecks-current-head/u);
});

test('rubric collision checks every linked route and normalizes case and whitespace', t => {
  const fixture = rubricFixture(t);
  fixture.scenario.routingCaseIds.push('push-request-means-branch-commit-push-pr');
  fixture.scenario.successChecklist.push('  USE broad staging\n that captures unrelated user work.  ');
  const result = fixture.check();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /successChecklist.*repeats forbidden action.*push-request-means-branch-commit-push-pr/u);
});

test('explicit refusal and forbidden text from an unlinked route remain valid rubric text', t => {
  const fixture = rubricFixture(t);
  fixture.scenario.successChecklist.push('The run refuses to reuse a passing check or review from an older PR head.');
  fixture.scenario.successChecklist.push('Claim a fresh-client invocation from an enabled entry or passing unit tests.');
  const result = fixture.check();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
