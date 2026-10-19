import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { auditCatalog, loadCatalog, pluginClosure } from '../catalog.mjs';
import { checkProofExamples } from '../check-proof-examples.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const plugin = name => catalog.plugins.find(entry => entry.name === name);

test('Software Engineering owns proof preservation and its delivered policy exactly once', () => {
  const excellence = plugin('software-engineering');
  assert.ok(excellence, 'Engineering Excellence must be an installable composition');
  const closure = pluginClosure(catalog, excellence).refs;
  assert.ok(closure.has('SKILL/semantic-ratchet'));
  assert.equal(closure.has('HOOK/software-engineering-context'), false);
  assert.equal(closure.has('INSTRUCTION/engineering-design'), false);
  const delivery = pluginClosure(catalog, plugin('software-engineering')).refs;
  assert.equal(delivery.has('INSTRUCTION/agent-execution'), false);
  assert.equal(delivery.has('SKILL/semantic-ratchet'), true);
  assert.equal(delivery.has('INSTRUCTION/engineering-design'), false);
  assert.deepEqual(auditCatalog(catalog), []);
});

test('code profiles include proof-preservation capability and one policy hook', () => {
  for (const name of ['local-development-default', 'kotlin-repo-default',
    'intellij-plugin-default', 'agent-authoring-default']) {
    const profile = catalog.profiles.find(entry => entry.name === name);
    assert.ok(profile.plugins.includes('software-engineering'), name);
    const closures = profile.plugins.map(name => pluginClosure(catalog, plugin(name)).refs);
    assert.ok(closures.some(refs => refs.has('SKILL/semantic-ratchet')));
    assert.equal(closures.filter(refs => refs.has('HOOK/software-engineering-context')).length, 0);
  }
  assert.equal(catalog.profiles.find(entry => entry.name === 'documentation-default')
    .plugins.includes('software-engineering'), false);
});

test('bundled contracts reject illegal payloads', () => {
  const evidence = checkProofExamples({ contractsOnly: true });
  assert.equal(evidence.type, 'PROOF_EXAMPLES_CHECKED');
  assert.equal(evidence.mode, 'CONTRACTS_ONLY');
  assert.ok(evidence.schema_cases > 0);
  assert.deepEqual(evidence.kotlin, { type: 'NOT_RUN', reason: 'CONTRACTS_ONLY' });
});
