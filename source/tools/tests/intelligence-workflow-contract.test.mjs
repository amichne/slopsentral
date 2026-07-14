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
const setupAction = read(".github/actions/setup-intelligence/action.yml");

for (const [name, workflow] of [
  ["validate", validateWorkflow],
  ["materialize", materializeWorkflow],
]) {
  test(`${name} workflow pins and reuses the Intelligence installer`, () => {
    assert.match(workflow, /INTELLIGENCE_VERSION: v0\.2\.7/);
    assert.match(workflow, /uses: \.\/\.github\/actions\/setup-intelligence/);
    assert.match(workflow, /version: \$\{\{ env\.INTELLIGENCE_VERSION \}\}/);
    assert.doesNotMatch(workflow, /intelligence-\*-linux-x64\.tar\.gz/);
  });

  test(`${name} workflow projects both supported harnesses`, () => {
    assert.match(workflow, /intelligence project[\s\S]*--harness codex/);
    assert.match(workflow, /intelligence project[\s\S]*--harness github-copilot/);
    assert.doesNotMatch(workflow, /intelligence validate/);
    assert.doesNotMatch(workflow, /intelligence marketplace materialize/);
  });
}

test("installer matches the immutable v0.2.7 archive layout", () => {
  assert.match(setupAction, /asset="intelligence-\$\{version\}\.tar\.gz"/);
  assert.match(setupAction, /intelligence\/bin\/intelligence/);
  assert.match(setupAction, /gh release download "\$\{version\}"/);
  assert.match(setupAction, /--pattern SHA256SUMS/);
  assert.match(setupAction, /sha256sum --check --strict SHA256SUMS/);
  assert.match(setupAction, /"\$\{binary\}" --version/);
});

test("materialization copies each provider-native projection", () => {
  assert.match(
    materializeWorkflow,
    /codex\/\.agents\/plugins" \.agents\/plugins/,
  );
  assert.match(
    materializeWorkflow,
    /github-copilot\/\.github\/plugin" \.github\/plugin/,
  );
});
