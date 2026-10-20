import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
// Published composition at 7958ea3, before the Pi adapter entered the source graph.
const expected = {
  'software-engineering': ['semantic-ratchet', 'python-tooling', 'tdd', 'git-change-flow',
    'mise-project-tooling', 'github-ci-operations', 'issue-tracker-operations', 'pull-request-lifecycle'],
  'kotlin-engineering': ['kotlin-design-practices', 'kotlin-review', 'kotlin-application-stack',
    'negative-capability-proof', 'kotlin-gradle-validation', 'gradle-performance-engineering'],
  'intellij-plugin-development': ['intellij-plugin-delivery', 'intellij-platform-testing', 'intellij-psi-indexing'],
  'developer-tooling': ['python-tooling', 'cli-creator', 'skill-primitive-authoring', 'plugin-composition-authoring',
    'manage-json-schemas', 'openapi-contract-authoring', 'personal-setup-management', 'pkl-engineering'],
  'repository-knowledge': ['code-knowledge-base', 'local-repository-navigation',
    'controlled-technical-writing', 'technical-documentation'],
};
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('the five full plugins compose the published 28-skill catalog', () => {
  const market = read(path.join(root, 'source/adaptable.marketplace.json'));
  assert.deepEqual(market.plugins.map(plugin => plugin.name).sort(), Object.keys(expected).sort());
  assert.deepEqual(market.skills.map(skill => skill.name).sort(), [...new Set(Object.values(expected).flat())].sort());
  for (const [name, skills] of Object.entries(expected)) {
    const plugin = read(path.join(root, 'source/plugins', name, 'plugin.json'));
    assert.deepEqual(plugin.skills.map(skill => skill.name).sort(), [...skills].sort(), name);
  }
  const engineering = read(path.join(root, 'source/plugins/software-engineering/plugin.json'));
  assert.deepEqual(engineering.hooks.map(hook => hook.name).sort(),
    ['agents-md-scope', 'software-engineering-context']);
});

for (const [variable, prefix] of [['REUSE_CODEX_PROJECTION', '.agents/plugins'],
  ['REUSE_COPILOT_PROJECTION', '.github/plugin']]) {
  test(`${prefix} exposes every skill through its full plugin`, { skip: !process.env[variable] }, () => {
    const directory = path.join(process.env[variable], prefix);
    const market = read(path.join(directory, 'marketplace.json'));
    assert.deepEqual(market.plugins.map(plugin => plugin.name).sort(), Object.keys(expected).sort());
    assert.ok(fs.readdirSync(directory, { recursive: true }).every(file =>
      !file.split(path.sep).some(part => ['.pytest_cache', '.ruff_cache'].includes(part))),
    'published plugins exclude local assessment and test caches');
    for (const [name, skills] of Object.entries(expected)) {
      const actual = fs.readdirSync(path.join(directory, name, 'skills')).sort();
      assert.deepEqual(actual, [...skills].sort(), name);
      for (const skill of skills) {
        assert.deepEqual(fs.readFileSync(path.join(directory, name, 'skills', skill, 'SKILL.md')),
          fs.readFileSync(path.join(root, 'source/skills', skill, 'SKILL.md')));
      }
    }
  });
}
