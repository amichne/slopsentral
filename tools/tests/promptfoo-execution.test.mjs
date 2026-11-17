import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { digest, gradeExecution, loadExecutionCases, loadFixtures } from "../promptfoo/execution.mts";
import { createExecutionConfig, retainEvidence } from "../promptfoo/execution-runtime.mts";

const cases = await loadExecutionCases();
const item = cases.find((item) => item.id === "software-engineering/zero-selected-tests-is-not-green");
assert.ok(item);
const trace = digest("independently retained event archive");
const finding = { status: "pass", evidence: ["events.jsonl"] };
const verified = () => ({
  caseId: item.id, traceSha256: trace,
  checks: item.scenario.successChecklist.map((requirement) => ({ requirement, ...finding })),
  route: finding, scope: finding,
});

test("execution catalog retains every authored requirement and safety setting", async () => {
  assert.equal(cases.length, 49);
  assert.equal(new Set(cases.map((item) => item.id)).size, 49);
  for (const item of cases) {
    const source = JSON.parse(await readFile(item.path, "utf8"));
    assert.deepEqual(item.scenario, source.scenarios.find((scenario) => scenario.id === item.scenario.id));
    assert.equal(item.sha256, digest(await readFile(item.path)));
    assert.equal(item.benchmark.runner.model, "gpt-6-astra");
    assert.equal(item.benchmark.runner.sandbox, "workspace-write");
    assert.equal(item.benchmark.runner.approvalPolicy, "never");
  }
});

test("missing fixtures cannot pass through the real promptfoo pipeline", async () => {
  process.env.PROMPTFOO_DISABLE_TELEMETRY = "1";
  process.env.PROMPTFOO_DISABLE_UPDATE = "1";
  process.env.PROMPTFOO_CONFIG_DIR = ".promptfoo";
  const { evaluate } = await import("promptfoo");
  const config = await createExecutionConfig(undefined);
  assert.equal(config.providers[0].handlesOwnRetries, true);
  const record = await evaluate({ ...config, providers: config.providers[0], writeLatestResults: false }, {
    cache: false, maxConcurrency: 1, showProgressBar: false,
  });
  const summary = await record.toEvaluateSummary();
  assert.equal(summary.results.length, cases.length);
  assert.equal(summary.stats.successes, 0);
  assert.equal(summary.stats.failures, cases.length);
  assert.equal(summary.stats.errors, 0);
  for (const row of summary.results) {
    assert.match(row.gradingResult.reason, /^BLOCKED_SETUP:/u);
    assert.equal(row.response.metadata.evidenceKind, "blocked-execution");
  }
});

test("Amp rejects inherited or shell-expanded fixture commands", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "amp-execution-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "fixtures.json");
  const fixture = {
    caseId: item.id, repository: "/disposable/repository", revision: "a".repeat(40), context: "",
    verifier: { file: "/independent/verifier.mjs", sha256: digest("verifier") },
  };
  await writeFile(path, JSON.stringify([fixture]));
  const { providers } = await createExecutionConfig(path, "amp");
  const result = await providers[0].callApi("", { vars: { caseId: item.id } });
  assert.match(result.output, /^BLOCKED_SETUP:/u);
  await assert.rejects(createExecutionConfig(path, "other"), /Unsupported execution host/u);
  for (const command of ["node ./checks.mjs *", "node ./checks.mjs heap; ls", "node ../checks.mjs heap"]) {
    await writeFile(path, JSON.stringify([{ ...fixture, ampCommands: [command] }]));
    await assert.rejects(createExecutionConfig(path, "amp"), /Execution fixtures/u);
  }
});

test("the Amp fixture tool runs admitted arguments in the fixture without inherited credentials", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "amp-fixture-tool-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await copyFile(new URL("../promptfoo/fixtures/amp-tool.mjs", import.meta.url), join(directory, "tool.mjs"));
  await writeFile(join(directory, "checks.mjs"), 'console.log(JSON.stringify([process.argv[2], process.env.SLOPSENTRAL_TEST_CREDENTIAL ?? null, process.cwd()]));');
  const command = "node ./checks.mjs heap";
  await writeFile(join(directory, "fixture.json"), JSON.stringify({
    node: process.execPath, workspace: directory, commands: [command],
  }));
  let tool;
  const { default: initialize } = await import(pathToFileURL(join(directory, "tool.mjs")));
  await initialize({ registerTool(definition) { tool = definition; } });
  process.env.SLOPSENTRAL_TEST_CREDENTIAL = "test value";
  t.after(() => { delete process.env.SLOPSENTRAL_TEST_CREDENTIAL; });
  const [argument, inherited, cwd] = JSON.parse(await tool.execute({ command }));
  assert.equal(argument, "heap");
  assert.equal(inherited, null);
  assert.equal(await realpath(cwd), await realpath(directory));
  await assert.rejects(tool.execute({ command: "node ./checks.mjs other" }), /does not admit/u);
});

test("evidence references require retained bytes and cannot escape the archive", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "execution-evidence-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = "actual retained trace";
  await writeFile(join(directory, "events.jsonl"), bytes);
  assert.deepEqual(await retainEvidence(directory, ["events.jsonl"]), { "events.jsonl": digest(bytes) });
  await symlink(import.meta.filename, join(directory, "outside"));
  for (const reference of ["missing", "../outside", import.meta.filename, "outside", "."]) {
    await assert.rejects(retainEvidence(directory, [reference]));
  }
});

test("only completed execution with every independent finding can pass", () => {
  assert.equal(gradeExecution(item, trace, true, verified()).pass, true);
  const rejected = [
    null, "The model says everything passed", {},
    { ...verified(), caseId: "another/case" },
    { ...verified(), traceSha256: digest("stale trace") },
    { ...verified(), checks: verified().checks.slice(1) },
    { ...verified(), checks: [...verified().checks, verified().checks[0]] },
    { ...verified(), checks: verified().checks.map((check, index) => index ? check : { ...check, requirement: "weaker claim" }) },
  ];
  for (const field of ["route", "scope"]) {
    for (const status of ["unassessed", "fail"]) rejected.push({ ...verified(), [field]: { ...finding, status } });
    rejected.push({ ...verified(), [field]: { ...finding, evidence: [] } });
  }
  for (const status of ["unassessed", "fail"]) {
    rejected.push({ ...verified(), checks: verified().checks.map((check, index) => index ? check : { ...check, status }) });
  }
  for (const input of rejected) assert.equal(gradeExecution(item, trace, true, input).pass, false, JSON.stringify(input));
  assert.equal(gradeExecution(item, trace, false, verified()).pass, false, "partial trace is not success");
});

test("fixture selection is explicit, pinned, unique and closed", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "execution-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "fixtures.json");
  assert.deepEqual(await loadFixtures(undefined, cases), []);
  const fixture = {
    caseId: item.id, repository: "/disposable/repository", revision: "a".repeat(40), context: "",
    verifier: { file: "/independent/verifier.mjs", sha256: digest("verifier") },
  };
  await writeFile(path, JSON.stringify([fixture]));
  assert.deepEqual(await loadFixtures(path, cases), [fixture]);
  for (const input of [
    [{ ...fixture, revision: "main" }], [{ ...fixture, repository: "relative" }],
    [{ ...fixture, caseId: "invented" }], [fixture, fixture], [{ ...fixture, extra: true }],
    [{ ...fixture, prepare: { ...fixture.verifier, sha256: "unversioned" } }],
  ]) {
    await writeFile(path, JSON.stringify(input));
    await assert.rejects(loadFixtures(path, cases));
  }
});
