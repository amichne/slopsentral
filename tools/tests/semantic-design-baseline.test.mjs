import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");

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

function withoutFencedCode(markdown) {
  return markdown.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gmu, "");
}

test("semantic concepts stay source-owned while plugins load concise instructions once", () => {
  const retiredContextHooks = [
    "type-safety-context",
    "schema-driven-design-context",
    "kotlin-code-correctness-context",
    "kotlin-repository-engineering-context",
  ];
  const pluginNames = fs
    .readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const pluginName of pluginNames) {
    const manifest = plugin(pluginName);
    const conceptInstructions = manifest.instructions.filter(({ path: primitivePath }) =>
      primitivePath.startsWith("concepts/"),
    );
    assert.deepEqual(
      conceptInstructions,
      [],
      `${pluginName} must not compose concepts as passive instructions`,
    );
  }

  for (const hookName of retiredContextHooks) {
    assert.equal(fs.existsSync(path.join(repoRoot, `source/hooks/${hookName}.hook.json`)), false);
    assert.equal(fs.existsSync(path.join(repoRoot, `source/hooks/codex/${hookName}.hooks.json`)), false);
  }

  assert.deepEqual(plugin("engineering-baseline").instructions.map(({ name }) => name), [
    "agent-execution",
    "engineering-design",
  ]);
  assert.deepEqual(plugin("kotlin-engineering").instructions.map(({ name }) => name), ["kotlin-engineering"]);
  assert.deepEqual(plugin("api-contracts").instructions.map(({ name }) => name), ["api-contract-design"]);

  const typeSafetyWords = read("source/concepts/type-safety/core.md").split(/\s+/u).length;
  assert.ok(typeSafetyWords <= 1000, `type-safety must stay compact; found ${typeSafetyWords} words`);
});

test("non-concept instructions have one install owner and a bounded baseline", () => {
  const owners = new Map();
  for (const entry of fs.readdirSync(path.join(repoRoot, "source/plugins"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const instruction of plugin(entry.name).instructions) {
      owners.set(instruction.name, [...(owners.get(instruction.name) ?? []), entry.name]);
    }
  }
  assert.equal(owners.has("type-safety"), false);
  assert.equal(owners.has("schema-driven-design"), false);
  assert.equal(owners.has("kotlin-code-correctness"), false);
  assert.equal(owners.has("kotlin-repository-engineering"), false);
  assert.deepEqual(owners.get("agent-execution"), ["engineering-baseline"]);
  assert.deepEqual(owners.get("engineering-design"), ["engineering-baseline"]);
  assert.deepEqual(owners.get("kotlin-engineering"), ["kotlin-engineering"]);
  assert.deepEqual(owners.get("api-contract-design"), ["api-contracts"]);
  assert.ok([...owners.values()].every(values => values.length === 1));
  const baselineWords = plugin("engineering-baseline").instructions.reduce((count, ref) =>
    count + read(`source/${ref.path}`).trim().split(/\s+/u).length, 0);
  assert.ok(baselineWords <= 1250, `baseline instructions grew to ${baselineWords} words`);
});

test("skill resources are skill-local and concepts stay deferred", () => {
  const skillFiles = fs
    .readdirSync(path.join(repoRoot, "source/skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `source/skills/${entry.name}/SKILL.md`)
    .filter((relativePath) => fs.existsSync(path.join(repoRoot, relativePath)));

  for (const relativePath of skillFiles) {
    const skillRoot = path.dirname(path.join(repoRoot, relativePath));
    const markdown = withoutFencedCode(read(relativePath));
    assert.doesNotMatch(
      markdown,
      /`concepts\/(?:type-safety|schema-driven-design|kotlin-code-correctness|kotlin-repository-engineering)\/core\.md`/u,
      `${relativePath} must not resolve repository concepts relative to an installed skill`,
    );
    assert.doesNotMatch(
      markdown,
      /`skills\/(?!\*)[a-z0-9-]+(?:\/[^`]*)?`/u,
      `${relativePath} must address another installed skill by name, not by a repository-relative path`,
    );
    for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const target = match[1].split("#", 1)[0];
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/)/iu.test(target)) continue;
      if (!/^(?:agents|assets|references|scripts)\//u.test(target)) continue;
      const resource = path.resolve(skillRoot, target);
      assert.ok(
        resource.startsWith(`${skillRoot}${path.sep}`),
        `${relativePath} resource link must remain inside its skill: ${target}`,
      );
      assert.ok(fs.existsSync(resource), `${relativePath} resource link must exist: ${target}`);
    }
  }
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

test("Kotlin semantic routing stays external-tool neutral", () => {
  const correctness = read("source/skills/kotlin-agentic-correctness/SKILL.md");
  const routing = read("source/evals/routing/kotlin-engineering-workflows.json");

  assert.doesNotMatch(correctness, /\bkast\b/i);
  assert.doesNotMatch(routing, /\bkast\b/i);
});
