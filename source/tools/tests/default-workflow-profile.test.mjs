import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
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
  const profileHooks = new Map(profile.hooks.map((hook) => [hook.name, hook]));

  assert.deepEqual([...selectedPlugins.keys()], [
    "engineering-baseline",
    "kotlin-engineering",
    "git-ci-operations",
  ]);

  const baselineHooks = hookNames(selectedPlugins.get("engineering-baseline"));
  assert.ok(
    baselineHooks.has("agents-md-turn-refresh"),
    "engineering-baseline must provide the AGENTS.md refresh hook used by default installs",
  );
  assert.equal(profileHooks.get("agents-md-turn-refresh")?.adapter, "codex");

  const kotlinHooks = hookNames(selectedPlugins.get("kotlin-engineering"));
  for (const hookName of ["gradle-check-green", "gradle-wrapper-integrity"]) {
    assert.ok(
      kotlinHooks.has(hookName),
      `kotlin-engineering must provide ${hookName} for default Gradle hook configuration`,
    );
    assert.equal(profileHooks.get(hookName)?.adapter, "codex");
    assert.ok(
      fs.existsSync(path.join(sourceRoot, "hooks", `${hookName}.hook.json`)),
      `${hookName} metadata must be authored as a hook primitive`,
    );
  }

  for (const [hookName] of profileHooks) {
    const owners = [...selectedPlugins.entries()]
      .filter(([, manifest]) => hookNames(manifest).has(hookName))
      .map(([name]) => name);
    assert.equal(owners.length, 1, `profile hook ${hookName} should have exactly one selected plugin owner`);
  }
});
