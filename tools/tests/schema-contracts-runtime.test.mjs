import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("schema-contracts runs from the repository package boundary", () => {
  const result = spawnSync(process.execPath, [
    "source/skills/manage-json-schemas/scripts/schema-contracts.js",
    "policy",
    "--schema",
    "source/schemas/catalog/catalog.schema.json",
  ], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Policy OK: source\/schemas\/catalog\/catalog\.schema\.json/u);
});
