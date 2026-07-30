import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const skillNames = [
  "kast-installation-diagnosis",
  "kast-performance-assessment",
  "codex-session-structural-analysis",
  "sqlite-readonly-navigation",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function writeJsonLines(file, records) {
  fs.writeFileSync(file, `${records.map(JSON.stringify).join("\n")}\n`);
}

test("kast-operations exposes four standalone operator skills", () => {
  const plugin = readJson("source/plugins/kast-operations/plugin.json");
  assert.deepEqual(plugin.skills.map(({ name }) => name), skillNames);

  const marketplace = readJson("source/adaptable.marketplace.json");
  assert.deepEqual(
    marketplace.skills
      .filter(({ name }) => skillNames.includes(name))
      .map(({ name }) => name),
    skillNames,
  );
  assert.equal(
    marketplace.plugins.find(({ name }) => name === "kast-operations")?.plugin.version,
    plugin.version,
  );

  for (const name of skillNames) {
    assert.ok(fs.existsSync(path.join(repoRoot, "source", "skills", name, "SKILL.md")));
  }
});

test("session analysis walks descendants, joins tool outputs, and profiles matching calls", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "codex-session-tree-"));
  const rootId = "00000000-0000-0000-0000-000000000001";
  const childId = "00000000-0000-0000-0000-000000000002";
  const root = path.join(fixture, `rollout-root-${rootId}.jsonl`);
  const child = path.join(fixture, `rollout-child-${childId}.jsonl`);

  writeJsonLines(root, [
    {
      timestamp: "2026-01-01T00:00:00Z",
      type: "event_msg",
      payload: { type: "sub_agent_activity", agent_thread_id: childId },
    },
    {
      timestamp: "2026-01-01T00:00:01Z",
      type: "response_item",
      payload: {
        type: "custom_tool_call",
        call_id: "call-root",
        name: "exec",
        input: "root command",
      },
    },
    {
      timestamp: "2026-01-01T00:00:02Z",
      type: "response_item",
      payload: {
        type: "custom_tool_call_output",
        call_id: "call-root",
        output: "Wall time 1.0 seconds",
      },
    },
  ]);
  writeJsonLines(child, [
    {
      timestamp: "2026-01-01T00:00:03Z",
      type: "response_item",
      payload: {
        type: "function_call",
        call_id: "call-child",
        name: "exec",
        arguments: '{"cmd":"child command"}',
      },
    },
    {
      timestamp: "2026-01-01T00:00:04Z",
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "call-child",
        output: "Wall time: 2.5 seconds",
      },
    },
  ]);

  const sessionScript = path.join(
    repoRoot,
    "source/skills/codex-session-structural-analysis/scripts/codex_session_tree",
  );
  const calls = execFileSync(
    sessionScript,
    ["calls", "--root", root, "--sessions-dir", fixture],
    { encoding: "utf8" },
  );
  const callRecords = calls.trim().split("\n").map(JSON.parse);
  assert.deepEqual(callRecords.map(({ callId }) => callId), ["call-root", "call-child"]);
  assert.equal(callRecords[1].depth, 1);
  assert.equal(callRecords[1].output, "Wall time: 2.5 seconds");

  const profileFilter = path.join(
    repoRoot,
    "source/skills/codex-session-structural-analysis/scripts/tool_call_profile.jq",
  );
  const profile = JSON.parse(
    execFileSync("jq", ["-s", "--arg", "pattern", "child", "-f", profileFilter], {
      input: calls,
      encoding: "utf8",
    }),
  );
  assert.deepEqual(profile, [
    {
      name: "exec",
      samples: 1,
      meanSeconds: 2.5,
      p50Seconds: 2.5,
      p95Seconds: 2.5,
      maxSeconds: 2.5,
    },
  ]);

  const missingId = "00000000-0000-0000-0000-000000000003";
  const missingRoot = path.join(fixture, "missing-root.jsonl");
  writeJsonLines(missingRoot, [
    {
      type: "event_msg",
      payload: { type: "sub_agent_activity", agent_thread_id: missingId },
    },
  ]);
  assert.notEqual(
    spawnSync(
      sessionScript,
      ["files", "--root", missingRoot, "--sessions-dir", fixture],
      { encoding: "utf8" },
    ).status,
    0,
  );
  const partial = spawnSync(
    sessionScript,
    ["files", "--root", missingRoot, "--sessions-dir", fixture, "--allow-missing"],
    { encoding: "utf8" },
  );
  assert.equal(partial.status, 0);
  assert.match(partial.stderr, new RegExp(`missing child ${missingId}`));
});

test("SQLite navigation resolves Kast workspace state and rejects writes", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-readonly-"));
  const workspace = path.join(fixture, "workspace");
  const workspaceState = path.join(fixture, "workspace-state");
  const database = path.join(workspaceState, "cache", "source-index.db");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.dirname(database), { recursive: true });
  fs.writeFileSync(
    path.join(workspaceState, "workspace.json"),
    JSON.stringify({ workspaceRoot: workspace }),
  );
  execFileSync("sqlite3", [database, "CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('kept');"]);

  const control = path.join(fixture, "kastctl");
  fs.writeFileSync(
    control,
    `#!/usr/bin/env bash\nprintf '{"agentEnvironment":{"backend":{"state":"managed","sourcePath":"%s/workspace.json"},"ok":true}}\\n' "${workspaceState}"\n`,
  );
  fs.chmodSync(control, 0o755);

  const sqliteScript = path.join(
    repoRoot,
    "source/skills/sqlite-readonly-navigation/scripts/sqlite_readonly",
  );
  const resolved = execFileSync(
    sqliteScript,
    ["--kast-workspace", workspace, "--print-path"],
    {
      env: { ...process.env, KAST_CONTROL_BIN: control },
      encoding: "utf8",
    },
  ).trim();
  assert.equal(resolved, fs.realpathSync(database));

  const rows = JSON.parse(
    execFileSync(
      sqliteScript,
      ["--database", database, "--json", "--query", "SELECT value FROM sample ORDER BY value;"],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(rows, [{ value: "kept" }]);

  const writeAttempt = spawnSync(
    sqliteScript,
    ["--database", database, "--query", "DELETE FROM sample;"],
    { encoding: "utf8" },
  );
  assert.notEqual(writeAttempt.status, 0);
  assert.notEqual(
    spawnSync(
      sqliteScript,
      ["--database", database, "--print-path", "--query", "SELECT 1;"],
      { encoding: "utf8" },
    ).status,
    0,
  );
  assert.equal(
    execFileSync("sqlite3", [database, "SELECT count(*) FROM sample;"], { encoding: "utf8" }).trim(),
    "1",
  );
});
