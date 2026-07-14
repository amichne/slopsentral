import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const validateWorkflow = read(".github/workflows/validate-source.yml");
const materializeWorkflow = read(".github/workflows/materialize-marketplace.yml");

for (const [name, workflow] of [
  ["validate", validateWorkflow],
  ["materialize", materializeWorkflow],
]) {
  test(`${name} workflow directly projects through the pinned Intelligence action`, () => {
    assert.equal(
      workflow.match(/uses: amichne\/intelligence@v0\.2\.8/g)?.length,
      2,
    );
    assert.equal(workflow.match(/version: v0\.2\.8/g)?.length, 2);
    assert.equal(workflow.match(/source: \./g)?.length, 2);
    assert.doesNotMatch(workflow, /setup-intelligence/);
    assert.doesNotMatch(workflow, /INTELLIGENCE_VERSION/);
  });

  test(`${name} workflow projects both supported harnesses`, () => {
    assert.match(workflow, /harness: codex/);
    assert.match(workflow, /harness: github-copilot/);
    assert.doesNotMatch(workflow, /intelligence project/);
    assert.doesNotMatch(workflow, /intelligence validate/);
    assert.doesNotMatch(workflow, /intelligence marketplace materialize/);
  });
}

test("the obsolete repository-local Intelligence installer is absent", () => {
  assert.equal(
    fs.existsSync(path.join(repoRoot, ".github/actions/setup-intelligence/action.yml")),
    false,
  );
});

test("materialization copies each provider-native projection", () => {
  assert.match(
    materializeWorkflow,
    /\$\{CODEX_PROJECTION\}\/\.agents\/plugins" \.agents\/plugins/,
  );
  assert.match(
    materializeWorkflow,
    /\$\{GITHUB_COPILOT_PROJECTION\}\/\.github\/plugin" \.github\/plugin/,
  );
});
