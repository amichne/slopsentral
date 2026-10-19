import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog, pluginClosure } from '../catalog.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const bundles = {
  'kotlin-engineering': ['kotlin-engineering'],
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

// API context stays an explicit standalone primitive after its plugin retires.
test('standalone API policy preserves the complete output contract', () => {
  const metadata = catalog.definitions.get('HOOK/api-contracts-context');
  assert.deepEqual(metadata.dependsOn.map(ref => ref.name), ['api-contract-design']);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'source', metadata.path)));
  const command = config.hooks.SessionStart[0].hooks[0].command;
  const result = spawnSync('bash', ['-c', command], {
    cwd: path.join(root, 'source'), env: { ...process.env, PLUGIN_ROOT: path.join(root, 'source') },
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 'standalone-policy-test' }), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.ok(output.hookSpecificOutput.additionalContext.includes(
    fs.readFileSync(path.join(root, 'source/instructions/api-contract-design.md'), 'utf8').trim()));
  assert.ok(catalog.plugins.every(plugin => !plugin.hooks.some(ref => ref.name === 'api-contracts-context')));
});

test('the explicit scope primitive preserves review behavior outside the default plugin', t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-scope-contract-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const repository = path.join(temporary, 'repository with spaces;literal');
  fs.mkdirSync(path.join(repository, 'module'), { recursive: true });
  const git = (...args) => {
    const result = spawnSync('git', ['-C', repository, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.com');
  fs.writeFileSync(path.join(repository, 'AGENTS.md'), '# Repository\nUse the original command.\n');
  fs.writeFileSync(path.join(repository, 'module/main.py'), 'original\n');
  git('add', '.');
  git('commit', '-qm', 'fixture');

  const projected = process.env.INSTRUCTION_MARKETPLACE_ROOT;
  const pluginRoot = path.join(root, 'source');
  const adapter = path.join(root, 'source/hooks/codex/agents-md-scope.hooks.json');
  const config = JSON.parse(fs.readFileSync(adapter));
  const environment = { ...process.env, PLUGIN_ROOT: pluginRoot, CODEX_HOME: path.join(temporary, 'codex') };
  const run = (command, input) => {
    const result = spawnSync('bash', ['-c', command], {
      cwd: pluginRoot, env: environment, input, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const hook = (event, raw) => run(config.hooks[event][0].hooks[0].command, raw ?? JSON.stringify({
    hook_event_name: event, session_id: 'scope-contract', cwd: repository,
    tool_name: 'Bash', tool_input: {}, tool_response: { exit_code: 1 }, stop_hook_active: false,
  }));
  assert.deepEqual(Object.keys(config.hooks).sort(), ['PostToolUse', 'Stop', 'UserPromptSubmit']);
  assert.deepEqual(hook('UserPromptSubmit'), {});
  assert.deepEqual(hook('PostToolUse'), {});
  fs.writeFileSync(path.join(repository, 'module/pyproject.toml'), '[project]\nname = "module"\n');
  assert.match(hook('PostToolUse').hookSpecificOutput.additionalContext, /module\/AGENTS\.md/);
  assert.equal(fs.existsSync(path.join(repository, 'module/AGENTS.md')), false);
  assert.equal(hook('Stop').decision, 'block');

  fs.writeFileSync(path.join(repository, 'module/AGENTS.md'), '# Module\nUse the module command.\n');
  fs.writeFileSync(path.join(repository, 'AGENTS.md'), '# Repository\nUse the new root command.\n');
  const refreshed = hook('PostToolUse').hookSpecificOutput.additionalContext;
  assert.match(refreshed, /Use the new root command\./);
  assert.match(refreshed, /module\/AGENTS\.md/);
  const stopped = hook('Stop');
  assert.equal(stopped.decision, 'block');
  const statusCommand = stopped.reason.split('Full path inventory:\n').at(-1);
  const status = run(statusCommand);
  assert.equal(status.type, 'SCOPE_STATUS');
  const receipt = run(status.reviewCommand.replace('REPLACE WITH SOURCE-BACKED REVIEW RESULT',
    'The root and module instructions now describe their fixture source.'));
  assert.equal(receipt.type, 'REVIEW_RECORDED');
  assert.deepEqual(hook('Stop'), {});
  assert.match(hook('PostToolUse', '[]').systemMessage, /INVALID_EVENT/);
});
