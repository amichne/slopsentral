import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');

async function host(t, packagePath, directory, flag) {
  const settingsManager = SettingsManager.inMemory({ packages: [] });
  const agentDir = path.join(directory, 'agent');
  fs.mkdirSync(agentDir);
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir, settingsManager,
    additionalExtensionPaths: [packagePath], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd: directory, agentDir, resourceLoader: loader, modelRuntime,
    settingsManager, sessionManager: SessionManager.inMemory(directory) });
  t.after(() => session.dispose());
  const errors = [];
  let aborts = 0;
  if (flag) session.extensionRunner.setFlagValue('slopsentral-profile', flag);
  await session.bindExtensions({ mode: 'print', onError: error => errors.push(error), abortHandler: () => { aborts++; } });
  return { session, loader, errors, aborts: () => aborts };
}

test('Pi 1.2 native loader dispatches profile commands, prompt sections, and branch restoration without a provider', { skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_PI_PACKAGE }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-pi-host-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let packagePath = process.env.SLOPSENTRAL_PI_PACKAGE;
  if (!packagePath) {
    project({ source: root, harness: 'pi', out: path.join(directory, 'projection') });
    packagePath = path.join(directory, 'projection/.pi/slopsentral');
  }
  const { session, loader, errors } = await host(t, packagePath, directory);
  const commands = session.extensionRunner.getRegisteredCommands().map(c => c.name);
  assert.ok(commands.includes('slopsentral-profile'));
  assert.ok(commands.includes('slopsentral-type-design'));
  assert.ok(commands.includes('slopsentral-check'));
  assert.ok(loader.getSkills().skills.some(s => s.name === 'openapi-contract-authoring'));
  const tools = session.getActiveToolNames();
  await session.prompt('/slopsentral-kotlin-type-design');
  const kotlinEntry = session.sessionManager.getBranch().at(-1);
  assert.equal(kotlinEntry.customType, 'slopsentral-profile');
  assert.equal(kotlinEntry.data, 'kotlin-type-design');
  const allSkills = loader.getSkills().skills;
  const unrelated = { ...allSkills[0], name: 'unrelated', filePath: path.join(directory, 'unrelated/SKILL.md') };
  const examine = () => session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Design an identifier' },
    { cwd: directory, skills: [...allSkills, unrelated], sections: { existing: 'repository context' } });
  let result = await examine();
  assert.equal(result.systemPromptOptions.sections.existing, 'repository context');
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Engineering Baseline'));
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Kotlin Engineering'));
  assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name).sort(),
    ['kotlin-design-practices', 'kotlin-review', 'negative-capability-proof', 'semantic-ratchet', 'unrelated']);
  await session.prompt('/slopsentral-profile type-design');
  result = await examine();
  assert.ok(result.systemPromptOptions.skills.some(s => s.name === 'openapi-contract-authoring'));
  await session.prompt('/slopsentral-profile unknown');
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('Slopsentral profile: type-design.'));
  session.sessionManager.branch(kotlinEntry.id);
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: kotlinEntry.id, oldLeafId: undefined, fromExtension: true });
  assert.equal((await examine()).systemPromptOptions.skills.some(s => s.name === 'openapi-contract-authoring'), false);
  await session.prompt('/slopsentral-profile off');
  result = await examine();
  assert.equal(result.systemPromptOptions.sections.slopsentral, undefined);
  assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name), ['unrelated']);
  assert.deepEqual(session.getActiveToolNames(), tools);
  await session.prompt('/slopsentral-profile personal-configuration-default');
  assert.ok((await examine()).systemPromptOptions.skills.some(s => s.name === 'python-tooling'));
  assert.deepEqual(errors, []);
});

function fixture(t, hooks, mode = 'ENFORCING') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi native actions ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, 'package');
  fs.mkdirSync(path.join(packagePath, 'extensions'), { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'fixture/hooks'), { recursive: true });
  for (const name of ['slopsentral.ts', 'runtime.ts']) fs.copyFileSync(path.join(root, 'source/hooks/pi', name), path.join(packagePath, 'extensions', name));
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ type: 'module', pi: { extensions: ['./extensions/slopsentral.ts'], skills: [] } }));
  const base = { description: 'Controlled native adapter fixture', skills: [], instructions: [], agents: [], hooks, hookPolicy: mode };
  fs.writeFileSync(path.join(packagePath, 'profiles.json'), JSON.stringify({ schemaVersion: 1, defaultProfile: 'fixture', profiles: [{ name: 'fixture', ...base }, { name: 'second', ...base }] }));
  fs.writeFileSync(path.join(packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(p.cwd!==process.cwd()||!p.session_id)process.exit(3);console.log(JSON.stringify({decision:'block',reason:'controlled rejection'}));`);
  return { directory, packagePath };
}

test('native flag choice persists and remains stable on session restoration', async t => {
  const f = fixture(t, []);
  const { session, errors } = await host(t, f.packagePath, f.directory, 'second');
  assert.equal(session.sessionManager.getBranch().at(-1).data, 'second');
  session.extensionRunner.setFlagValue('slopsentral-profile', 'fixture');
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  assert.equal(session.sessionManager.getBranch().at(-1).data, 'second');
  assert.deepEqual(errors, []);
});

test('invalid native startup and branch selections abort until a valid command repairs state', async t => {
  const f = fixture(t, []);
  const h = await host(t, f.packagePath, f.directory, 'unknown');
  const examine = () => h.session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'probe' }, { cwd: f.directory });
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('UNKNOWN_PROFILE'));
  assert.equal(h.aborts(), 1);
  await h.session.prompt('/slopsentral-profile fixture');
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('Slopsentral profile: fixture.'));
  h.session.sessionManager.appendCustomEntry('slopsentral-profile', 'removed-profile');
  await h.session.extensionRunner.emit({ type: 'session_tree', newLeafId: h.session.sessionManager.getLeafId(), fromExtension: true });
  assert.ok((await examine()).systemPromptOptions.sections.slopsentral.includes('UNKNOWN_PROFILE'));
  assert.equal(h.aborts(), 2);
  assert.deepEqual(h.errors, []);
});

test('native startup rejection aborts each dependent run and preserves its prompt scope', async t => {
  const action = { name: 'gate', event: 'SessionStart', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  const h = await host(t, f.packagePath, f.directory);
  for (let index = 0; index < 2; index++) {
    const result = await h.session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'probe' }, { cwd: f.directory });
    assert.ok(result.systemPromptOptions.sections.slopsentral.includes('Startup hooks failed: gate: BLOCKED'));
  }
  assert.equal(h.aborts(), 2);
  assert.deepEqual(h.errors, []);
});

test('native completion adapter preserves notices and permits only one enforcement continuation', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  session.sessionManager.appendMessage({ role: 'user', content: 'controlled task', timestamp: 0 });
  const dispatch = outcome => session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome }, entries => ({
    contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [],
    canContinue: entries.some(entry => entry.type === 'custom_message'),
  }));
  const first = await dispatch('completed');
  assert.equal(first.valid, true);
  assert.equal(first.continue, true);
  assert.ok(first.entries.some(e => e.type === 'custom_message' && e.content.includes('gate: BLOCKED')));
  for (const entry of first.entries) if (entry.type === 'custom') session.sessionManager.appendCustomEntry(entry.customType, entry.data);
  const second = await dispatch('completed');
  assert.equal(second.continue, false);
  assert.ok(second.entries.some(e => e.type === 'custom_message' && e.content.includes('after one continuation')));
  const aborted = await dispatch('aborted');
  assert.deepEqual(aborted.entries, []);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `console.log(JSON.stringify({systemMessage:'advisory findings: 2'}))`);
  const advisory = await dispatch('completed');
  assert.equal(advisory.continue, false);
  assert.ok(advisory.entries.some(e => e.type === 'custom_message' && e.content.includes('advisory findings: 2')));
  assert.deepEqual(errors, []);
});

test('native prompt and post-tool adapters preserve context and original tool evidence', async t => {
  const hooks = ['UserPromptSubmit', 'PostToolUse', 'Stop'].map(event => ({ name: 'scope', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 }));
  const f = fixture(t, hooks, 'ADVISORY');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(!p.session_id||p.cwd!==process.cwd())process.exit(3); console.log(JSON.stringify(p.hook_event_name==='Stop'?{decision:'block',reason:'Run the scope review command before completion.'}:{hookSpecificOutput:{hookEventName:p.hook_event_name,additionalContext:p.hook_event_name+' scope guidance'}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const input = await session.extensionRunner.emitInput('Examine source changes', undefined, 'interactive');
  assert.deepEqual(input, { action: 'continue' });
  assert.ok(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.content.includes('UserPromptSubmit scope guidance')));
  const original = { type: 'tool_result', toolName: 'custom_probe', toolCallId: 'probe-1', input: {}, content: [{ type: 'text', text: 'Original tool evidence' }], details: { receipt: 7 }, structuredContent: { state: 'recorded' }, isError: true, usage: { input: 1, output: 2 } };
  const result = await session.extensionRunner.emitToolResult(original);
  assert.deepEqual(result.content[0], original.content[0]);
  assert.ok(result.content.some(part => part.type === 'text' && part.text.includes('PostToolUse scope guidance')));
  assert.deepEqual(result.details, original.details);
  assert.deepEqual(result.structuredContent, original.structuredContent);
  assert.equal(result.isError, true);
  assert.deepEqual(result.usage, original.usage);
  const completion = await session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({ contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(e => e.type === 'custom_message') }));
  assert.ok(completion.entries.some(entry => entry.type === 'custom_message' && entry.content.includes('Run the scope review command before completion.')));
  assert.equal(completion.continue, false);
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  await session.prompt('/slopsentral-check');
  assert.ok(notifications.some(message => message.includes('Run the scope review command before completion.')));
  assert.deepEqual(errors, []);
});

test('native prompt hooks receive the current text and input source before any model turn', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:JSON.stringify({prompt:p.prompt,source:p.source})}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const images = [{ type: 'image', data: 'controlled-image', mimeType: 'image/png' }];
  for (const [text, source] of [['Fix Kotlin "quoted" code\n$HOME $(no-command)', 'interactive'], ['A different RPC request', 'rpc']]) {
    assert.deepEqual(await session.extensionRunner.emitInput(text, images, source), { action: 'continue' });
    const entry = session.sessionManager.getBranch().findLast(e => e.type === 'custom_message' && e.customType === 'slopsentral-prompt-hooks');
    assert.deepEqual(JSON.parse(entry.content), { prompt: text, source });
  }
  assert.deepEqual(errors, []);
});
