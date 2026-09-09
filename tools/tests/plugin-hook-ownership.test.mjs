import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

const owners = new Map();
const pluginNames = fs
  .readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
for (const pluginName of pluginNames) {
  const manifestPath = `source/plugins/${pluginName}/plugin.json`;
  if (!fs.existsSync(path.join(repoRoot, manifestPath))) continue;
  for (const hook of readJson(manifestPath).hooks ?? []) {
    const hookOwners = owners.get(hook.name) ?? [];
    hookOwners.push(pluginName);
    owners.set(hook.name, hookOwners);
  }
}

test("every authored hook has an explicit ownership policy", () => {
  const hookNames = fs.readdirSync(path.join(repoRoot, "source/hooks"))
    .filter((name) => name.endsWith(".hook.json"))
    .map((name) => name.slice(0, -".hook.json".length));

  for (const hookName of hookNames) {
    const actualOwners = [...(owners.get(hookName) ?? [])].sort();
    assert.equal(actualOwners.length, 1, `${hookName} must have one plugin owner`);
  }
});

test("agent platform authoring owns source graph validation", () => {
  assert.deepEqual(owners.get("source-graph-valid"), ["agent-platform-authoring"]);
  assert.deepEqual(owners.get("required-skill-read"), ["skill-read-policy"]);
});
