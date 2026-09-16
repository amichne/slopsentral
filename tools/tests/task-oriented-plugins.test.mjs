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
  for (const name of ['tdd', 'semantic-ratchet', 'git-change-flow', 'shell-script-safety',
    'cli-data-pipelines', 'mise-project-tooling', 'github-ci-operations',
    'issue-tracker-operations', 'pull-request-lifecycle', 'delivery-pipeline-design']) {
    assert.ok(closure.has(`SKILL/${name}`), `one installation must include ${name}`);
  }
  for (const name of ['cli-creator', 'shell-session-integration', 'terminal-ui-design']) {
    assert.ok(!closure.has(`SKILL/${name}`), `${name} belongs to the tool-building specialty`);
    assert.ok(pluginClosure(catalog, plugin('cli-development')).refs.has(`SKILL/${name}`));
  }
  assert.deepEqual(auditCatalog(catalog), []);
});

test('repository defaults add only required specialties', () => {
  const selections = Object.fromEntries(catalog.profiles.map(p => [p.name, p.plugins]));
  assert.deepEqual(selections['local-development-default'], ['software-engineering']);
  assert.deepEqual(selections['kotlin-repo-default'], ['software-engineering', 'kotlin-engineering']);
  assert.deepEqual(selections['intellij-plugin-default'],
    ['software-engineering', 'kotlin-engineering', 'intellij-plugin-development']);
  assert.deepEqual(selections['documentation-default'], ['technical-writing']);
  assert.deepEqual(selections['agent-authoring-default'], ['software-engineering', 'agent-tooling']);
  for (const profile of catalog.profiles) {
    assert.ok(!profile.plugins.includes('repository-knowledge'));
    assert.ok(!profile.plugins.includes('skill-read-policy'));
  }
});

test('the generated chooser separates the default, specialties, and advanced policy', () => {
  const rendered = renderCatalog(catalog);
  assert.match(rendered, /## Start here/);
  assert.match(rendered, /## Specialties/);
  assert.match(rendered, /## Advanced repository policy/);
  assert.ok(rendered.indexOf('### software-engineering') < rendered.indexOf('## Specialties'));
  assert.ok(rendered.indexOf('### skill-read-policy') > rendered.indexOf('## Advanced repository policy'));
});
