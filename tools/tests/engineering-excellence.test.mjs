import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { auditCatalog, loadCatalog, pluginClosure } from '../catalog.mjs';
import { checkProofExamples } from '../../source/skills/semantic-ratchet/scripts/check-proof-examples.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const plugin = name => catalog.plugins.find(entry => entry.name === name);

test('Engineering Excellence owns proof preservation and its delivered policy exactly once', () => {
  const excellence = plugin('engineering-excellence');
  assert.ok(excellence, 'Engineering Excellence must be an installable composition');
  const closure = pluginClosure(catalog, excellence).refs;
  assert.ok(closure.has('SKILL/semantic-ratchet'));
  assert.ok(closure.has('HOOK/engineering-excellence-context'));
  assert.ok(closure.has('INSTRUCTION/engineering-design'));
  const delivery = pluginClosure(catalog, plugin('software-engineering')).refs;
  assert.ok(delivery.has('INSTRUCTION/agent-execution'));
  assert.equal(delivery.has('SKILL/semantic-ratchet'), false);
  assert.equal(delivery.has('INSTRUCTION/engineering-design'), false);
  assert.deepEqual(auditCatalog(catalog), []);
});

test('code profiles preserve proof-preservation capability without duplicate ownership', () => {
  for (const name of ['local-development-default', 'kotlin-repo-default',
    'intellij-plugin-default', 'agent-authoring-default']) {
    const profile = catalog.profiles.find(entry => entry.name === name);
    assert.ok(profile.plugins.includes('engineering-excellence'), name);
    const owners = profile.plugins.filter(owner =>
      pluginClosure(catalog, plugin(owner)).refs.has('SKILL/semantic-ratchet'));
    assert.deepEqual(owners, ['engineering-excellence']);
  }
  assert.equal(catalog.profiles.find(entry => entry.name === 'documentation-default')
    .plugins.includes('engineering-excellence'), false);
});

test('bundled contracts reject illegal payloads and stop shell transitions after failure', () => {
  const evidence = checkProofExamples({ contractsOnly: true });
  assert.equal(evidence.type, 'PROOF_EXAMPLES_CHECKED');
  assert.equal(evidence.mode, 'CONTRACTS_ONLY');
  assert.ok(evidence.schema_cases > 0);
  assert.ok(evidence.shell_cases > 0);
  assert.deepEqual(evidence.kotlin, { type: 'NOT_RUN', reason: 'CONTRACTS_ONLY' });
});
