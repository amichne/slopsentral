import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const cli = path.join(repoRoot, "tools/slopsentral.mjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-context-test-"));
  const repo = path.join(root, "repository with spaces");
  const codexHome = path.join(root, "codex");
  fs.mkdirSync(repo);
  fs.mkdirSync(codexHome);
  const initialized = spawnSync("git", ["init", "--quiet", repo], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, repo, codexHome };
}

function run(context, action, options = {}) {
  const result = spawnSync(process.execPath, [cli, "context", action,
    ...(action === "hook" ? [] : ["--repo", options.cwd ?? context.repo]),
    "--codex-home", context.codexHome,
    ...(options.args ?? []),
  ], {
    cwd: options.cwd ?? context.repo,
    env: { ...process.env, ...(context.env ?? {}) },
    encoding: "utf8",
    input: options.input,
  });
  return { ...result, output: result.stdout.trim() ? JSON.parse(result.stdout) : undefined };
}

test("context plan selects Kotlin and knowledge tooling only from the repository root anchor", (t) => {
  const context = fixture(t);
  const nested = path.join(context.repo, "build-logic");
  fs.mkdirSync(nested);
  fs.writeFileSync(path.join(nested, "settings.gradle.kts"), "");
  const unmatched = run(context, "plan", { cwd: nested });
  assert.equal(unmatched.status, 0, unmatched.stderr || unmatched.stdout);
  assert.equal(unmatched.output.type, "REPOSITORY_CONTEXT_UNMATCHED");
  fs.writeFileSync(path.join(context.repo, "settings.gradle.kts"), "");
  const matched = run(context, "plan", { cwd: nested });
  assert.equal(matched.status, 0, matched.stderr || matched.stdout);
  assert.equal(matched.output.type, "REPOSITORY_CONTEXT_PLAN");
  assert.equal(matched.output.selection.profileName, "kotlin-repo-default");
  assert.equal(matched.output.selection.repositoryRoot, fs.realpathSync(context.repo));
  assert.deepEqual(matched.output.selection.plugins, [
    "engineering-baseline", "kotlin-engineering", "developer-tools",
    "effective-delivery", "code-knowledge-base",
  ]);
  assert.equal(fs.existsSync(path.join(context.repo, ".codex")), false);
  assert.deepEqual(fs.readdirSync(context.codexHome), []);
});
