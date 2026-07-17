import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function plugin(name) {
  return readJson(`source/plugins/${name}/plugin.json`);
}

function primitiveByName(primitives, name) {
  return primitives.find((primitive) => primitive.name === name);
}

test("shared semantic instructions stay compact and source-owned", () => {
  const expected = {
    "type-safety": "concepts/type-safety/core.md",
    "schema-driven-design": "concepts/schema-driven-design/core.md",
  };
  const pluginNames = fs
    .readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const pluginName of pluginNames) {
    for (const [name, expectedPath] of Object.entries(expected)) {
      const instruction = primitiveByName(plugin(pluginName).instructions, name);
      assert.equal(instruction?.path, expectedPath, `${pluginName} must reuse ${name}`);
    }
  }

  const typeSafetyWords = read("source/concepts/type-safety/core.md").split(/\s+/u).length;
  assert.ok(typeSafetyWords <= 1000, `type-safety must stay compact; found ${typeSafetyWords} words`);
});

test("semantic ratchet detail is selectively routed through addressable references", () => {
  const baselineSkill = primitiveByName(plugin("engineering-baseline").skills, "semantic-ratchet");
  assert.equal(baselineSkill?.path, "skills/semantic-ratchet");

  const marketplace = readJson("source/adaptable.marketplace.json");
  const marketplaceSkill = primitiveByName(marketplace.skills, "semantic-ratchet");
  assert.equal(marketplaceSkill?.path, "skills/semantic-ratchet");

  const skill = read("source/skills/semantic-ratchet/SKILL.md");
  const references = [
    "domain-values.md",
    "closed-outcomes.md",
    "state-and-capability-modeling.md",
    "module-boundaries.md",
    "audit-checklist.md",
    "refactor-playbook.md",
  ];

  for (const reference of references) {
    assert.match(skill, new RegExp(`references/${reference.replaceAll(".", "\\.")}`));
    assert.ok(
      fs.existsSync(path.join(repoRoot, "source/skills/semantic-ratchet/references", reference)),
      `${reference} must exist`,
    );
  }

  const consumers = fs
    .readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => primitiveByName(plugin(name).skills, "semantic-ratchet"));
  assert.deepEqual(consumers, ["engineering-baseline"]);
});
