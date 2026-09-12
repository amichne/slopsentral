import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const lifecycle = path.join(repoRoot, "tools/profile-lifecycle.mjs");

const { installSkill, plannedSkillInstalls, renderProfile } = await import("../profile-lifecycle.mjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "profile-lifecycle-test-"));
  const codexHome = path.join(root, "codex");
  const backupRoot = path.join(root, "versioned-backups");
  const bin = path.join(root, "bin");
  fs.mkdirSync(codexHome, { recursive: true });
  fs.mkdirSync(bin);
  const codex = path.join(bin, "codex");
  fs.writeFileSync(codex, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const home = process.env.CODEX_HOME;
const statePath = path.join(home, "fake-codex-state.json");
const callsPath = path.join(path.dirname(home), "fake-codex-calls.jsonl");
const plugins = ${JSON.stringify([
    "agent-platform-authoring",
    "api-contracts",
    "code-knowledge-base",
    "developer-tools",
    "effective-delivery",
    "engineering-baseline",
    "intellij-engineering",
    "kotlin-engineering",
    "pkl-engineering",
    "skill-read-policy",
    "terminal-ui-design",
    "writing",
  ])};
const readState = () => fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { marketplace: false, installed: [] };
const writeState = value => fs.writeFileSync(statePath, JSON.stringify(value));
fs.appendFileSync(callsPath, JSON.stringify(process.argv.slice(2)) + "\\n");
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(process.env.FAKE_CODEX_VERSION || "codex-cli 0.153.4\\n");
} else if (args.join(" ") === "plugin marketplace list --json") {
  const state = readState();
  process.stdout.write(JSON.stringify({ marketplaces: state.marketplace ? [{
    name: "slopsentral",
    marketplaceSource: { sourceType: "git", source: "https://github.com/amichne/slopsentral.git" },
  }] : [] }));
} else if (args[0] === "plugin" && args[1] === "marketplace" && args[2] === "add") {
  const state = readState();
  state.marketplace = true;
  writeState(state);
  process.stdout.write(JSON.stringify({ name: "slopsentral" }));
} else if (args.join(" ") === "plugin list --available --json") {
  const state = readState();
  const item = name => ({ pluginId: name + "@slopsentral", name, marketplaceName: "slopsentral",
    installed: state.installed.includes(name), enabled: state.installed.includes(name) });
  process.stdout.write(JSON.stringify({
    installed: state.installed.map(item),
    available: state.marketplace ? plugins.filter(name => !state.installed.includes(name)).map(item) : [],
  }));
} else if (args[0] === "plugin" && args[1] === "add") {
  const name = args[2].split("@", 1)[0];
  const state = readState();
  if (!state.installed.includes(name)) state.installed.push(name);
  writeState(state);
  process.stdout.write(JSON.stringify({ pluginId: args[2], installed: true }));
} else {
  process.stderr.write("unsupported fake Codex command: " + args.join(" ") + "\\n");
  process.exitCode = 2;
}
`);
  fs.chmodSync(codex, 0o755);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { codexHome, backupRoot, bin };
}

function run(context, ...args) {
  const { codexHome, backupRoot, bin } = context;
  const result = spawnSync(
    process.execPath,
    [lifecycle, ...args, "--codex-home", codexHome, "--backup-root", backupRoot],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        CODEX_HOME: codexHome,
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
        ...(context.codexVersion ? { FAKE_CODEX_VERSION: `${context.codexVersion}\n` } : {}),
      },
    },
  );
  const output = result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
  return { ...result, output };
}

function codexCalls(context) {
  const calls = path.join(path.dirname(context.codexHome), "fake-codex-calls.jsonl");
  return fs.existsSync(calls)
    ? fs.readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
}

test("authored profiles use executable v2 desired-state policies", () => {
  const profiles = fs.readdirSync(path.join(repoRoot, "source/profiles"))
    .filter((name) => name.endsWith(".json"));
  for (const filename of profiles) {
    const profile = JSON.parse(fs.readFileSync(path.join(repoRoot, "source/profiles", filename), "utf8"));
    assert.equal(profile.schemaVersion, 2, filename);
    assert.equal("hooks" in profile, false, filename);
    assert.deepEqual(profile.hookPolicy, { type: "HOOK_POLICY", mode: "ADVISORY" }, filename);
    assert.deepEqual(profile.reconciliation, {
      type: "PLUGIN_RECONCILIATION",
      unselected: "DISABLE_UNSELECTED",
    }, filename);
    assert.deepEqual(profile.standaloneSkills, [], filename);
  }
});

test("standalone skill states render stable profile-local activation", () => {
  const profile = {
    name: "skill-state-fixture",
    marketplaces: [{ name: "slopsentral" }],
    plugins: [],
    standaloneSkills: [
      { name: "reference-doc-workflow", state: "PRESENT" },
      { name: "semantic-ratchet", state: "ABSENT" },
      { name: "repository-onboarding", state: "PRESERVE" },
    ],
    hookPolicy: { mode: "ADVISORY" },
    reconciliation: { unselected: "PRESERVE" },
  };

  const rendered = renderProfile(profile, [], "/tmp/codex-home").toString("utf8");

  assert.match(rendered, /\[\[skills\.config\]\]\npath = "\/tmp\/codex-home\/skills\/reference-doc-workflow\/SKILL\.md"\nenabled = true/u);
  assert.match(rendered, /\[\[skills\.config\]\]\npath = "\/tmp\/codex-home\/skills\/semantic-ratchet\/SKILL\.md"\nenabled = false/u);
  assert.doesNotMatch(rendered, /repository-onboarding/u);
});

test("standalone PRESENT installs idempotently and conflicting content fails closed", (t) => {
  const root = temporaryDirectory(t, "standalone-profile-skill-");
  const codexHome = path.join(root, "codex");
  fs.mkdirSync(codexHome);
  const profile = {
    standaloneSkills: [{ name: "reference-doc-workflow", state: "PRESENT" }],
  };
  const skills = new Map([["reference-doc-workflow", { path: "skills/reference-doc-workflow" }]]);

  const planned = plannedSkillInstalls(profile, skills, codexHome);
  assert.deepEqual(planned, [{
    type: "SKILL_INSTALL_PLANNED",
    name: "reference-doc-workflow",
    destination: path.join(codexHome, "skills/reference-doc-workflow"),
  }]);

  installSkill({ codexHome }, "reference-doc-workflow");
  assert.deepEqual(plannedSkillInstalls(profile, skills, codexHome), []);

  fs.appendFileSync(path.join(codexHome, "skills/reference-doc-workflow/SKILL.md"), "\nchanged\n");
  assert.throws(
    () => plannedSkillInstalls(profile, skills, codexHome),
    (error) => error.reason?.type === "SKILL_CONTENT_MISMATCH",
  );
});

function temporaryDirectory(t, prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("plan and apply reconcile the marketplace and selected plugins", (t) => {
  const context = fixture(t);

  const planned = run(context, "plan", "--profile", "local-development-default");

  assert.equal(planned.status, 0, diagnostic(planned));
  assert.deepEqual(planned.output.operations.map(({ type }) => type), [
    "MARKETPLACE_ADD_PLANNED",
    "PLUGIN_INSTALL_PLANNED",
    "PLUGIN_INSTALL_PLANNED",
    "FILE_CREATE_PLANNED",
  ]);
  assert.deepEqual(planned.output.operations.slice(1, 3).map(({ pluginId }) => pluginId), [
    "developer-tools@slopsentral",
    "engineering-baseline@slopsentral",
  ]);
  assert.deepEqual(codexCalls(context), [
    ["--version"],
    ["plugin", "marketplace", "list", "--json"],
  ]);

  const applied = run(context, "apply", "--profile", "local-development-default");

  assert.equal(applied.status, 0, diagnostic(applied));
  assert.equal(applied.output.type, "PROFILE_APPLIED");
  assert.equal(applied.output.hookReview.type, "HOOK_REVIEW_REQUIRED");
  assert.deepEqual(applied.output.hookReview.hooks, ["agents-md-turn-refresh", "repository-profile"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(context.codexHome, "fake-codex-state.json"), "utf8")), {
    marketplace: true,
    installed: ["developer-tools", "engineering-baseline"],
  });
  const generated = fs.readFileSync(
    path.join(context.codexHome, "local-development-default.config.toml"),
    "utf8",
  );
  assert.match(generated, /\[plugins\."developer-tools@slopsentral"\]\nenabled = true/);
  assert.match(generated, /\[plugins\."pkl-engineering@slopsentral"\]\nenabled = false/);
});

test("profile operations fail closed on unsupported Codex versions", (t) => {
  const context = { ...fixture(t), codexVersion: "codex-cli 0.133.9" };

  const planned = run(context, "plan", "--profile", "local-development-default");

  assert.equal(planned.status, 2, diagnostic(planned));
  assert.deepEqual(planned.output, {
    type: "UNSUPPORTED_CODEX_VERSION",
    schemaVersion: 1,
    actual: "codex-cli 0.133.9",
    required: ">=0.134.0",
  });
  assert.deepEqual(codexCalls(context), [["--version"]]);
});

function diagnostic(result) {
  return result.stderr || result.stdout || result.error?.message || "command failed without diagnostics";
}

test("apply backs up replaced user content and rollback is itself reversible", (t) => {
  const context = fixture(t);
  const target = path.join(context.codexHome, "local-development-default.config.toml");
  const original = "# personal profile\nmodel = \"gpt-5.6-terra\"\n";
  fs.writeFileSync(target, original);
  fs.chmodSync(target, 0o640);

  const applied = run(context, "apply", "--profile", "local-development-default", "--replace-existing");

  assert.equal(applied.status, 0, diagnostic(applied));
  assert.equal(applied.output.type, "PROFILE_APPLIED");
  assert.notEqual(fs.readFileSync(target, "utf8"), original);
  assert.equal(applied.output.transaction.type, "COMMITTED_TRANSACTION");
  const applyTransaction = applied.output.transaction.manifestPath;
  const applyManifest = JSON.parse(fs.readFileSync(applyTransaction, "utf8"));
  const applyChange = applyManifest.changes[0];
  assert.equal(applyChange.type, "FILE_REPLACED");
  assert.equal(
    fs.readFileSync(path.join(path.dirname(applyTransaction), applyChange.before.backupPath), "utf8"),
    original,
  );
  const generated = fs.readFileSync(target, "utf8");

  const rolledBack = run(context, "rollback", "--transaction", applyTransaction);

  assert.equal(rolledBack.status, 0, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_ROLLED_BACK");
  assert.equal(fs.readFileSync(target, "utf8"), original);
  assert.equal(fs.statSync(target).mode & 0o777, 0o640);
  assert.equal(rolledBack.output.transaction.type, "COMMITTED_TRANSACTION");
  const rollbackManifest = JSON.parse(
    fs.readFileSync(rolledBack.output.transaction.manifestPath, "utf8"),
  );
  assert.equal(rollbackManifest.operation.type, "ROLLBACK_PROFILE");
  assert.equal(rollbackManifest.operation.reversesTransactionId, applyManifest.id);
  assert.equal(rollbackManifest.changes[0].type, "FILE_REPLACED");
  assert.equal(
    fs.readFileSync(
      path.join(path.dirname(rolledBack.output.transaction.manifestPath), rollbackManifest.changes[0].before.backupPath),
      "utf8",
    ),
    generated,
  );
});

test("rollback refuses to overwrite content changed after apply", (t) => {
  const context = fixture(t);
  const applied = run(context, "apply", "--profile", "documentation-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const target = path.join(context.codexHome, "documentation-default.config.toml");
  fs.appendFileSync(target, "\n# user changed this later\n");

  const rolledBack = run(context, "rollback", "--transaction", applied.output.transaction.manifestPath);

  assert.equal(rolledBack.status, 3, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_CONFLICT");
  assert.equal(rolledBack.output.reason.type, "CURRENT_CONTENT_MISMATCH");
  assert.match(fs.readFileSync(target, "utf8"), /user changed this later/);
});

test("applying an unchanged managed profile is a no-op without a new transaction", (t) => {
  const context = fixture(t);
  const first = run(context, "apply", "--profile", "agent-authoring-default");
  assert.equal(first.status, 0, diagnostic(first));
  const manifestsBefore = fs.readdirSync(context.backupRoot, { recursive: true })
    .filter((entry) => entry.endsWith("manifest.json"));

  const second = run(context, "apply", "--profile", "agent-authoring-default");

  assert.equal(second.status, 0, diagnostic(second));
  assert.equal(second.output.type, "PROFILE_UP_TO_DATE");
  const manifestsAfter = fs.readdirSync(context.backupRoot, { recursive: true })
    .filter((entry) => entry.endsWith("manifest.json"));
  assert.deepEqual(manifestsAfter, manifestsBefore);
});

test("apply reports repaired external drift even when the overlay is unchanged", (t) => {
  const context = fixture(t);
  const first = run(context, "apply", "--profile", "local-development-default");
  assert.equal(first.status, 0, diagnostic(first));
  const statePath = path.join(context.codexHome, "fake-codex-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.installed = state.installed.filter((name) => name !== "developer-tools");
  fs.writeFileSync(statePath, JSON.stringify(state));

  const repaired = run(context, "apply", "--profile", "local-development-default");

  assert.equal(repaired.status, 0, diagnostic(repaired));
  assert.equal(repaired.output.type, "PROFILE_APPLIED");
  assert.equal("transaction" in repaired.output, false);
  assert.deepEqual(repaired.output.operations.map(({ type }) => type), [
    "PLUGIN_INSTALL_PLANNED",
    "FILE_UNCHANGED",
  ]);
  assert.ok(JSON.parse(fs.readFileSync(statePath, "utf8")).installed.includes("developer-tools"));
});

test("Codex-owned hook trust remains stable across status and apply", (t) => {
  const context = fixture(t);
  const first = run(context, "apply", "--profile", "kotlin-repo-default");
  assert.equal(first.status, 0, diagnostic(first));
  const target = path.join(context.codexHome, "kotlin-repo-default.config.toml");
  const hookState = [
    "",
    "[hooks.state]",
    "",
    "[hooks.state.\"kotlin-engineering@slopsentral:hooks/gradle-check-green.hooks.json:stop:0:0\"]",
    "enabled = true",
    "trusted_hash = \"sha256:fixture\"",
    "",
  ].join("\n");
  fs.appendFileSync(target, hookState);

  const observed = run(context, "status", "--profile", "kotlin-repo-default");
  const reapplied = run(context, "apply", "--profile", "kotlin-repo-default");

  assert.equal(observed.status, 0, diagnostic(observed));
  assert.equal(observed.output.type, "PROFILE_UP_TO_DATE");
  assert.equal(reapplied.status, 0, diagnostic(reapplied));
  assert.equal(reapplied.output.type, "PROFILE_UP_TO_DATE");
  assert.match(fs.readFileSync(target, "utf8"), /trusted_hash = "sha256:fixture"/u);
});

test("apply refuses to replace unmanaged content without explicit adoption", (t) => {
  const context = fixture(t);
  const target = path.join(context.codexHome, "kotlin-repo-default.config.toml");
  fs.writeFileSync(target, "# user-owned\n");

  const applied = run(context, "apply", "--profile", "kotlin-repo-default");

  assert.equal(applied.status, 3, diagnostic(applied));
  assert.equal(applied.output.type, "PROFILE_CONFLICT");
  assert.equal(applied.output.reason.type, "UNMANAGED_TARGET");
  assert.equal(fs.readFileSync(target, "utf8"), "# user-owned\n");
  assert.equal(fs.existsSync(context.backupRoot), false);
});

test("rolling back a created file records its bytes and can itself be reversed", (t) => {
  const context = fixture(t);
  const target = path.join(context.codexHome, "intellij-plugin-default.config.toml");
  const applied = run(context, "apply", "--profile", "intellij-plugin-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const generated = fs.readFileSync(target);

  const removed = run(context, "rollback", "--transaction", applied.output.transaction.manifestPath);
  assert.equal(removed.status, 0, diagnostic(removed));
  assert.equal(fs.existsSync(target), false);
  const removalManifest = JSON.parse(fs.readFileSync(removed.output.transaction.manifestPath, "utf8"));
  assert.equal(removalManifest.changes[0].type, "FILE_REMOVED");
  assert.deepEqual(
    fs.readFileSync(
      path.join(path.dirname(removed.output.transaction.manifestPath), removalManifest.changes[0].before.backupPath),
    ),
    generated,
  );

  const restored = run(context, "rollback", "--transaction", removed.output.transaction.manifestPath);
  assert.equal(restored.status, 0, diagnostic(restored));
  assert.deepEqual(fs.readFileSync(target), generated);
});

test("plan and status are read-only", (t) => {
  const context = fixture(t);
  const planned = run(context, "plan", "--profile", "documentation-default");
  assert.equal(planned.status, 0, diagnostic(planned));
  assert.equal(planned.output.type, "PROFILE_PLAN");
  assert.equal(planned.output.mutation.type, "FILE_CREATE_PLANNED");
  assert.equal(fs.existsSync(context.backupRoot), false);
  assert.equal(fs.readdirSync(context.codexHome).length, 0);

  const observed = run(context, "status", "--profile", "documentation-default");
  assert.equal(observed.status, 0, diagnostic(observed));
  assert.equal(observed.output.type, "PROFILE_CHANGES_REQUIRED");
  assert.equal(fs.existsSync(context.backupRoot), false);
  assert.equal(fs.readdirSync(context.codexHome).length, 0);
});

test("rollback accepts manifests only from the configured backup root", (t) => {
  const context = fixture(t);
  const applied = run(context, "apply", "--profile", "documentation-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const otherRoot = path.join(path.dirname(context.backupRoot), "other-backups");

  const rolledBack = run(
    { ...context, backupRoot: otherRoot },
    "rollback",
    "--transaction",
    applied.output.transaction.manifestPath,
  );

  assert.equal(rolledBack.status, 2, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_INVALID_REQUEST");
});

test("rollback recovers a prepared transaction left after its atomic target write", (t) => {
  const context = fixture(t);
  const applied = run(context, "apply", "--profile", "local-development-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const manifestPath = applied.output.transaction.manifestPath;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ ...manifest, lifecycle: { type: "PREPARED_TRANSACTION" } }, null, 2)}\n`,
  );

  const rolledBack = run(context, "rollback", "--transaction", manifestPath);

  assert.equal(rolledBack.status, 0, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_ROLLED_BACK");
  assert.equal(
    JSON.parse(fs.readFileSync(manifestPath, "utf8")).lifecycle.type,
    "COMMITTED_TRANSACTION",
  );
  assert.equal(
    fs.existsSync(path.join(context.codexHome, "local-development-default.config.toml")),
    false,
  );
});

test("apply refuses to follow a user-content symlink", (t) => {
  const context = fixture(t);
  const realFile = path.join(path.dirname(context.codexHome), "personal.config.toml");
  const target = path.join(context.codexHome, "documentation-default.config.toml");
  fs.writeFileSync(realFile, "# keep me\n");
  fs.symlinkSync(realFile, target);

  const applied = run(context, "apply", "--profile", "documentation-default", "--replace-existing");

  assert.equal(applied.status, 3, diagnostic(applied));
  assert.equal(applied.output.reason.type, "TARGET_NOT_REGULAR_FILE");
  assert.equal(fs.readFileSync(realFile, "utf8"), "# keep me\n");
  assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
  assert.equal(fs.existsSync(context.backupRoot), false);
});
