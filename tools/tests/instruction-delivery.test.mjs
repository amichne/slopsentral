import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog, pluginClosure } from '../catalog.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const bundles = {
  'software-engineering': ['agent-execution'],
  'engineering-excellence': ['engineering-design'],
  'kotlin-engineering': ['kotlin-engineering'],
  'api-contracts': ['api-contract-design'],
};

for (const [name, instructions] of Object.entries(bundles)) {
  test(`${name} delivers its complete policy through a bounded SessionStart hook`, () => {
    const plugin = catalog.plugins.find(p => p.name === name);
    const hook = plugin.hooks.find(ref => ref.name === `${name}-context`);
    assert.ok(hook, 'packaging an instruction index does not deliver model context');
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'source', hook.path)));
    assert.deepEqual(metadata.dependsOn.map(ref => ref.name), instructions);
    const closure = pluginClosure(catalog, plugin);
    assert.ok(instructions.every(id => closure.refs.has(`INSTRUCTION/${id}`)));
    const config = JSON.parse(fs.readFileSync(path.join(root, 'source', metadata.path)));
    const group = config.hooks.SessionStart[0];
    for (const source of ['startup', 'resume', 'clear', 'compact']) {
      assert.match(source, new RegExp(group.matcher));
    }
    assert.ok(group.hooks[0].additionalContextLimit > 0);
    const projected = process.env.INSTRUCTION_MARKETPLACE_ROOT;
    const pluginRoot = projected ? path.join(projected, '.agents/plugins', name) : path.join(root, 'source');
    const adapter = projected ? path.join(pluginRoot, 'hooks', path.basename(metadata.path)) : path.join(root, 'source', metadata.path);
    const command = JSON.parse(fs.readFileSync(adapter)).hooks.SessionStart[0].hooks[0].command;
    const result = spawnSync('bash', ['-c', command], {
      cwd: projected || pluginRoot,
      env: { ...process.env, PLUGIN_ROOT: pluginRoot },
      input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 'delivery-test' }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.notEqual(output.continue, false);
    for (const id of instructions) {
      const content = fs.readFileSync(path.join(root, 'source/instructions', `${id}.md`), 'utf8').trim();
      assert.ok(output.hookSpecificOutput.additionalContext.includes(content));
    }
  });
}

test('native startup trace contains the complete canonical policy as developer context', {
  skip: !process.env.NATIVE_CONTEXT_TRANSCRIPT,
}, () => {
  const items = fs.readFileSync(process.env.NATIVE_CONTEXT_TRANSCRIPT, 'utf8')
    .trim().split('\n').map(line => JSON.parse(line));
  const developer = items.filter(item => item.type === 'response_item' && item.payload?.role === 'developer')
    .map(item => item.payload.content.map(part => part.text ?? '').join('\n'));
  for (const id of Object.values(bundles).flat()) {
    const text = fs.readFileSync(path.join(root, 'source/instructions', `${id}.md`), 'utf8').trim();
    assert.ok(developer.some(message => message.includes(text)), `${id} must be delivered before claiming native loading`);
  }
});
