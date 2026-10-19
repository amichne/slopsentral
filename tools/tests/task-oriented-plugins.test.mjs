import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { auditCatalog, loadCatalog, pluginClosure, renderCatalog } from '../catalog.mjs';

const catalog = loadCatalog(path.resolve(import.meta.dirname, '../..'));
const plugin = name => catalog.plugins.find(p => p.name === name);

test('everyday implementation and delivery need only one plugin', () => {
  const engineering = plugin('software-engineering');
  assert.ok(engineering, 'Software Engineering must be an installable plugin');
  const closure = pluginClosure(catalog, engineering).refs;
  assert.deepEqual([...closure.keys()], ['SKILL/semantic-ratchet']);
  for (const name of ['cli-creator']) {
    assert.ok(!closure.has(`SKILL/${name}`), `${name} belongs to the tool-building specialty`);
    assert.ok(pluginClosure(catalog, plugin('developer-tooling')).refs.has(`SKILL/${name}`));
  }
  assert.deepEqual(auditCatalog(catalog), []);
});

test('repository defaults add only required specialties', () => {
  const selections = Object.fromEntries(catalog.profiles.map(p => [p.name, p.plugins]));
  assert.deepEqual(selections['local-development-default'], ['software-engineering']);
  assert.deepEqual(selections['kotlin-repo-default'], ['software-engineering', 'kotlin-engineering']);
  assert.deepEqual(selections['intellij-plugin-default'],
    ['software-engineering', 'kotlin-engineering', 'intellij-plugin-development']);
  assert.deepEqual(selections['documentation-default'], ['repository-knowledge']);
  assert.deepEqual(selections['agent-authoring-default'], ['software-engineering', 'developer-tooling']);
  for (const profile of catalog.profiles) {
    assert.ok(!profile.plugins.includes('skill-read-policy'));
  }
});

test('the generated chooser names only shipped plugins', () => {
  const rendered = renderCatalog(catalog);
  assert.match(rendered, /## Start here/);
  assert.match(rendered, /## Specialties/);
  assert.ok(rendered.indexOf('### software-engineering') < rendered.indexOf('## Specialties'));
  const names = [...rendered.matchAll(/^### ([a-z-]+)$/gm)].map(match => match[1]).sort();
  assert.deepEqual(names, catalog.plugins.map(plugin => plugin.name).sort());
  assert.equal(names.length, 5);
  assert.ok(catalog.marketplace.skills.length <= 30);
});


test('consolidated specialties expose one owner per kept workflow', () => {
  const developer = pluginClosure(catalog, plugin('developer-tooling')).refs;
  for (const name of ['personal-setup-management', 'cli-creator', 'skill-primitive-authoring',
    'plugin-composition-authoring', 'openapi-contract-authoring', 'manage-json-schemas',
    'python-tooling', 'pkl-engineering']) {
    assert.ok(developer.has(`SKILL/${name}`), `Developer Tooling must include ${name}`);
  }
  assert.ok([...developer.values()].every(ref => ['SKILL', 'AGENT'].includes(ref.type)));
  const knowledge = pluginClosure(catalog, plugin('repository-knowledge')).refs;
  for (const name of ['code-knowledge-base', 'local-repository-navigation',
    'controlled-technical-writing', 'technical-documentation']) {
    assert.ok(knowledge.has(`SKILL/${name}`), `Repository Knowledge must include ${name}`);
  }
  for (const name of ['cli-development', 'agent-tooling', 'technical-writing', 'personal-configuration',
    'api-contracts', 'pkl-workflows', 'repository-source-checks', 'skill-read-policy', 'pkl-repository-checks']) {
    assert.equal(plugin(name), undefined, `${name} must no longer be a competing install`);
  }
});
