import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const installer = path.join(repoRoot, "source/tools/install-skill");
const sourceSkill = path.join(repoRoot, "source/skills/pkl-engineering");

function run(codexHome, ...args) {
  return spawnSync(installer, ["pkl-engineering", "--codex-home", codexHome, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function diagnostic(result) {
  return result.stdout || result.stderr || result.error?.message || "installer failed without diagnostics";
}

function withCodexHome(t) {
  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "install-skill-test-"));
  t.after(() => fs.rmSync(codexHome, { recursive: true, force: true }));
  return codexHome;
}

test("installs a marketplace skill as a real directory", (t) => {
  const codexHome = withCodexHome(t);
  const result = run(codexHome);
  const installedSkill = path.join(codexHome, "skills/pkl-engineering");

  assert.equal(result.status, 0, diagnostic(result));
  assert.match(result.stdout, /status: installed/);
  assert.equal(fs.lstatSync(installedSkill).isSymbolicLink(), false);
  assert.equal(
    fs.readFileSync(path.join(installedSkill, "SKILL.md"), "utf8"),
    fs.readFileSync(path.join(sourceSkill, "SKILL.md"), "utf8"),
  );
  assert.ok(fs.existsSync(path.join(installedSkill, "scripts/pkl_agent")));
});

test("reports an identical installed skill as an idempotent no-op", (t) => {
  const codexHome = withCodexHome(t);
  assert.equal(run(codexHome).status, 0);

  const result = run(codexHome);

  assert.equal(result.status, 0, diagnostic(result));
  assert.match(result.stdout, /status: unchanged/);
});

test("refuses to overwrite a different installed skill without force", (t) => {
  const codexHome = withCodexHome(t);
  assert.equal(run(codexHome).status, 0);
  const installedSkillFile = path.join(codexHome, "skills/pkl-engineering/SKILL.md");
  fs.appendFileSync(installedSkillFile, "\nlocal change\n");

  const result = run(codexHome);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /error: destination already contains a different skill/);
  assert.match(result.stdout, /help: .*--force/);
  assert.match(fs.readFileSync(installedSkillFile, "utf8"), /local change/);
});

test("force explicitly replaces a different installed skill", (t) => {
  const codexHome = withCodexHome(t);
  assert.equal(run(codexHome).status, 0);
  const installedSkillFile = path.join(codexHome, "skills/pkl-engineering/SKILL.md");
  fs.appendFileSync(installedSkillFile, "\nlocal change\n");

  const result = run(codexHome, "--force");

  assert.equal(result.status, 0, diagnostic(result));
  assert.match(result.stdout, /status: replaced/);
  assert.equal(
    fs.readFileSync(installedSkillFile, "utf8"),
    fs.readFileSync(path.join(sourceSkill, "SKILL.md"), "utf8"),
  );
});

test("rejects a skill that is not listed in the marketplace", (t) => {
  const codexHome = withCodexHome(t);
  const result = spawnSync(
    installer,
    ["not-a-marketplace-skill", "--codex-home", codexHome],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 2);
  assert.match(result.stdout, /error: skill is not listed in the marketplace/);
});

test("rejects unknown options without prompting", (t) => {
  const codexHome = withCodexHome(t);
  const result = run(codexHome, "--surprise");

  assert.equal(result.status, 2);
  assert.match(result.stdout, /error: unknown option --surprise/);
  assert.match(result.stdout, /help: .*--codex-home.*--force/);
});
