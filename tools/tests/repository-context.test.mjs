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
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  const codex = path.join(bin, "codex");
  fs.writeFileSync(codex, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(process.env.CODEX_HOME, "calls.jsonl"), JSON.stringify(args) + "\\n");
if (args.join(" ") === "--version") console.log("codex-cli 0.154.0");
else if (args.join(" ") === "plugin marketplace list --json") console.log(JSON.stringify({marketplaces: [{name: "slopsentral", marketplaceSource: {source: "https://github.com/amichne/slopsentral.git"}}]}));
else if (args.join(" ") === "plugin list --available --json") console.log(JSON.stringify({installed: ["engineering-baseline", "kotlin-engineering", "developer-tools", "effective-delivery", "code-knowledge-base"].map(name => ({name, marketplaceName: "slopsentral", installed: true}))}));
else console.log(JSON.stringify({args, cwd: process.cwd(), configured: fs.existsSync(path.join(process.cwd(), ".codex/config.toml"))}));
`, { mode: 0o755 });
  const initialized = spawnSync("git", ["init", "--quiet", repo], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, repo, codexHome, env: { PATH: `${bin}${path.delimiter}${process.env.PATH}` } };
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

test("context apply adds the selected tooling while preserving user configuration, then becomes a no-op", (t) => {
  const context = fixture(t);
  fs.writeFileSync(path.join(context.repo, "settings.gradle.kts"), "");
  fs.mkdirSync(path.join(context.repo, ".codex"));
  const target = path.join(context.repo, ".codex/config.toml");
  const original = '# User settings\nmodel = "my-model"\n[plugins."custom@elsewhere"]\nenabled = true\n[hooks.state]\n';
  fs.writeFileSync(target, original, { mode: 0o640 });
  const first = run(context, "apply");
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(first.output.type, "REPOSITORY_CONTEXT_APPLIED");
  const after = fs.readFileSync(target, "utf8");
  assert.ok(after.startsWith(original));
  assert.match(after, /\[plugins\."kotlin-engineering@slopsentral"\]\nenabled = true/u);
  assert.match(after, /\[plugins\."code-knowledge-base@slopsentral"\]\nenabled = true/u);
  assert.doesNotMatch(after, /enabled = false/u);
  assert.equal(fs.statSync(target).mode & 0o777, 0o640);
  const manifest = JSON.parse(fs.readFileSync(first.output.transaction.manifestPath, "utf8"));
  assert.equal(manifest.operation.type, "APPLY_REPOSITORY_PROFILE");
  const backup = path.join(path.dirname(first.output.transaction.manifestPath), manifest.changes[0].before.backupPath);
  assert.equal(fs.readFileSync(backup, "utf8"), original);
  const second = run(context, "apply");
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(second.output.type, "REPOSITORY_CONTEXT_UP_TO_DATE");
  assert.equal(second.output.transaction, undefined);
  assert.equal(fs.readFileSync(target, "utf8"), after);
});

test("explicitly disabled tooling, malformed config, and symlinked config fail before installing anything", (t) => {
  for (const kind of ["disabled", "invalid", "symlink"]) {
    const context = fixture(t);
    fs.writeFileSync(path.join(context.repo, "settings.gradle.kts"), "");
    const config = path.join(context.repo, ".codex");
    fs.mkdirSync(config);
    const target = path.join(config, "config.toml");
    if (kind === "symlink") fs.symlinkSync(path.join(context.root, "outside.toml"), target);
    else fs.writeFileSync(target, kind === "disabled" ? '[plugins."kotlin-engineering@slopsentral"]\nenabled = false\n' : 'model = "unterminated');
    const result = run(context, "apply");
    assert.equal(result.status, 3, result.stderr || result.stdout);
    assert.equal(result.output.type, "CONTEXT_CONFLICT");
    assert.deepEqual(fs.readdirSync(context.codexHome), []);
  }
});

test("removing the root anchor removes only the managed context block", (t) => {
  const context = fixture(t);
  const anchor = path.join(context.repo, "settings.gradle.kts");
  fs.writeFileSync(anchor, "");
  fs.mkdirSync(path.join(context.repo, ".codex"));
  const target = path.join(context.repo, ".codex/config.toml");
  const original = 'model = "my-model"';
  fs.writeFileSync(target, original);
  const first = run(context, "apply");
  assert.equal(first.status, 0, first.stderr || first.stdout);
  fs.rmSync(anchor);
  const removed = run(context, "apply");
  assert.equal(removed.status, 0, removed.stderr || removed.stdout);
  assert.equal(removed.output.type, "REPOSITORY_CONTEXT_REMOVED");
  assert.equal(fs.readFileSync(target, "utf8"), original);
});

test("modified managed blocks and symlinked anchors are rejected without rewriting them", (t) => {
  const context = fixture(t);
  const anchor = path.join(context.repo, "settings.gradle.kts");
  fs.symlinkSync(path.join(context.root, "settings.gradle.kts"), anchor);
  assert.equal(run(context, "plan").output.reason, "ANCHOR_NOT_REGULAR_FILE");
  fs.rmSync(anchor);
  fs.writeFileSync(anchor, "");
  assert.equal(run(context, "apply").status, 0);
  const target = path.join(context.repo, ".codex/config.toml");
  const modified = fs.readFileSync(target, "utf8").replace("enabled = true", "enabled = false");
  fs.writeFileSync(target, modified);
  const result = run(context, "apply");
  assert.equal(result.status, 3, result.stderr || result.stdout);
  assert.equal(result.output.reason, "MANAGED_BLOCK_CHANGED");
  assert.equal(fs.readFileSync(target, "utf8"), modified);
});

test("the session hook applies repository config and reports activation timing without leaking input", (t) => {
  const context = fixture(t);
  fs.writeFileSync(path.join(context.repo, "settings.gradle.kts"), "");
  const input = JSON.stringify({hook_event_name: "SessionStart", source: "startup", cwd: context.repo});
  const first = run(context, "hook", { input });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.output.systemMessage, /next session/u);
  assert.equal(fs.existsSync(path.join(context.repo, ".codex/config.toml")), true);
  const second = run(context, "hook", { input });
  assert.equal(second.status, 0);
  assert.deepEqual(second.output, {});
  const malformed = run(context, "hook", { input: "secret-source-payload" });
  assert.equal(malformed.status, 0);
  assert.match(malformed.output.systemMessage, /INVALID_HOOK_INPUT/u);
  assert.doesNotMatch(malformed.stdout, /secret-source-payload/u);
});

test("launch configures matching repositories before Codex starts and preserves the forwarded arguments", (t) => {
  const context = fixture(t);
  fs.writeFileSync(path.join(context.repo, "settings.gradle.kts"), "");
  const launched = run(context, "launch", { args: ["--", "exec", "inspect this project"] });
  assert.equal(launched.status, 0, launched.stderr || launched.stdout);
  assert.deepEqual(launched.output.args, ["exec", "inspect this project"]);
  assert.equal(launched.output.configured, true);
  assert.equal(launched.output.cwd, fs.realpathSync(context.repo));
});
