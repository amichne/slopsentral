import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const parser = path.resolve(process.env.KOTLIN_PLUGIN_ROOT || "source", "skills/kotlin-gradle-validation/scripts/parse/junit_results");

function parse(context, reports) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "junit-parser-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "build/test-results/test");
  fs.mkdirSync(directory, { recursive: true });
  reports.forEach((xml, index) => fs.writeFileSync(path.join(directory, `TEST-${index}.xml`), xml));
  const result = spawnSync("python3", [parser, root], { encoding: "utf8" });
  return { status: result.status, output: JSON.parse(result.stdout) };
}

const passed = '<testsuite name="Example" tests="1"><testcase name="passes"/></testsuite>';

test("JUnit preserves assertion and error details alongside pass and skip counts", (context) => {
  const { status, output } = parse(context, [
    '<testsuite name="Example" tests="4" failures="1" errors="1" skipped="1">' +
    '<testcase classname="Example" name="assertion"><failure message="expected true" type="AssertionError">trace</failure></testcase>' +
    '<testcase classname="Example" name="error"><error message="broken" type="RuntimeError">error trace</error></testcase>' +
    '<testcase name="passes"/><testcase name="skipped"><skipped/></testcase></testsuite>',
  ]);
  assert.equal(status, 0);
  assert.equal(output.status, "parsed");
  assert.equal(output.failed, 2);
  assert.equal(output.passed, 1);
  assert.equal(output.skipped, 1);
  assert.deepEqual(output.failures.map(({ method, message }) => ({ method, message })), [
    { method: "assertion", message: "expected true" }, { method: "error", message: "broken" },
  ]);
});

for (const [kind, xml] of [
  ["malformed-xml", "<testsuite><testcase"],
  ["unsupported-root", "<other/>"],
  ["invalid-data", '<testsuite tests="invalid"/>'],
  ["invalid-data", '<testsuite tests="1" time="NaN"/>'],
  ["invalid-data", '<testsuite tests="1" failures="2"/>'],
]) {
  test(`JUnit rejects ${kind} without erasing valid reports`, (context) => {
    const { status, output } = parse(context, [passed, xml]);
    assert.equal(status, 1);
    assert.equal(output.ok, false);
    assert.equal(output.status, "incomplete");
    assert.equal(output.errors[0].kind, kind);
    assert.equal(output.partial.total, 1);
    assert.equal(Object.hasOwn(output, "total"), false);
  });
}

test("JUnit distinguishes missing evidence from a parsed zero-test suite", (context) => {
  const missing = parse(context, []);
  assert.equal(missing.status, 1);
  assert.equal(missing.output.status, "unavailable");
  assert.equal(missing.output.errors[0].kind, "missing-reports");
  const empty = parse(context, ['<testsuite tests="0"/>']);
  assert.equal(empty.status, 0);
  assert.equal(empty.output.status, "parsed");
  assert.equal(empty.output.total, 0);
});
