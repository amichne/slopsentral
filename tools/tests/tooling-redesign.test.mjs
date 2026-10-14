import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadCatalog, pluginClosure, auditProfileComposition } from '../catalog.mjs';

const catalog = loadCatalog(path.resolve(import.meta.dirname, '../..'));
function closure(name) {
  return pluginClosure(catalog, catalog.plugins.find(p => p.name === name));
}
test('developer tooling consolidates explicit authoring without automatic effects', () => {
  const tooling = closure('developer-tooling');
  assert.deepEqual(tooling.findings, []);
  assert.ok([...tooling.refs.values()].every(ref => ['SKILL', 'AGENT'].includes(ref.type)));
  for (const name of ['cli-creator', 'plugin-composition-authoring', 'personal-setup-management',
    'openapi-contract-authoring', 'pkl-engineering']) {
    assert.ok(tooling.refs.has(`SKILL/${name}`));
  }
  for (const name of ['schema-type-enforcer', 'openapi-contract-rater']) assert.ok(tooling.refs.has(`AGENT/${name}`));
  assert.ok(!catalog.plugins.find(plugin => plugin.name === 'developer-tooling').codexMcpServers);
  for (const name of ['personal-setup', 'personal-configuration', 'api-contracts', 'pkl-workflows']) {
    assert.equal(catalog.plugins.some(plugin => plugin.name === name), false);
  }
});
test('source automation keeps a standalone identity without an authoring dependency', () => {
  const hook = catalog.marketplace.hooks.find(ref => ref.name === 'source-graph-valid');
  assert.ok(hook);
  assert.deepEqual(catalog.definitions.get('HOOK/source-graph-valid').dependsOn ?? [], []);
  for (const plugin of catalog.plugins) {
    assert.equal(pluginClosure(catalog, plugin).refs.has('HOOK/source-graph-valid'), false);
  }
});
test('profiles preserve shared skills and reject duplicate hook execution', () => {
  for (const name of ['developer-tooling-default', 'personal-configuration-default']) {
    assert.deepEqual(auditProfileComposition(catalog, catalog.profiles.find(profile => profile.name === name)), []);
  }
  const hook = catalog.marketplace.hooks.find(ref => ref.name === 'source-graph-valid');
  const fixture = {
    ...catalog,
    plugins: catalog.plugins.map(plugin => ['software-engineering', 'developer-tooling'].includes(plugin.name)
      ? { ...plugin, hooks: [...plugin.hooks, hook] } : plugin),
  };
  const selected = { name: 'duplicate-hook-fixture', plugins: ['software-engineering', 'developer-tooling'] };
  assert.match(auditProfileComposition(fixture, selected).join('\n'), /HOOK\/source-graph-valid multiple times/);
  assert.deepEqual(auditProfileComposition(catalog, selected), []);
});
