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
  "kast-kotlin-structural-analysis",
  "sqlite-readonly-navigation",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
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

test("Kotlin structural analysis uses the Kast 0.20.2 root surface", () => {
  const skillRoot = path.join(
    repoRoot,
    "source/skills/kast-kotlin-structural-analysis",
  );
  const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  const runbook = fs.readFileSync(
    path.join(skillRoot, "references/structural-query-runbook.md"),
    "utf8",
  );
  const contract = `${skill}\n${runbook}`;

  for (const command of [
    "kast up",
    "kast files",
    "kast symbol find",
    "kast symbol show",
    "kast symbol refs",
    "kast symbol callers",
    "kast symbol callees",
    "kast symbol implementations",
    "kast symbol supertypes",
    "kast symbol subtypes",
    "kast graph summary",
    "kast graph nodes",
    "kast graph neighbors",
    "kast graph topology",
    "kast graph communities",
    "kast graph impact",
    "kast graph summary --scope symbol",
    "kast graph topology --scope package",
    "kast graph communities --scope module",
    '--page "$NEXT_PAGE"',
  ]) {
    assert.ok(contract.includes(command), `missing command: ${command}`);
  }
  assert.match(skill, /Kast 0\.20\.2 or later/);
  assert.match(contract, /selectorHandle/);
  assert.match(contract, /stableKey/);
  assert.match(contract, /runtime: READY/);
  assert.match(contract, /referenceIndexReady: true/);
  assert.match(contract, /explicit authority/);
  assert.ok(contract.includes('kast symbol show "$EXACT_SYMBOL"'));
  assert.doesNotMatch(contract, /kast symbol show "\$SYMBOL"/);
  assert.doesNotMatch(contract, /\bkast agent\b|--output json|JSONL|jq\b/i);
  assert.equal(
    fs.existsSync(path.join(repoRoot, "source/skills/codex-session-structural-analysis")),
    false,
  );
});

test("SQLite navigation resolves receipt-owned Kast state and rejects unsafe access", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-readonly-"));
  const workspace = path.join(fixture, "workspace");
  const dataRoot = path.join(fixture, "kast-data");
  const workspaceState = path.join(dataRoot, "workspaces", "workspace-state");
  const database = path.join(workspaceState, "cache", "source-index.db");
  const release = path.join(fixture, "kast-install", "releases", "current-release");
  const releaseBinary = path.join(release, "bin", "kast");
  const publicBinary = path.join(fixture, "bin", "kast");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.dirname(database), { recursive: true });
  fs.mkdirSync(path.dirname(releaseBinary), { recursive: true });
  fs.mkdirSync(path.dirname(publicBinary), { recursive: true });
  fs.writeFileSync(
    path.join(workspaceState, "workspace.json"),
    JSON.stringify({ workspaceRoot: workspace }),
  );
  execFileSync("sqlite3", [database, "CREATE TABLE sample(value TEXT); INSERT INTO sample VALUES ('kept');"]);
  fs.writeFileSync(releaseBinary, "#!/usr/bin/env bash\nexit 99\n");
  fs.chmodSync(releaseBinary, 0o755);
  fs.symlinkSync(releaseBinary, publicBinary);
  fs.writeFileSync(
    path.join(release, "receipt.json"),
    JSON.stringify({ tool: "kast", roots: { data: dataRoot } }),
  );

  const sqliteScript = path.join(
    repoRoot,
    "source/skills/sqlite-readonly-navigation/scripts/sqlite_readonly",
  );
  const resolved = execFileSync(
    sqliteScript,
    ["--kast-workspace", workspace, "--print-path"],
    {
      env: { ...process.env, KAST_PUBLIC_BIN: publicBinary },
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

  const databaseLink = path.join(fixture, "source-index-link.db");
  fs.symlinkSync(database, databaseLink);
  assert.equal(
    execFileSync(sqliteScript, ["--database", databaseLink, "--print-path"], {
      encoding: "utf8",
    }).trim(),
    fs.realpathSync(database),
  );

  const writeAttempt = spawnSync(
    sqliteScript,
    ["--database", database, "--query", "PRAGMA query_only=OFF; DELETE FROM sample;"],
    { encoding: "utf8" },
  );
  assert.notEqual(writeAttempt.status, 0);
  const attached = path.join(fixture, "attached.db");
  assert.notEqual(
    spawnSync(
      sqliteScript,
      [
        "--database",
        database,
        "--query",
        `PRAGMA query_only=OFF; ATTACH '${attached}' AS attached; CREATE TABLE attached.created(value);`,
      ],
      { encoding: "utf8" },
    ).status,
    0,
  );
  assert.equal(fs.existsSync(attached), false);
  assert.notEqual(
    spawnSync(
      sqliteScript,
      ["--database", database, "--print-path", "--query", "SELECT 1;"],
      { encoding: "utf8" },
    ).status,
    0,
  );
  const oldSqlite = path.join(fixture, "sqlite3-old");
  fs.writeFileSync(oldSqlite, "#!/usr/bin/env bash\nprintf '3.40.0 2022-11-16\\n'\n");
  fs.chmodSync(oldSqlite, 0o755);
  assert.notEqual(
    spawnSync(sqliteScript, ["--database", database, "--query", "SELECT 1;"], {
      env: { ...process.env, SQLITE_BIN: oldSqlite },
      encoding: "utf8",
    }).status,
    0,
  );
  assert.equal(
    execFileSync("sqlite3", [database, "SELECT count(*) FROM sample;"], { encoding: "utf8" }).trim(),
    "1",
  );
});
