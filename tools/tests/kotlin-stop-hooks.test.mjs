import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projected = process.env.KOTLIN_PLUGIN_ROOT;
const source = projected || path.resolve("source");
const adapter = path.join(source, "hooks/codex-stop.py");
function hookCommand(name) {
  const config = JSON.parse(fs.readFileSync(path.join(source, projected ? "hooks" : "hooks/codex", `${name}.hooks.json`)));
  const command = config.hooks.Stop[0].hooks[0].command;
  return projected ? command : command.replace(/\bhooks\/[A-Za-z0-9_.-]+/g, (value) => `"${source}/${value}"`);
}
function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kotlin-stop-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function run(command, root, input = { stop_hook_active: false }) {
  return spawnSync("bash", ["-c", command], {
    cwd: root,
    env: { ...process.env, PLUGIN_ROOT: source, INTELLIGENCE_CHANGED_FILES: "", INTELLIGENCE_GRADLE_CHECK: "" },
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
  });
}

for (const name of ["gradle-check-green", "gradle-wrapper-integrity", "kotlin-horizontalization-check"]) {
  test(`${name} configured Stop command emits valid JSON on skipped checks`, (context) => {
    const result = run(hookCommand(name), fixture(context));
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(Object.hasOwn(output, "decision"), false);
    assert.match(output.systemMessage, /completed/);
  });
}

test("Stop failure gives bounded feedback without forwarding source or secrets", (context) => {
  const root = fixture(context);
  const checker = path.join(root, "check.sh");
  fs.writeFileSync(checker, "echo sensitive-source-payload; exit 1\n");
  const result = run(`python3 "${adapter}" -- bash "${checker}"`, root);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, "block");
  assert.match(output.reason, /check-failed/);
  assert.doesNotMatch(result.stdout + result.stderr, /sensitive-source-payload/);
});

test("Stop adapter does not rerun checks on its continuation", (context) => {
  const root = fixture(context);
  const checker = path.join(root, "check.sh");
  fs.writeFileSync(checker, "touch invoked; exit 1\n");
  const result = run(`python3 "${adapter}" -- bash "${checker}"`, root, { stop_hook_active: true });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(Object.hasOwn(output, "decision"), false);
  assert.match(output.systemMessage, /unresolved/);
  assert.equal(fs.existsSync(path.join(root, "invoked")), false);
});

test("layout Stop adapter preserves advisory counts without blocking", (context) => {
  const root = fixture(context);
  spawnSync("git", ["init", "-q", root]);
  const directory = path.join(root, "src/main/kotlin/example");
  fs.mkdirSync(directory, { recursive: true });
  for (let i = 0; i < 8; i++) fs.writeFileSync(path.join(directory, `Order${i}.kt`), `class Order${i}\n`);
  const result = run(hookCommand("kotlin-horizontalization-check"), root);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(Object.hasOwn(output, "decision"), false);
  assert.match(output.systemMessage, /advisory-findings=[1-9]/);
  assert.doesNotMatch(result.stdout, /Order0/);
});

test("Stop adapter reports a missing executable as launch failure", (context) => {
  const result = run(`python3 "${adapter}" -- /absent/kotlin-audit-check`, fixture(context));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).decision, "block");
  assert.match(result.stdout, /launch-failed/);
});

for (const input of ["not-json", "[]", '{"stop_hook_active":"false"}', "{}"]) {
  test(`Stop adapter rejects malformed input ${input}`, (context) => {
    const result = run(`python3 "${adapter}" -- bash -c 'exit 0'`, fixture(context), input);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).decision, "block");
    assert.match(result.stdout, /invalid-input/);
  });
}

for (const output of ["not-json", '{"ok":true,"status":"advisory","findingCount":-1}', '{"ok":true,"status":"advisory","findingCount":true}']) {
  test(`Stop adapter rejects invalid advisory evidence ${output}`, (context) => {
    const root = fixture(context);
    const checker = path.join(root, "check.sh");
    fs.writeFileSync(checker, `printf '%s' '${output}'\n`);
    const result = run(`python3 "${adapter}" --advisory -- bash "${checker}"`, root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).decision, "block");
    assert.match(result.stdout, /invalid-output/);
  });
}
