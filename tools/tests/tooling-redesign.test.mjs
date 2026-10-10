import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadCatalog, pluginClosure, auditProfileComposition } from '../catalog.mjs';

const catalog = loadCatalog(path.resolve(import.meta.dirname, '../..'));
function closure(name) {
  return pluginClosure(catalog, catalog.plugins.find(p => p.name === name));
}
test('toolmaking and personal setup expose independent installation intents', () => {
  const tooling = closure('developer-tooling');
  const personal = closure('personal-configuration');
  for (const candidate of [tooling, personal]) {
    assert.deepEqual(candidate.findings, []);
    assert.ok([...candidate.refs.values()].every(r => r.type === 'SKILL'));
  }
  assert.ok(tooling.refs.has('SKILL/cli-creator'));
  assert.ok(tooling.refs.has('SKILL/plugin-composition-authoring'));
  assert.ok(!tooling.refs.has('SKILL/personal-setup-management'));
  assert.ok(personal.refs.has('SKILL/personal-setup-management'));
  assert.ok(!personal.refs.has('SKILL/plugin-composition-authoring'));
  for (const name of ['developer-tooling', 'personal-configuration'])
    assert.ok(!catalog.plugins.find(p => p.name === name).codexMcpServers);
  const retained = [...closure('personal-setup').refs.keys()].filter(k => k.startsWith('SKILL/')).sort();
  const alternatives = [...new Set([...tooling.refs.keys(), ...personal.refs.keys()])].sort();
  assert.deepEqual(alternatives, retained, 'the pilot alternatives must preserve every legacy workflow');
});
test('source automation carries executable resources without authoring skill dependencies', () => {
  assert.deepEqual([...closure('repository-source-checks').refs.keys()], ['HOOK/source-graph-valid']);
});
test('candidate profiles preserve shared skills and reject overlapping automatic behavior', () => {
  for (const name of ['developer-tooling-default', 'personal-configuration-default'])
    assert.deepEqual(auditProfileComposition(catalog, catalog.profiles.find(p => p.name === name)), []);
  const personal = catalog.profiles.find(p => p.name === 'personal-configuration-default');
  assert.ok(!personal.plugins.includes('repository-source-checks'));
  const candidate = catalog.profiles.find(p => p.name === 'developer-tooling-default');
  const conflict = { ...candidate, plugins: [...candidate.plugins, 'personal-setup'] };
  assert.match(auditProfileComposition(catalog, conflict).join('\n'), /HOOK\/source-graph-valid multiple times/);
  assert.deepEqual(auditProfileComposition(catalog, { name: 'shared-guidance', plugins: ['developer-tooling', 'personal-configuration'] }), []);
});
