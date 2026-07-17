import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function plugin(name) {
  return readJson(`source/plugins/${name}/plugin.json`);
}

function instructionByName(manifest, name) {
  return manifest.instructions.find((instruction) => instruction.name === name);
}

test("semantic design is baseline-owned and reused by every plugin", () => {
  const expected = {
    "type-safety": "concepts/type-safety/core.md",
    "schema-driven-design": "concepts/schema-driven-design/core.md",
  };

  for (const [name, expectedPath] of Object.entries(expected)) {
    const instruction = instructionByName(plugin("engineering-baseline"), name);
    assert.equal(instruction?.path, expectedPath, `engineering-baseline must own ${name}`);
  }

  const pluginNames = fs
    .readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const pluginName of pluginNames) {
    for (const [name, expectedPath] of Object.entries(expected)) {
      const instruction = instructionByName(plugin(pluginName), name);
      assert.equal(
        instruction?.path,
        expectedPath,
        `${pluginName} must reuse the baseline-owned ${name} authority`,
      );
    }
  }
});
