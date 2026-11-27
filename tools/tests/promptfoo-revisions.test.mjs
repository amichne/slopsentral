import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test from "node:test";
import { revisionCases } from "../../source/evals/promptfoo/revisions.mts";
import { claudeArgs, codexArgs, resolveExecutable } from "../promptfoo/cli-providers.mts";
import { gradeRevision, sentences } from "../promptfoo/grade-revision.mts";
import { MODELS, SKILL_FILES, buildRevisionTests, createRevisionConfig } from "../promptfoo/revision-suite.mts";

test("each revision oracle accepts its authored revision and rejects every nearest error", () => {
  assert.ok(revisionCases.length >= 8);
  assert.equal(new Set(revisionCases.map((item) => item.id)).size, revisionCases.length);
  for (const item of revisionCases) {
    const accepted = gradeRevision(item, item.controls.accepted);
    assert.equal(accepted.pass, true, `${item.id}: ${accepted.reason}`);
    assert.ok(Object.keys(item.controls.rejected).length >= 2, item.id);
    for (const [label, text] of Object.entries(item.controls.rejected)) {
      assert.equal(gradeRevision(item, text).pass, false, `${item.id}: ${label}`);
    }
    assert.equal(gradeRevision(item, item.passage).pass, false, `${item.id}: unrevised passage`);
    assert.equal(gradeRevision(item, "").pass, false, `${item.id}: empty`);
  }
});

test("grader names each failed check and accepts spelled-out numbers", () => {
  const item = revisionCases.find((candidate) => candidate.id === "revise-pr-description");
  const spelled = gradeRevision(item, "This PR adds jitter to the backoff. The breaker opens after five consecutive failures.");
  assert.equal(spelled.pass, true, spelled.reason);
  const invented = gradeRevision(item, "I added jitter to the backoff, cutting errors by 40%. The breaker opens after 5 failures.");
  assert.equal(invented.namedScores.noNewNumbers, 0);
  assert.equal(invented.namedScores.noAddedFirstPerson, 0);
  assert.equal(invented.namedScores.keptFacts, 1);
  assert.match(invented.reason, /new number: 40/u);
  const runbook = revisionCases.find((candidate) => candidate.id === "revise-runbook-step");
  const listed = "1. Drain the node before upgrading.\n2. Run `kubectl drain node-7 --ignore-daemonsets`.\n3. Wait until the pods are rescheduled.";
  assert.equal(gradeRevision(runbook, listed).pass, true, "list markers are not new numbers");
});

test("a claim passes only when omitted or marked in its own sentence", () => {
  const item = revisionCases.find((candidate) => candidate.id === "revise-design-note");
  const marked = "In WAL mode, readers do not block the writer. Support for concurrent writers is unverified.";
  const separated = "In WAL mode, readers do not block the writer. SQLite supports concurrent writers. [source needed: other details]";
  assert.equal(gradeRevision(item, marked).pass, true);
  const perfect = "In WAL mode, readers do not block the writer. Whether WAL mode supports concurrent writers has not been confirmed.";
  assert.equal(gradeRevision(item, perfect).pass, true, "present-perfect gap marker");
  const declined = "In WAL mode, readers do not block the writer. This does not imply support for concurrent writers.";
  assert.equal(gradeRevision(item, declined).pass, true, "declined inference");
  assert.equal(gradeRevision(item, separated).namedScores.claimsOmittedOrMarked, 0);
  assert.deepEqual(sentences("One. [source needed: x]\nTwo."), ["One.", "[source needed: x]", "Two."]);
});

test("live configuration supplies the skill only to its arm, keeps the oracle hidden, and records identities", () => {
  const tests = buildRevisionTests();
  assert.equal(tests.length, revisionCases.length);
  const skill = SKILL_FILES.map((path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
  for (const [index, item] of revisionCases.entries()) {
    const { vars, metadata } = tests[index];
    assert.deepEqual(Object.keys(vars), ["skillTask", "controlTask"]);
    const controls = [item.controls.accepted, ...Object.values(item.controls.rejected)]
      .filter((text) => !item.passage.includes(text));
    for (const task of Object.values(vars)) {
      assert.ok(task.includes(item.passage));
      for (const text of controls) assert.equal(task.includes(text), false, `${item.id}: control text leaked`);
    }
    for (const text of skill) {
      assert.ok(vars.skillTask.includes(text));
      assert.equal(vars.controlTask.includes(text), false);
    }
    for (const field of ["suiteSha256", "graderSha256", "skillTaskSha256", "controlTaskSha256"]) {
      assert.match(metadata[field], /^sha256:[a-f0-9]{64}$/u);
    }
  }
  const config = createRevisionConfig({ codexHome: "/isolated/codex", workspace: "/isolated/workspace" },
    { codex: "/bin/codex", claude: "/bin/claude" });
  assert.equal(config.sharing, false);
  assert.deepEqual(config.providers.map((provider) => provider.id()), MODELS.map(({ host, model, effort }) => `${host}-cli:${model}:${effort}`));
  assert.deepEqual(config.prompts.map((prompt) => prompt.label), ["Loaded skill", "Without skill control"]);
});

test("provider arguments exclude personal configuration, tools, and MCP servers", () => {
  const codex = codexArgs("gpt-6.1-sol", "low", "/tmp/out.txt");
  for (const flag of ["--ignore-user-config", "--ignore-rules", "--ephemeral", "read-only", "features.shell_tool=false",
    "features.plugins=false", "project_doc_max_bytes=0", "web_search=disabled", "model_reasoning_effort=low"]) {
    assert.ok(codex.includes(flag), flag);
  }
  const claude = claudeArgs("claude-sonnet-5-5", "low");
  assert.deepEqual(claude.slice(claude.indexOf("--tools"), claude.indexOf("--tools") + 2), ["--tools", ""]);
  assert.deepEqual(claude.slice(claude.indexOf("--setting-sources"), claude.indexOf("--setting-sources") + 2), ["--setting-sources", ""]);
  for (const flag of ["--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence"]) assert.ok(claude.includes(flag), flag);
});

test("executable resolution skips the npm-local binary directory", () => {
  const base = mkdtempSync(join(tmpdir(), "revision-path-"));
  try {
    const local = join(base, "repo", "node_modules", ".bin");
    const installed = join(base, "bin");
    for (const directory of [local, installed]) {
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "codex"), "#!/bin/sh\n");
      chmodSync(join(directory, "codex"), 0o755);
    }
    assert.equal(resolveExecutable("codex", [local, installed].join(delimiter)), join(installed, "codex"));
    assert.equal(resolveExecutable("codex", local), undefined);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
