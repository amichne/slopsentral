import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
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

test("documentation cases carry their evidence and assertions into a fresh workspace", () => {
  const benchmark = readJson("source/evals/plugin-benchmarks/repository-knowledge.json");
  const context = fs.readFileSync(path.join(repoRoot,
    "source/evals/files/documentation-evidence/context.md"), "utf8");
  const sections = new Map([...context.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gmu)]
    .map((match) => [match[1], match[2].trim()]));
  const required = {
    "docs-export-completeness": ["Source identity", "Export and live inventory"],
    "docs-source-revision": ["Source identity", "Registry snapshots"],
    "docs-fact-ownership": ["Source identity", "Registry snapshots", "Site ownership"],
    "docs-supported-primitive": ["Site ownership", "Proposed MDX"],
    "docs-diagram-fidelity": ["Export and live inventory"],
    "docs-rendering-gap": ["Renderer observations"],
    "docs-compact-first-result": ["Site ownership", "Compact task"],
  };
  const cases = benchmark.scenarios.filter((scenario) => Object.hasOwn(required, scenario.id));
  assert.equal(cases.length, 7);
  for (const scenario of cases) {
    assert.doesNotMatch(JSON.stringify([scenario.userInput, scenario.successChecklist]),
      /source\/evals|context\.md|documentation-evidence\.md/u,
      `${scenario.id}: the disposable repository does not contain authored eval files`);
    for (const heading of required[scenario.id]) {
      const evidence = sections.get(heading);
      assert.ok(evidence?.length, `${scenario.id}: missing canonical evidence ${heading}`);
      assert.ok(scenario.userInput.includes(evidence),
        `${scenario.id}: evidence ${heading} must travel in the prompt`);
    }
    assert.ok(scenario.successChecklist.length >= 3,
      `${scenario.id}: carry concrete review assertions, not a link to a rubric`);
  }
});

test("revision case carries independently inspectable registries and their actual diff", () => {
  const benchmark = readJson("source/evals/plugin-benchmarks/repository-knowledge.json");
  const scenario = benchmark.scenarios.find((item) => item.id === "docs-source-revision");
  const snapshots = [...scenario.userInput.matchAll(
    /```json command-registry@([ab]{8})\n([\s\S]*?)\n```/gu)];
  assert.deepEqual(snapshots.map((match) => match[1]), ["aaaaaaaa", "bbbbbbbb"],
    "the case must supply both revision artifacts before asserting a new default");
  const directory = path.join(repoRoot, "source/evals/files/documentation-evidence");
  for (const snapshot of snapshots) {
    const registry = JSON.parse(snapshot[2]);
    assert.deepEqual(registry, readJson(path.relative(repoRoot,
      path.join(directory, snapshot[1], "command-registry.json"))));
  }
  assert.equal(JSON.parse(snapshots[0][2]).commands.query.parameters.limit.default, 30);
  assert.equal(JSON.parse(snapshots[1][2]).commands.query.parameters.limit.default, 60);
  const diff = spawnSync("git", ["diff", "--no-index", "--",
    path.join(directory, "aaaaaaaa/command-registry.json"),
    path.join(directory, "bbbbbbbb/command-registry.json")], { encoding: "utf8" });
  assert.equal(diff.status, 1, diff.stderr);
  const hunk = diff.stdout.slice(diff.stdout.indexOf("@@")).trim();
  assert.ok(hunk.startsWith("@@"), "the fixture source must have a real changed hunk");
  assert.ok(scenario.userInput.includes(hunk), "the supplied diff must match the source artifacts");
});
