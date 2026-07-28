import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function plugin(name) {
  return readJson(`source/plugins/${name}/plugin.json`);
}

test("IntelliJ workflow composes shared Kotlin and delivery plugins once", () => {
  const intellij = plugin("intellij-plugin-engineering");
  assert.deepEqual(intellij.skills.map(({ name }) => name), ["intellij-plugin-delivery"]);
  assert.deepEqual(intellij.instructions.map(({ name }) => name), [
    "type-safety",
    "schema-driven-design",
  ]);
  assert.deepEqual(intellij.hooks, []);

  const profile = readJson("source/profiles/intellij-plugin-default.json");
  assert.deepEqual(profile.plugins, [
    "engineering-baseline",
    "kotlin-engineering",
    "git-ci-operations",
    "intellij-plugin-engineering",
  ]);
  assert.deepEqual(profile.hooks.map(({ name }) => name), [
    "agents-md-turn-refresh",
    "required-skill-read",
    "kotlin-horizontalization-check",
    "gradle-check-green",
    "gradle-wrapper-integrity",
    "github-actions-await",
  ]);

  const skillOwners = new Map();
  const hookOwners = new Map();
  for (const pluginName of profile.plugins) {
    const manifest = plugin(pluginName);
    for (const skill of manifest.skills ?? []) {
      skillOwners.set(skill.name, [...(skillOwners.get(skill.name) ?? []), pluginName]);
    }
    for (const hook of manifest.hooks ?? []) {
      hookOwners.set(hook.name, [...(hookOwners.get(hook.name) ?? []), pluginName]);
    }
  }

  assert.deepEqual(
    [...skillOwners].filter(([, owners]) => owners.length > 1),
    [],
  );
  for (const { name, adapter } of profile.hooks) {
    assert.equal(adapter, "codex");
    assert.equal(hookOwners.get(name)?.length, 1, `${name} must have one selected owner`);
  }
});
