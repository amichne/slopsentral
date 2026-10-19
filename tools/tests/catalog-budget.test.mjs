import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const marketplace = JSON.parse(fs.readFileSync(path.join(root, 'source/adaptable.marketplace.json')));

test('the Kotlin-focused catalog ships at most half the uv baseline', () => {
  // Foundation 774716c ships 11 plugins and 61 standalone skills.
  assert.ok(marketplace.plugins.length <= 5, `${marketplace.plugins.length} plugins exceed 5`);
  assert.ok(marketplace.skills.length <= 30, `${marketplace.skills.length} skills exceed 30`);
  const authored = fs.readdirSync(path.join(root, 'source/skills'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, 'source/skills', entry.name, 'SKILL.md')))
    .map(entry => entry.name).sort();
  assert.deepEqual(authored, marketplace.skills.map(skill => skill.name).sort(), 'no hidden discoverable skills');
});

test('Kotlin defaults preserve proof owners without unrelated automation', () => {
  const profile = JSON.parse(fs.readFileSync(path.join(root, 'source/profiles/kotlin-repo-default.json')));
  assert.deepEqual(profile.plugins, ['software-engineering', 'kotlin-engineering']);
  const selected = profile.plugins.map(name => JSON.parse(fs.readFileSync(path.join(root, `source/plugins/${name}/plugin.json`))));
  const skills = new Set(selected.flatMap(plugin => plugin.skills.map(skill => skill.name)));
  for (const name of ['semantic-ratchet', 'kotlin-design-practices', 'kotlin-review', 'negative-capability-proof', 'kotlin-gradle-validation']) {
    assert.ok(skills.has(name), `${name} remains discoverable`);
  }
  const hooks = selected.flatMap(plugin => plugin.hooks.map(hook => hook.name));
  for (const name of ['required-skill-read', 'source-graph-valid', 'pkl-evaluate-check', 'api-contracts-context']) {
    assert.ok(!hooks.includes(name), `${name} must not enter the Kotlin default`);
  }
});
