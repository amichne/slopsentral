import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const sourceRoot = path.join(repoRoot, "source");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function plugin(name) {
  return readJson(`source/plugins/${name}/plugin.json`);
}

function hookNames(manifest) {
  return new Set((manifest.hooks ?? []).map((hook) => hook.name));
}

test("kotlin default install profile wires AGENTS.md and Gradle hooks", () => {
  const profile = readJson("source/profiles/kotlin-repo-default.json");
  const selectedPlugins = new Map(profile.plugins.map((name) => [name, plugin(name)]));

  assert.deepEqual([...selectedPlugins.keys()], [
    "engineering-baseline",
    "kotlin-engineering",
    "developer-tools",
    "effective-delivery",
    "code-knowledge-base",
  ]);

  const baselineHooks = hookNames(selectedPlugins.get("engineering-baseline"));
  assert.deepEqual([...baselineHooks], ["agents-md-turn-refresh"]);
  assert.deepEqual(selectedPlugins.get("engineering-baseline").instructions.map(({ name }) => name), [
    "agent-execution",
    "engineering-design",
  ]);

  assert.deepEqual([...hookNames(selectedPlugins.get("effective-delivery"))], []);

  const kotlinHooks = hookNames(selectedPlugins.get("kotlin-engineering"));
  assert.deepEqual(selectedPlugins.get("kotlin-engineering").instructions.map(({ name }) => name), [
    "kotlin-engineering",
  ]);
  for (const hookName of ["kotlin-horizontalization-check", "gradle-check-green", "gradle-wrapper-integrity"]) {
    assert.ok(
      kotlinHooks.has(hookName),
      `kotlin-engineering must provide ${hookName} for default Gradle hook configuration`,
    );
    assert.ok(
      fs.existsSync(path.join(sourceRoot, "hooks", `${hookName}.hook.json`)),
      `${hookName} metadata must be authored as a hook primitive`,
    );
  }

  const adapter = readJson("source/hooks/codex/agents-md-turn-refresh.hooks.json");
  assert.equal(adapter.hooks.PostToolUse[0].matcher, "^(Bash|apply_patch)$");
  assert.equal(profile.hookPolicy.mode, "ADVISORY");
});
