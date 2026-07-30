import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function readJson(relativePath) {
  const file = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(file), `${relativePath} must exist`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function names(manifest, field) {
  return (manifest[field] ?? []).map((entry) => entry.name);
}

test("effective delivery owns GitHub CI optimization and observation", () => {
  const git = readJson("source/plugins/git-ci-operations/plugin.json");
  const delivery = readJson("source/plugins/effective-delivery/plugin.json");

  assert.deepEqual(names(git, "skills"), [
    "define-goal",
    "git-change-flow",
    "shell-script-safety",
  ]);
  assert.deepEqual(names(git, "hooks"), []);
  assert.deepEqual(names(delivery, "skills"), [
    "github-ci-operations",
    "pull-request-lifecycle",
  ]);
  assert.deepEqual(names(delivery, "hooks"), ["github-actions-await"]);
});

test("default delivery composition activates the await hook", () => {
  const marketplace = readJson("source/adaptable.marketplace.json");
  const profile = readJson("source/profiles/kotlin-repo-default.json");
  const benchmark = readJson("source/evals/plugin-benchmarks/effective-delivery.json");

  assert.ok(marketplace.plugins.some((entry) => entry.name === "effective-delivery"));
  assert.deepEqual(profile.plugins, [
    "engineering-baseline",
    "kotlin-engineering",
    "git-ci-operations",
    "effective-delivery",
  ]);
  assert.ok(profile.hooks.some((hook) => hook.name === "github-actions-await"));
  assert.equal(benchmark.targetName, "effective-delivery");
});
