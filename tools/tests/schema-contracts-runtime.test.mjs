import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

test("fixed records need no discriminator while discriminated objects require type", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "schema-contracts-"));
  try {
    const schemaPath = path.join(directory, "record.schema.json");
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "record.schema.json",
      title: "RECORD",
      type: "object",
      properties: { name: { type: "string", examples: ["orders"] } },
      required: ["name"],
      additionalProperties: false,
      examples: [{ name: "orders" }],
    };
    const check = (command) => spawnSync(process.execPath, [
      "source/skills/manage-json-schemas/scripts/schema-contracts.js",
      command, "--schema", schemaPath,
    ], { cwd: repoRoot, encoding: "utf8" });
    writeFileSync(schemaPath, JSON.stringify(schema));
    assert.equal(check("profile").status, 0, "A fixed record must pass the schema profile");
    assert.equal(check("policy").status, 0, "A fixed record must pass the schema policy");

    schema.properties.type = { type: "string", enum: ["RECORD"], examples: ["RECORD"] };
    schema.examples = [{ type: "RECORD", name: "orders" }];
    writeFileSync(schemaPath, JSON.stringify(schema));
    for (const command of ["profile", "policy"]) {
      const rejected = check(command);
      assert.notEqual(rejected.status, 0, "A supplied discriminator must be required");
      assert.match(rejected.stderr + rejected.stdout, /required.*type/u);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
