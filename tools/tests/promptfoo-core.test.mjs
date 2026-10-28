import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { cases } from "../../source/evals/promptfoo/cases.mts";
import { gradeDecision } from "../promptfoo/grade.mts";
import { buildTests, createConfig, renderTask } from "../promptfoo/suite.mts";
import { prepareRuntime } from "../promptfoo/runtime.mts";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const explanation = "The chosen action preserves the stated invariant and its evidence limit.";

test("each authored oracle accepts its legal answer and rejects every nearest wrong choice", () => {
  assert.ok(cases.length >= 12);
  assert.equal(new Set(cases.map((item) => item.skill)).size, 12);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  for (const item of cases) {
    assert.ok(item.expected.length > 0, item.id);
    assert.equal(new Set(item.expected).size, item.expected.length, item.id);
    assert.ok(item.expected.every((choice) => Object.hasOwn(item.choices, choice)), item.id);
    assert.ok(Object.keys(item.choices).length > item.expected.length, item.id);
    const answer = { selected: item.expected, reason: explanation };
    assert.equal(gradeDecision(item, JSON.stringify(answer)).pass, true, item.id);
    for (const choice of Object.keys(item.choices)) {
      const changed = item.expected.includes(choice)
        ? item.expected.filter((selected) => selected !== choice)
        : [...item.expected, choice];
      assert.equal(
        gradeDecision(item, JSON.stringify({ ...answer, selected: changed })).pass,
        false,
        `${item.id}: toggled ${choice}`,
      );
    }
  }
});

test("live configuration renders source skills, hides the oracle, and carries content identities", () => {
  const tests = buildTests();
  const coreConfig = createConfig({ codexHome: "/isolated/codex", workspace: "/isolated/workspace" });
  assert.equal(tests.length, cases.length);
  assert.equal(coreConfig.sharing, false);
  assert.equal(coreConfig.providers[0].config.sandbox_mode, "read-only");
  for (const [index, item] of cases.entries()) {
    const row = tests[index];
    assert.ok(row.vars.task.includes(`name: ${item.skill}`) || row.vars.task.includes(`name: "${item.skill}"`));
    assert.ok(row.vars.task.includes(item.scenario));
    assert.equal(row.vars.task.includes(item.rationale), false);
    assert.equal(row.vars.controlTask.includes("name: " + item.skill), false);
    assert.equal(row.vars.controlTask.includes(item.rationale), false);
    assert.ok(row.vars.controlTask.includes(item.scenario));
    assert.deepEqual(Object.keys(row.vars), ["task", "controlTask"]);
    for (const field of ["skillSha256", "suiteSha256", "graderSha256", "taskSha256", "controlTaskSha256"]) {
      assert.match(row.metadata[field], /^sha256:[a-f0-9]{64}$/u);
    }
    assert.deepEqual(row.metadata.referenceSources, (item.references ?? []).map((reference) => {
      const path = `source/skills/${item.skill}/${reference}`;
      const text = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
      assert.ok(row.vars.task.includes(text), `${item.id}: supplied reference`);
      assert.equal(row.vars.controlTask.includes(text), false, `${item.id}: reference-free control`);
      return { path, sha256: `sha256:${createHash("sha256").update(text).digest("hex")}` };
    }));
    assert.equal(renderTask(item, "candidate skill").includes("candidate skill"), true);
  }
});

test("runtime reuses only the login and removes its temporary files", () => {
  const source = mkdtempSync(join(tmpdir(), "promptfoo-auth-control-"));
  const authPath = join(source, "auth.json");
  writeFileSync(authPath, "synthetic auth fixture");
  writeFileSync(join(source, "config.toml"), "personal config must not enter the eval");
  const runtime = prepareRuntime(authPath);
  try {
    assert.deepEqual(readdirSync(runtime.codexHome), ["auth.json"]);
    assert.ok(lstatSync(join(runtime.codexHome, "auth.json")).isSymbolicLink());
    assert.deepEqual(readdirSync(runtime.workspace), []);
    assert.equal(readFileSync(join(runtime.codexHome, "auth.json"), "utf8"), "synthetic auth fixture");
    runtime.dispose();
    assert.equal(existsSync(runtime.codexHome), false);
    assert.equal(readFileSync(authPath, "utf8"), "synthetic auth fixture");
  } finally {
    runtime.dispose();
    rmSync(source, { recursive: true, force: true });
  }
});

test("decision requests use textual JSON and preserve independent strict grading", () => {
  const config = createConfig({ codexHome: "/isolated/codex", workspace: "/isolated/workspace" });
  const provider = config.providers[0];
  assert.equal(provider.id, "openai:codex-sdk");
  assert.equal(provider.config.model, "gpt-6-sol");
  assert.equal(provider.config.model_reasoning_effort, "low");
  assert.equal(Object.hasOwn(provider.config, "output_schema"), false);
  const row = config.tests[0];
  assert.ok(row.vars.task.includes('Return only JSON with exactly two fields:'));
  assert.ok(row.vars.controlTask.includes('Return only JSON with exactly two fields:'));
  const grade = row.assert[0].value;
  const answer = { selected: cases[0].expected, reason: explanation };
  assert.equal(grade(JSON.stringify(answer)).pass, true);
  assert.equal(grade(JSON.stringify({ ...answer, extra: true })).pass, false);
  assert.equal(grade(JSON.stringify({ ...answer, selected: [17] })).pass, false);
  assert.equal(grade(JSON.stringify({ ...answer, selected: ["UNKNOWN"] })).pass, false);
});

test("API-key runtime needs no login file", () => {
  const runtime = prepareRuntime(join(tmpdir(), "absent-promptfoo-auth", "auth.json"));
  try {
    assert.deepEqual(readdirSync(runtime.codexHome), []);
  } finally {
    runtime.dispose();
  }
});

test("malformed, invented, duplicate, and extra output cannot pass", () => {
  const item = cases[0];
  for (const output of [
    "not JSON", null, [], 17, "null", "{}",
    JSON.stringify({ selected: item.expected, reason: "" }),
    JSON.stringify({ selected: item.expected }),
    JSON.stringify({ reason: explanation }),
    JSON.stringify({ selected: item.expected.join(","), reason: explanation }),
    JSON.stringify({ selected: [17], reason: explanation }),
    JSON.stringify({ selected: item.expected, reason: 123 }),
    JSON.stringify({ selected: [...item.expected, item.expected[0]], reason: explanation }),
    JSON.stringify({ selected: ["UNKNOWN"], reason: explanation }),
    JSON.stringify({ selected: item.expected, reason: explanation, extra: true }),
  ]) {
    assert.equal(gradeDecision(item, output).pass, false, JSON.stringify(output));
  }
});
