import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const cli = path.join(repoRoot, "tools/slopsentral.mjs");

function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "slopsentral-cli-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
  });
}

function runSource(args, options = {}) {
  return run(process.execPath, [cli, ...args], options);
}

function jsonOutput(result) {
  assert.notEqual(result.stdout.trim(), "", result.stderr || "command emitted no JSON");
  return JSON.parse(result.stdout);
}

function diagnostic(result) {
  return result.stderr || result.stdout || result.error?.message || "command failed without diagnostics";
}

test("top-level help, version, and invalid requests have stable behavior", () => {
  const help = runSource(["--help"]);
  assert.equal(help.status, 0, diagnostic(help));
  assert.match(help.stdout, /^Slopsentral manages named Codex user profiles\./u);
  assert.match(help.stdout, /slopsentral profile apply <profile>/u);

  const version = runSource(["--version"]);
  assert.equal(version.status, 0, diagnostic(version));
  assert.equal(version.stdout, "slopsentral 0.1.0\n");

  const invalid = runSource(["profile", "apply"]);
  assert.equal(invalid.status, 2, diagnostic(invalid));
  assert.equal(jsonOutput(invalid).type, "SLOPSENTRAL_INVALID_REQUEST");
});

test("profile commands translate positional identities without changing lifecycle output", (t) => {
  const root = temporaryRoot(t);
  const codexHome = path.join(root, "codex");
  const backupRoot = path.join(root, "backups");
  fs.mkdirSync(codexHome);

  const planned = runSource([
    "profile",
    "plan",
    "documentation-default",
    "--codex-home",
    codexHome,
    "--backup-root",
    backupRoot,
  ]);

  assert.equal(planned.status, 0, diagnostic(planned));
  const output = jsonOutput(planned);
  assert.equal(output.type, "PROFILE_PLAN");
  assert.equal(output.profileName, "documentation-default");
  assert.equal(fs.readdirSync(codexHome).length, 0);
  assert.equal(fs.existsSync(backupRoot), false);

  const invalidFlag = runSource(["profile", "status", "documentation-default", "--replace-existing"]);
  assert.equal(invalidFlag.status, 2, diagnostic(invalidFlag));
  assert.equal(jsonOutput(invalidFlag).type, "SLOPSENTRAL_INVALID_REQUEST");
});

test("doctor is read-only and reports a missing Codex executable as advisory", (t) => {
  const root = temporaryRoot(t);
  const codexHome = path.join(root, "not-created-codex-home");
  const emptyPath = path.join(root, "empty-path");
  fs.mkdirSync(emptyPath);

  const result = runSource(["doctor"], {
    cwd: root,
    env: { ...process.env, CODEX_HOME: codexHome, PATH: emptyPath },
  });

  assert.equal(result.status, 0, diagnostic(result));
  const report = jsonOutput(result);
  assert.equal(report.type, "SLOPSENTRAL_DOCTOR");
  assert.equal(report.readiness.type, "DOCTOR_READY");
  assert.equal(report.checks.find((check) => check.name === "CODEX_CLI").type, "CHECK_WARNING");
  assert.equal(fs.existsSync(codexHome), false);
});

test("doctor represents missing package assets as a typed failure", async (t) => {
  const root = temporaryRoot(t);
  const { inspectDoctor } = await import("../slopsentral.mjs");

  const report = inspectDoctor({
    packageRoot: path.join(root, "incomplete-package"),
    environment: { HOME: root, PATH: "" },
    nodeVersion: process.version,
    probeCodex: () => ({ type: "CODEX_CLI_MISSING" }),
  });

  assert.equal(report.type, "SLOPSENTRAL_DOCTOR");
  assert.equal(report.readiness.type, "DOCTOR_NOT_READY");
  assert.equal(report.checks.find((check) => check.name === "PACKAGE_ASSETS").type, "CHECK_FAILED");
  assert.equal(fs.readdirSync(root).length, 0);
});

test("npm package contains only the portable CLI runtime", () => {
  const packed = run("npm", ["pack", "--dry-run", "--json"]);
  assert.equal(packed.status, 0, diagnostic(packed));
  const files = JSON.parse(packed.stdout)[0].files.map((file) => file.path).sort();

  assert.deepEqual(files, [
    "README.md",
    "docs/profile-lifecycle.md",
    "package.json",
    "source/adaptable.marketplace.json",
    "source/profiles/agent-authoring-default.json",
    "source/profiles/documentation-default.json",
    "source/profiles/intellij-plugin-default.json",
    "source/profiles/kotlin-repo-default.json",
    "source/profiles/local-development-default.json",
    "source/schemas/profiles/profile-transaction.schema.json",
    "source/schemas/profiles/workflow-profile.schema.json",
    "tools/profile-lifecycle.mjs",
    "tools/slopsentral.mjs",
    "tools/validate-profile-contracts.mjs",
  ]);
});

test("installed tarball manages a profile outside the repository checkout", (t) => {
  const root = temporaryRoot(t);
  const packDirectory = path.join(root, "pack");
  const prefix = path.join(root, "prefix");
  const workingDirectory = path.join(root, "elsewhere");
  const codexHome = path.join(root, "codex");
  const backupRoot = path.join(root, "backups");
  fs.mkdirSync(packDirectory);
  fs.mkdirSync(workingDirectory);
  fs.mkdirSync(codexHome);

  const packed = run("npm", ["pack", "--json", "--pack-destination", packDirectory]);
  assert.equal(packed.status, 0, diagnostic(packed));
  const tarball = path.join(packDirectory, JSON.parse(packed.stdout)[0].filename);
  const installed = run("npm", [
    "install",
    "--global",
    "--prefix",
    prefix,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball,
  ]);
  assert.equal(installed.status, 0, diagnostic(installed));
  const installedCli = path.join(prefix, "bin/slopsentral");

  const doctor = run(installedCli, ["doctor"], { cwd: workingDirectory });
  assert.equal(doctor.status, 0, diagnostic(doctor));
  assert.equal(jsonOutput(doctor).type, "SLOPSENTRAL_DOCTOR");

  const applied = run(installedCli, [
    "profile",
    "apply",
    "local-development-default",
    "--codex-home",
    codexHome,
    "--backup-root",
    backupRoot,
  ], { cwd: workingDirectory });
  assert.equal(applied.status, 0, diagnostic(applied));
  const applyOutput = jsonOutput(applied);
  assert.equal(applyOutput.type, "PROFILE_APPLIED");
  assert.equal(fs.existsSync(path.join(codexHome, "local-development-default.config.toml")), true);

  const rolledBack = run(installedCli, [
    "profile",
    "rollback",
    applyOutput.transaction.manifestPath,
    "--codex-home",
    codexHome,
    "--backup-root",
    backupRoot,
  ], { cwd: workingDirectory });
  assert.equal(rolledBack.status, 0, diagnostic(rolledBack));
  assert.equal(jsonOutput(rolledBack).type, "PROFILE_ROLLED_BACK");
  assert.equal(fs.existsSync(path.join(codexHome, "local-development-default.config.toml")), false);
});
