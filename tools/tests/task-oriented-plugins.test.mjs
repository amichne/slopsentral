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
  for (const name of ['validation-first', 'tdd', 'git-change-flow', 'shell-script-safety',
    'cli-data-pipelines', 'mise-project-tooling', 'github-ci-operations',
    'issue-tracker-operations', 'pull-request-lifecycle', 'delivery-pipeline-design']) {
    assert.ok(closure.has(`SKILL/${name}`), `one installation must include ${name}`);
  }
  for (const name of ['cli-creator', 'shell-session-integration', 'terminal-ui-design']) {
    assert.ok(!closure.has(`SKILL/${name}`), `${name} belongs to the tool-building specialty`);
    assert.ok(pluginClosure(catalog, plugin('personal-setup')).refs.has(`SKILL/${name}`));
  }
  assert.deepEqual(auditCatalog(catalog), []);
});

test('repository defaults add only required specialties', () => {
  const selections = Object.fromEntries(catalog.profiles.map(p => [p.name, p.plugins]));
  assert.deepEqual(selections['local-development-default'], ['software-engineering', 'engineering-excellence']);
  assert.deepEqual(selections['kotlin-repo-default'], ['software-engineering', 'engineering-excellence', 'kotlin-engineering']);
  assert.deepEqual(selections['intellij-plugin-default'],
    ['software-engineering', 'engineering-excellence', 'kotlin-engineering', 'intellij-plugin-development']);
  assert.deepEqual(selections['documentation-default'], ['repository-knowledge']);
  assert.deepEqual(selections['agent-authoring-default'], ['software-engineering', 'engineering-excellence', 'personal-setup']);
  for (const profile of catalog.profiles) {
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


test('consolidated specialties retain all primitive capabilities', () => {
  const personal = pluginClosure(catalog, plugin('personal-setup')).refs;
  for (const name of ['personal-setup-management', 'personal-cli-authoring',
    'cli-creator', 'shell-session-integration', 'terminal-ui-design',
    'skill-primitive-authoring', 'agent-profile-authoring', 'hook-primitive-authoring',
    'plugin-composition-authoring', 'primitive-routing-evaluation', 'repo-instruction-topology']) {
    assert.ok(personal.has(`SKILL/${name}`), `Personal Setup must retain ${name}`);
  }
  assert.ok(personal.has('HOOK/source-graph-valid'));
  const knowledge = pluginClosure(catalog, plugin('repository-knowledge')).refs;
  for (const name of ['code-knowledge-base', 'repository-signature-indexing',
    'local-repository-navigation', 'controlled-technical-writing', 'technical-documentation',
    'reference-doc-workflow', 'site-docs-authoring']) {
    assert.ok(knowledge.has(`SKILL/${name}`), `Repository Knowledge must retain ${name}`);
  }
  for (const name of ['cli-development', 'agent-tooling', 'technical-writing']) {
    assert.equal(plugin(name), undefined, `${name} must no longer be a competing install`);
  }
});
