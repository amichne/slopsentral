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
    "software-engineering",
    "engineering-excellence",
    "kotlin-engineering",
  ]);

  const baselineHooks = hookNames(selectedPlugins.get("software-engineering"));
  assert.deepEqual([...baselineHooks], ["software-engineering-context"]);
  assert.deepEqual(readJson("source/hooks/software-engineering-context.hook.json").dependsOn.map(({ name }) => name), [
    "agent-execution",
  ]);

  assert.deepEqual([...hookNames(selectedPlugins.get("engineering-excellence"))], ["engineering-excellence-context"]);
  assert.deepEqual(readJson("source/hooks/engineering-excellence-context.hook.json").dependsOn.map(({ name }) => name), ["engineering-design"]);

  assert.ok(!hookNames(selectedPlugins.get("software-engineering")).has("github-actions-await"));

  const kotlinHooks = hookNames(selectedPlugins.get("kotlin-engineering"));
  assert.deepEqual(readJson("source/hooks/kotlin-engineering-context.hook.json").dependsOn.map(({ name }) => name), [
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

  const adapter = readJson("source/hooks/codex/software-engineering-context.hooks.json");
  assert.deepEqual(Object.keys(adapter.hooks), ["SessionStart"]);
  assert.equal(profile.hookPolicy.mode, "ADVISORY");
});
