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

test("semantic instructions have one install owner and a bounded baseline", () => {
  const owners = new Map();
  for (const entry of fs.readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const instruction of plugin(entry.name).instructions) {
      owners.set(instruction.name, [...(owners.get(instruction.name) ?? []), entry.name]);
    }
  }
  assert.deepEqual(owners.get("type-safety"), ["engineering-baseline"]);
  assert.deepEqual(owners.get("schema-driven-design"), ["api-contracts"]);
  assert.deepEqual(owners.get("agent-execution"), ["engineering-baseline"]);
  assert.ok([...owners.values()].every(values => values.length === 1));
  const baselineWords = plugin("engineering-baseline").instructions.reduce((count, ref) =>
    count + read(`source/${ref.path}`).trim().split(/\s+/u).length, 0);
  assert.ok(baselineWords <= 1250, `baseline instructions grew to ${baselineWords} words`);
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

test("Kotlin semantic routing uses the public Kast command surface", () => {
  const correctness = read("source/skills/kotlin-agentic-correctness/SKILL.md");
  const routing = read("source/evals/routing/kotlin-engineering-workflows.json");

  assert.match(correctness, /kast-kotlin-structural-analysis/);
  assert.doesNotMatch(correctness, /kast_rpc_file|kast-file-first/);
  assert.doesNotMatch(routing, /kast-file-first|file-backed semantic evidence/);
  assert.equal(
    fs.existsSync(path.join(repoRoot, "source/skills/kotlin-agentic-correctness/scripts/kast_rpc_file.sh")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(repoRoot, "source/skills/kotlin-agentic-correctness/references/kast-file-first.md")),
    false,
  );
});
