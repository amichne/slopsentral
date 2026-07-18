import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

const owners = new Map();
for (const pluginName of fs.readdirSync(path.join(repoRoot, "source/plugins"))) {
  const manifestPath = `source/plugins/${pluginName}/plugin.json`;
  if (!fs.existsSync(path.join(repoRoot, manifestPath))) continue;
  for (const hook of readJson(manifestPath).hooks ?? []) {
    const hookOwners = owners.get(hook.name) ?? [];
    hookOwners.push(pluginName);
    owners.set(hook.name, hookOwners);
  }
}

test("every authored hook has exactly one plugin owner", () => {
  const hookNames = fs.readdirSync(path.join(repoRoot, "source/hooks"))
    .filter((name) => name.endsWith(".hook.json"))
    .map((name) => name.slice(0, -".hook.json".length));

  for (const hookName of hookNames) {
    assert.equal((owners.get(hookName) ?? []).length, 1, `${hookName} must have one plugin owner`);
  }
});

test("agent platform authoring owns source graph validation", () => {
  assert.deepEqual(owners.get("source-graph-valid"), ["agent-platform-authoring"]);
});
