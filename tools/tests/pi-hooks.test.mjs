import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { createAgentSession, DefaultResourceLoader, initTheme, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { SettingsList } from '@earendil-works/pi-tui';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseHookSettings } from '../../source/hooks/pi/controls.ts';

async function fixture(t, { instructions = [] } = {}) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-hooks-menu-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const agentDir = path.join(directory, 'agent');
  fs.mkdirSync(agentDir);
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; });
  const extensions = ['scope', 'drift'].map(plugin => {
    const root = path.join(directory, plugin);
    fs.mkdirSync(path.join(root, 'hooks'), { recursive: true });
    for (const file of ['adapter.ts', 'controls.ts']) fs.copyFileSync(path.resolve('source/hooks/pi', file), path.join(root, 'hooks', file));
    fs.writeFileSync(path.join(root, 'hooks/fixture.mjs'), `
      import fs from 'node:fs';
      let input = ''; for await (const chunk of process.stdin) input += chunk;
      const event = JSON.parse(input).hook_event_name;
      fs.appendFileSync(${JSON.stringify(path.join(directory, 'calls'))}, ${JSON.stringify(plugin + ':')} + event + '\\n');
      console.log(JSON.stringify({hookSpecificOutput: {additionalContext: ${JSON.stringify(plugin + ':')} + event}}));
    `);
    const file = path.join(root, 'native.ts');
    const adapter = pathToFileURL(path.join(root, 'hooks/adapter.ts')).href;
    const hooks = (plugin === 'scope' ? ['SessionStart', 'UserPromptSubmit', 'Stop'] : ['Stop']).map(event =>
      ({ name: plugin, event, command: 'node hooks/fixture.mjs', timeout: 2 }));
    fs.writeFileSync(file, `import { register } from ${JSON.stringify(adapter)}; export default pi => register(pi, ${JSON.stringify(root)}, ${JSON.stringify({ plugin, instructions: plugin === 'scope' ? instructions : [], hooks })});`);
    return file;
  });
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({ cwd: directory, agentDir, settingsManager, noSkills: true, additionalExtensionPaths: extensions });
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd: directory, agentDir, settingsManager, resourceLoader, modelRuntime,
    sessionManager: SessionManager.inMemory(directory) });
  t.after(() => session.dispose());
  await session.bindExtensions({ mode: 'print', onError: error => assert.fail(JSON.stringify(error)) });
  const runner = session.extensionRunner;
  initTheme();
  const start = () => runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the fixture.' }, { cwd: directory });
  const settle = () => runner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' },
    () => ({ contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: true }));
  const calls = () => fs.existsSync(path.join(directory, 'calls')) ? fs.readFileSync(path.join(directory, 'calls'), 'utf8').trim().split('\n') : [];
  const settingsFile = path.join(agentDir, 'slopsentral-hooks.json');
  const menu = async use => {
    const runner = session.extensionRunner;
    let completed = false;
    const ctx = runner.createCommandContext();
    const errors = [];
    await runner.getCommand('hooks').handler('', { ...ctx, hasUI: true, ui: { ...ctx.ui,
      notify: (message, type) => errors.push({ message, type }),
      custom: async factory => {
        const component = await factory({ requestRender() {} }, {}, {}, () => { completed = true; });
        const list = component.children.find(child => child instanceof SettingsList);
        assert.ok(list);
        await use(list, component);
        component.handleInput('\u001b');
      },
    } });
    if (!errors.length) assert.equal(completed, true);
    return errors;
  };
  return { directory, runner, session, start, settle, calls, menu, settingsFile };
}

test('Pi sends keyboard input to the menu component', async t => {
  const { menu, settingsFile } = await fixture(t);
  await menu((_list, component) => {
    assert.equal(typeof component.handleInput, 'function');
    component.handleInput('\r');
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).disabled, ['drift/drift']);
});

test('native Pi exposes one hooks menu across separately loaded adapters', async t => {
  const { runner, session } = await fixture(t);
  assert.equal(runner.getRegisteredCommands().filter(command => command.name === 'hooks').length, 1);
  assert.deepEqual(runner.getCommandDiagnostics(), []);
  await session.reload();
  assert.equal(session.extensionRunner.getRegisteredCommands().filter(command => command.name === 'hooks').length, 1);
  assert.deepEqual(session.extensionRunner.getCommandDiagnostics(), []);
});

test('native menu shows events and scripts, saves binary choices, and prevents disabled processes', async t => {
  const { start, settle, calls, menu, settingsFile } = await fixture(t);
  assert.match((await start()).systemPromptOptions.forceSystemPrompt, /scope:SessionStart/);
  await settle();
  assert.deepEqual(calls(), ['scope:SessionStart', 'scope:UserPromptSubmit', 'scope:Stop', 'drift:Stop']);
  assert.deepEqual(await menu(list => {
    list.selectItem('scope/scope');
    const rendered = list.render(150).join('\n');
    for (const text of ['SessionStart', 'UserPromptSubmit', 'Stop', 'before_agent_start', 'agent_before_settle', 'node hooks/fixture.mjs', 'Script root:'])
      assert.ok(rendered.includes(text), text);
    assert.match(rendered, /scope\/scope.*on/);
    list.handleInput('\r');
    assert.match(list.render(150).join('\n'), /scope\/scope.*off/);
    // The other plugin keeps its own choice, while all events of scope share one switch.
    assert.match(list.render(150).join('\n'), /drift\/drift.*on/);
  }), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)), { schemaVersion: 1, disabled: ['scope/scope'] });
  assert.equal(fs.statSync(settingsFile).mode & 0o777, 0o600);
  assert.doesNotMatch((await start()).systemPromptOptions.forceSystemPrompt, /scope:SessionStart/);
  await settle();
  assert.deepEqual(calls().slice(4), ['drift:Stop']);
  assert.deepEqual(await menu(list => {
    list.selectItem('scope/scope');
    assert.match(list.render(150).join('\n'), /scope\/scope.*off/);
    list.handleInput(' ');
  }), []);
  assert.match((await start()).systemPromptOptions.forceSystemPrompt, /scope:SessionStart/);
  await settle();
  assert.deepEqual(calls().slice(5), ['scope:SessionStart', 'scope:UserPromptSubmit', 'scope:Stop', 'drift:Stop']);
});

test('saved choices survive native reload and Esc changes no choice', async t => {
  const { session, menu, settingsFile, calls, directory } = await fixture(t);
  await menu(list => { list.selectItem('scope/scope'); list.handleInput('\r'); });
  const saved = fs.readFileSync(settingsFile);
  await session.reload();
  const runner = session.extensionRunner;
  await runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'After reload.' }, { cwd: directory });
  assert.deepEqual(calls(), []);
  // Reopening the original menu also reads the saved choices instead of stale state.
  await menu(list => { list.selectItem('scope/scope'); assert.match(list.render(150).join('\n'), /scope\/scope.*off/); });
  assert.deepEqual(fs.readFileSync(settingsFile), saved);
});

test('malformed settings stop hook effects and cannot be overwritten through the menu', async t => {
  const { start, settle, calls, menu, runner, settingsFile } = await fixture(t);
  fs.writeFileSync(settingsFile, '{broken');
  assert.match((await start()).systemPromptOptions.forceSystemPrompt, /HOOK_SETTINGS_INVALID/);
  assert.deepEqual(await runner.emitToolCall({ type: 'tool_call', toolCallId: 'blocked', toolName: 'read', input: {} }),
    { block: true, reason: 'HOOK_SETTINGS_INVALID' });
  assert.match(JSON.stringify(await settle()), /HOOK_SETTINGS_INVALID/);
  assert.deepEqual(calls(), []);
  const errors = await menu(() => assert.fail('Invalid choices must not enter the menu'));
  assert.match(errors[0].message, /HOOK_SETTINGS_INVALID/);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), '{broken');
  fs.rmSync(settingsFile);
  await start();
  assert.deepEqual(calls(), ['scope:SessionStart', 'scope:UserPromptSubmit']);
});

test('a disabled rejecting hook cannot block tools while an enabled hook still rejects', async t => {
  const { directory, start, runner, menu } = await fixture(t);
  fs.writeFileSync(path.join(directory, 'scope/hooks/fixture.mjs'), 'console.log(JSON.stringify({decision:"block",reason:"fixture rejection"}))');
  await start();
  const tool = () => runner.emitToolCall({ type: 'tool_call', toolCallId: 'read', toolName: 'read', input: {} });
  assert.deepEqual(await tool(), { block: true, reason: 'fixture rejection' });
  await menu(list => { list.selectItem('scope/scope'); list.handleInput('\r'); });
  // A current turn keeps its admission result until the next request.
  assert.deepEqual(await tool(), { block: true, reason: 'fixture rejection' });
  await start();
  assert.equal(await tool(), undefined);
  await menu(list => { list.selectItem('scope/scope'); list.handleInput('\r'); });
  await start();
  assert.deepEqual(await tool(), { block: true, reason: 'fixture rejection' });
});

test('a failed save restores the displayed choice and preserves saved settings', async t => {
  const { menu, settingsFile } = await fixture(t);
  const errors = await menu(list => {
    list.selectItem('scope/scope');
    fs.mkdirSync(settingsFile);
    list.handleInput('\r');
    assert.match(list.render(150).join('\n'), /scope\/scope.*on/);
  });
  assert.match(errors[0].message, /HOOK_SETTINGS_UNREADABLE/);
  assert.equal(fs.statSync(settingsFile).isDirectory(), true);
});

test('a write failure restores the displayed choice without replacing the saved file', async t => {
  const { menu, settingsFile } = await fixture(t);
  const original = '{"schemaVersion":1,"disabled":[]}\n';
  fs.writeFileSync(settingsFile, original);
  const errors = await menu(list => {
    list.selectItem('scope/scope');
    fs.chmodSync(path.dirname(settingsFile), 0o500);
    try {
      list.handleInput('\r');
      assert.match(list.render(150).join('\n'), /scope\/scope.*on/);
    } finally { fs.chmodSync(path.dirname(settingsFile), 0o700); }
  });
  assert.match(errors[0].message, /HOOK_SETTINGS_WRITE_FAILED/);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), original);
});

test('hook switches cannot bypass an unavailable shared instruction', async t => {
  const { directory, start, runner, menu } = await fixture(t, { instructions: ['policy.md'] });
  fs.writeFileSync(path.join(directory, 'scope/hooks/fixture.mjs'), 'console.log(JSON.stringify({decision:"block",reason:"hook rejection"}))');
  await start();
  await menu(list => { list.selectItem('scope/scope'); list.handleInput('\r'); });
  await start();
  assert.deepEqual(await runner.emitToolCall({ type: 'tool_call', toolCallId: 'read', toolName: 'read', input: {} }),
    { block: true, reason: 'INSTRUCTION_UNAVAILABLE' });
});

test('the schema and runtime ingress reject nonbinary, duplicate, and malformed choices', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../../source/schemas/pi/hooks.schema.json', import.meta.url)));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  for (const value of [schema.examples[0], { schemaVersion: 1, disabled: [] },
    { schemaVersion: 1, disabled: ['unloaded-plugin/unloaded-hook'] }]) {
    assert.equal(validate(value), true);
    assert.equal(parseHookSettings(value).type, 'ready');
  }
  for (const value of [null, [], {}, { schemaVersion: 2, disabled: [] },
    { schemaVersion: 1, disabled: ['scope/scope', 'scope/scope'] },
    { schemaVersion: 1, disabled: ['../scope'] }, { schemaVersion: 1, disabled: [true] },
    { schemaVersion: 1, disabled: [], enabled: 'sometimes' }, { schemaVersion: 1, disabled: 'scope/scope' }]) {
    assert.equal(validate(value), false, JSON.stringify(value));
    assert.deepEqual(parseHookSettings(value), { type: 'failed', reason: 'HOOK_SETTINGS_INVALID' });
  }
});
