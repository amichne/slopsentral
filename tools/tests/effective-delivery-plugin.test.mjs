import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function readJson(relativePath) {
  const file = path.join(repoRoot, relativePath);
  assert.ok(fs.existsSync(file), `${relativePath} must exist`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function names(manifest, field) {
  return (manifest[field] ?? []).map((entry) => entry.name);
}

test("software engineering keeps explicit CI observation without automatic hooks", () => {
  const engineering = readJson("source/plugins/software-engineering/plugin.json");
  for (const skill of ["git-change-flow", "github-ci-operations", "issue-tracker-operations",
    "pull-request-lifecycle", "delivery-pipeline-design"]) {
    assert.ok(names(engineering, "skills").includes(skill));
  }
  assert.deepEqual(names(engineering, "hooks"), ["agents-md-turn-refresh", "repository-profile"]);
  assert.equal(
    fs.existsSync(path.join(repoRoot, "source/skills/github-ci-operations/scripts/ci_wait_for_actions")),
    true,
  );
  for (const removedPath of [
    "source/hooks/github-actions-await.hook.json",
    "source/hooks/codex/github-actions-await.hooks.json",
    "source/hooks/github-actions-await.py",
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, removedPath)), false);
  }
});

test("default delivery composition does not activate automatic CI hooks", () => {
  const marketplace = readJson("source/adaptable.marketplace.json");
  const profile = readJson("source/profiles/kotlin-repo-default.json");
  const benchmark = readJson("source/evals/plugin-benchmarks/software-engineering.json");

  assert.ok(marketplace.plugins.some((entry) => entry.name === "software-engineering"));
  assert.deepEqual(profile.plugins, [
    "software-engineering",
    "kotlin-engineering",
  ]);
  assert.equal(profile.hookPolicy.mode, "ADVISORY");
  assert.equal(profile.plugins.includes("skill-read-policy"), false);
  assert.equal(benchmark.targetName, "software-engineering");
});

test("source validation executes the issue backend contracts", () => {
  const workflow = fs.readFileSync(
    path.join(repoRoot, ".github/workflows/validate-source.yml"),
    "utf8",
  );

  assert.match(
    workflow,
    /source\/skills\/issue-tracker-operations\/scripts\/tests/,
  );
  assert.match(
    workflow,
    /source\/skills\/issue-tracker-operations\/references\/issue-backend-result\.schema\.json/,
  );
});

test("authored delivery surfaces do not require the removed GitHub adapter", () => {
  const marker = ["a", "x", "i"].join("");
  const forbidden = new RegExp(
    `gh[_-]${marker}|\\b${marker}(?:result|runner)\\b|\\.${marker}/github-actions`,
    "i",
  );
  const tracked = execFileSync(
    "git",
    ["ls-files", "-z", "--", "source"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split("\0")
    .filter((file) => file && fs.existsSync(path.join(repoRoot, file)));

  assert.deepEqual(
    tracked.filter((file) =>
      forbidden.test(
        `${file}\n${fs.readFileSync(path.join(repoRoot, file), "utf8")}`,
      ),
    ),
    [],
  );
});
