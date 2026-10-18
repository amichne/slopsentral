import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, createWriteToolDefinition, DefaultResourceLoader, initTheme, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { AssistantMessageEventStream } from '@earendil-works/pi-ai';
import { Input, TuiMainScreen, visibleWidth } from '@earendil-works/pi-tui';
import { tsImport } from 'tsx/esm/api';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');

async function host(t, packagePath, directory, flag, agentDir = path.join(directory, 'agent'), customTools = []) {
  const catalogFile = path.join(packagePath, 'capabilities.json');
  if (!fs.existsSync(catalogFile)) {
    // Controlled fixture actions have no dependencies. Projected packages carry real source edges.
    const config = JSON.parse(fs.readFileSync(path.join(packagePath, 'profiles.json'), 'utf8'));
    const caps = new Map();
    for (const profile of config.profiles) {
      for (const [type, refs] of [['SKILL', profile.skills], ['INSTRUCTION', profile.instructions], ['AGENT', profile.agents]]) for (const ref of refs) {
        const id = `${type.toLowerCase()}:${ref.name}`;
        const previous = caps.get(id);
        caps.set(id, { id, type, name: ref.name, path: ref.path, dependencies: [], profiles: [...new Set([...(previous?.profiles ?? []), profile.name])] });
      }
      for (const action of profile.hooks) {
        const id = `hook:${action.name}`;
        const previous = caps.get(id);
        const actions = [...(previous?.actions ?? [])];
        if (!actions.some(item => JSON.stringify(item) === JSON.stringify(action))) actions.push(action);
        caps.set(id, { id, type: 'HOOK', name: action.name, dependencies: [], profiles: [...new Set([...(previous?.profiles ?? []), profile.name])], actions });
      }
    }
    fs.writeFileSync(catalogFile, JSON.stringify({ schemaVersion: 1, capabilities: [...caps.values()] }));
  }
  const previousHome = process.env.CODEX_HOME;
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir; });
  process.env.CODEX_HOME = path.join(path.dirname(agentDir), 'codex');
  t.after(() => { if (previousHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = previousHome; });
  const settingsManager = SettingsManager.inMemory({ packages: [] });
  fs.mkdirSync(agentDir);
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir, settingsManager,
    additionalExtensionPaths: [packagePath], noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd: directory, agentDir, resourceLoader: loader, modelRuntime,
    settingsManager, sessionManager: SessionManager.inMemory(directory), customTools });
  t.after(() => session.dispose());
  const errors = [];
  let aborts = 0;
  if (flag) session.extensionRunner.setFlagValue('slopsentral-profile', flag);
  await session.bindExtensions({ mode: 'print', onError: error => errors.push(error), abortHandler: () => { aborts++; } });
  return { session, loader, modelRuntime, errors, aborts: () => aborts };
}

async function jsonCommand(session, text) {
  const chunks = [];
  const native = session.extensionRunner.createCommandContext();
  const command = session.extensionRunner.getCommand('slopsentral');
  assert.ok(command);
  await command.handler(text, { ...native, mode: 'rpc', ui: { ...native.ui, notify: message => chunks.push(message) } });
  return JSON.parse(chunks.at(-1));
}

async function until(predicate, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
async function afterJobs(session) {
  const deadline = Date.now() + 5000;
  while (true) {
    const state = await jsonCommand(session, 'state');
    if (!state.jobs.length) return state;
    assert.ok(Date.now() < deadline, 'native background jobs did not finish');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('projected scope hook reports real edits until an explicit review resolves its gate', { skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_PI_PACKAGE }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi scope lifecycle ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cwd = path.join(directory, 'consumer');
  fs.mkdirSync(path.join(cwd, 'module'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'AGENTS.md'), '# Fixture\nThe root instructions own the module.\n');
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'original\n');
  const git = (...args) => execFileSync('git', ['-C', cwd, '-c', 'core.hooksPath=/dev/null', ...args], { encoding: 'utf8' });
  git('init', '--quiet');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '--no-gpg-sign', '-m', 'fixture');
  let packagePath = process.env.SLOPSENTRAL_PI_PACKAGE;
  if (!packagePath) {
    project({ source: root, harness: 'pi', out: path.join(directory, 'projection') });
    packagePath = path.join(directory, 'projection/.pi/slopsentral');
  }
  const { session, errors, aborts } = await host(t, packagePath, cwd, undefined, path.join(directory, 'agent'));
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  const settle = () => session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({
    contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message'),
  }));
  await session.extensionRunner.emitInput('Examine the fixture.', undefined, 'interactive');
  assert.deepEqual((await settle()).entries, []);
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'edit-1', args: { path: 'module/main.py' } });
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'changed-source-must-stay-private\n');
  const original = { type: 'tool_result', toolName: 'write', toolCallId: 'edit-1', input: { path: 'module/main.py' }, content: [{ type: 'text', text: 'Native edit receipt' }], details: { receipt: 1 }, structuredContent: { saved: true }, isError: false, usage: { input: 1, output: 1 } };
  const recorded = await session.extensionRunner.emitToolResult(original) ?? original;
  assert.deepEqual(recorded, original);
  assert.deepEqual((await settle()).entries, []);
  await session.extensionRunner.emit({ type: 'agent_settled', aborted: false });
  await until(() => notifications.some(message => message.includes('module/main.py')), 'scope assessment');
  assert.equal(JSON.stringify(notifications).includes('changed-source-must-stay-private'), false);
  const journal = () => session.sessionManager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === 'slopsentral-mutations').data;
  assert.deepEqual(journal().pending, ['module/main.py']);
  assert.equal(journal().assessedRevision, journal().revision);
  await session.prompt('/slopsentral-check');
  assert.ok(notifications.some(message => message.includes('Pending scope review')));
  await session.prompt('/slopsentral review The root instructions still describe the module.');
  assert.deepEqual(journal().pending, []);
  await session.prompt('/slopsentral-profile off');
  await session.extensionRunner.emit({ type: 'tool_execution_start', toolName: 'write', toolCallId: 'edit-2', args: { path: 'module/main.py' } });
  fs.writeFileSync(path.join(cwd, 'module/main.py'), 'changed while off\n');
  assert.equal(await session.extensionRunner.emitToolResult(original), undefined);
  assert.deepEqual(journal().pending, ['module/main.py'], 'disabled assessment preserves mutation evidence');
  assert.equal(fs.existsSync(path.join(process.env.CODEX_HOME, 'state/agents-md-scope')), false);
  assert.equal(aborts(), 0);
  assert.deepEqual(errors, []);
});

test('Pi native loader dispatches profile commands, prompt sections, and branch restoration without a provider', { skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_PI_PACKAGE }, async t => {
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
  await session.extensionRunner.emitInput('Implement Kotlin tests, prove invariants, and open a pull request', undefined, 'interactive');
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.customType === 'slopsentral-guidance'), false);
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
  await session.prompt('/slopsentral-profile documentation-default');
  for (const prompt of ['test', 'What does the word test mean?', 'Please do not publish or push anything.',
    'Write an assertion for this behavior', 'Add regression coverage for this behavior']) {
    await session.extensionRunner.emitInput(prompt, undefined, 'interactive');
    const scoped = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt }, { cwd: directory, skills: allSkills });
    assert.ok(scoped.systemPromptOptions.skills.some(s => s.name === 'technical-documentation'));
    assert.equal(scoped.systemPromptOptions.skills.some(s => s.name === 'tdd'), false);
    assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message' && entry.customType === 'slopsentral-guidance'), false);
  }
  assert.deepEqual(errors, []);
});

function fixture(t, hooks, mode = 'ENFORCING') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi native actions ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, 'package');
  fs.mkdirSync(path.join(packagePath, 'extensions'), { recursive: true });
  fs.mkdirSync(path.join(packagePath, 'fixture/hooks'), { recursive: true });
  const adapters = process.env.SLOPSENTRAL_PI_PACKAGE ? path.join(process.env.SLOPSENTRAL_PI_PACKAGE, 'extensions') : path.join(root, 'source/hooks/pi');
  for (const name of fs.readdirSync(adapters).filter(name => name.endsWith('.ts'))) fs.copyFileSync(path.join(adapters, name), path.join(packagePath, 'extensions', name));
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ type: 'module', pi: { extensions: ['./extensions/slopsentral.ts'], skills: [] } }));
  const base = { description: 'Controlled native adapter fixture', skills: [], instructions: [], agents: [], hooks, hookPolicy: mode };
  fs.writeFileSync(path.join(packagePath, 'profiles.json'), JSON.stringify({ schemaVersion: 1, defaultProfile: 'fixture', profiles: [{ name: 'fixture', ...base }, { name: 'second', ...base }] }));
  fs.writeFileSync(path.join(packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(p.cwd!==process.cwd()||!p.session_id)process.exit(3);console.log(JSON.stringify({decision:'block',reason:'controlled rejection'}));`);
  return { directory, packagePath };
}

async function nativeTools(session, modelRuntime, calls) {
  const model = modelRuntime.getModels('openai')[0];
  assert.ok(model, 'the bundled model catalog supplies a fixture identity');
  await modelRuntime.setRuntimeApiKey('openai', 'isolated-fixture-key');
  await session.setModel(model);
  let turn = 0;
  session.agent.streamFunction = () => {
    const content = turn++ === 0 ? calls.map((call, index) => ({ type: 'toolCall', id: `native-${index}`, name: call.name, arguments: call.args }))
      : [{ type: 'text', text: 'Fixture complete.' }];
    const message = { role: 'assistant', content, api: model.api, provider: model.provider, model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: turn === 1 ? 'toolUse' : 'stop', timestamp: Date.now() };
    const stream = new AssistantMessageEventStream();
    stream.push({ type: 'done', reason: message.stopReason, message });
    stream.end();
    return stream;
  };
  await session.prompt('Apply the exact fixture tool calls.');
}

test('native mutation path batches first-run edits with zero per-tool subprocesses and no Git', { timeout: 15000 }, async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: ['uv', 'run', '--locked', '--script', 'hooks/agents-md-scope.py'], timeout: 5 };
  const f = fixture(t, ['UserPromptSubmit', 'PostToolUse', 'Stop'].map(event => ({ ...action, event })), 'ADVISORY');
  fs.copyFileSync(path.join(root, 'source/hooks/agents-md-scope.py'), path.join(f.packagePath, 'fixture/hooks/agents-md-scope.py'));
  fs.copyFileSync(path.join(root, 'source/hooks/agents-md-scope.py.lock'), path.join(f.packagePath, 'fixture/hooks/agents-md-scope.py.lock'));
  fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Use fixture rules.\n');
  const bin = path.join(f.directory, 'bin'); fs.mkdirSync(bin);
  const gitLedger = path.join(f.directory, 'git-called');
  const hookLedger = path.join(f.directory, 'hook-called');
  const realUv = execFileSync('which', ['uv'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\necho called >> '${gitLedger}'\nexit 99\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'uv'), `#!/bin/sh\necho called >> '${hookLedger}'\nexec '${realUv}' "$@"\n`, { mode: 0o755 });
  const previousPath = process.env.PATH;
  process.env.PATH = bin + path.delimiter + previousPath;
  t.after(() => { process.env.PATH = previousPath; });
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  const countsDuringTools = [];
  session.subscribe(event => { if (event.type === 'tool_execution_end') countsDuringTools.push(fs.existsSync(hookLedger) ? fs.readFileSync(hookLedger, 'utf8').trim().split('\n').length : 0); });
  await nativeTools(session, modelRuntime, [
    { name: 'write', args: { path: 'module/new.py', content: 'first\n' } },
    { name: 'edit', args: { path: 'module/new.py', oldText: 'first', newText: 'second' } },
  ]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'module/new.py'), 'utf8'), 'second\n');
  assert.deepEqual(countsDuringTools, [0, 0]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('background assessment did not deliver')), 5000);
    const poll = () => notices.some(message => message.includes('module/new.py')) ? (clearTimeout(timer), resolve()) : setTimeout(poll, 10);
    poll();
  });
  assert.equal(fs.readFileSync(hookLedger, 'utf8').trim().split('\n').length, 1);
  assert.equal(fs.existsSync(gitLedger), false);
  const state = session.sessionManager.getBranch().findLast(entry => entry.type === 'custom' && entry.customType === 'slopsentral-mutations');
  assert.deepEqual(state.data.pending, ['module/new.py']);
  assert.deepEqual(errors, []);
});

test('native flag choice persists and remains stable on session restoration', async t => {
  const f = fixture(t, []);
  const { session, errors } = await host(t, f.packagePath, f.directory, 'second');
  assert.equal(session.sessionManager.getBranch().at(-1).data, 'second');
  session.extensionRunner.setFlagValue('slopsentral-profile', 'fixture');
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  assert.equal(session.sessionManager.getBranch().at(-1).data, 'second');
  assert.deepEqual(errors, []);
});

test('native hook policies distinguish disabled, advisory, and enforcing failures across each event', async t => {
  for (const mode of ['OFF', 'ADVISORY', 'ENFORCING']) await t.test(mode, async t => {
    const hooks = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'].map(event => ({
      name: 'gate', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2,
      ...(event === 'PreToolUse' ? { matcher: '^read_file$' } : {}),
    }));
    const f = fixture(t, hooks, mode);
    const ledger = path.join(f.directory, 'events.jsonl');
    fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); fs.appendFileSync(${JSON.stringify(ledger)},p.hook_event_name+'\\n'); console.log(JSON.stringify({decision:'block',reason:'controlled '+p.hook_event_name+' rejection'}));`);
    const { session, errors, aborts } = await host(t, f.packagePath, f.directory);
    const notifications = [];
    session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
    session.sessionManager.appendMessage({ role: 'user', content: 'Examine the fixture.', timestamp: 0 });
    await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine the fixture.' }, { cwd: f.directory });
    assert.deepEqual(await session.extensionRunner.emitInput('Examine the fixture.', undefined, 'rpc'), { action: mode === 'ENFORCING' ? 'handled' : 'continue' });
    const call = { type: 'tool_call', toolName: 'read', toolCallId: 'read-1', input: { path: 'fixture.txt' } };
    assert.equal(await session.extensionRunner.emitToolCall({ ...call, toolName: 'write' }), undefined, 'an unmatched tool must not run the gate');
    const permission = await session.extensionRunner.emitToolCall(call);
    if (mode === 'ENFORCING') {
      assert.equal(permission.block, true);
      assert.match(permission.reason, /controlled PreToolUse rejection/);
    } else assert.equal(permission, undefined);
    const original = { type: 'tool_result', toolName: 'read', toolCallId: 'read-1', input: {}, content: [{ type: 'text', text: 'original evidence' }], details: { receipt: 1 }, isError: false };
    const result = await session.extensionRunner.emitToolResult(original);
    assert.equal(result, undefined, 'hook context preserves the original visible receipt');
    if (mode !== 'OFF') assert.ok((await session.extensionRunner.emitContext([])).some(message => message.customType === 'slopsentral-tool-hooks' && message.content.includes('controlled PostToolUse rejection')));
    assert.equal(aborts(), mode === 'ENFORCING' ? 1 : 0);
    const settle = await session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({
      contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message'),
    }));
    assert.equal(settle.continue, mode === 'ENFORCING');
    if (mode === 'OFF') assert.deepEqual(settle.entries, []);
    else assert.ok(settle.entries.some(entry => entry.type === 'custom_message' && entry.content.includes('controlled Stop rejection')));
    const events = () => fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8').trim().split('\n') : [];
    assert.deepEqual(events(), mode === 'OFF' ? [] : ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']);
    const prior = notifications.length;
    await session.prompt('/slopsentral-check');
    assert.equal(events().at(-1), 'Stop', 'explicit gates must also run with the OFF policy');
    assert.ok(notifications.slice(prior).some(message => message.includes('controlled Stop rejection')));
    assert.deepEqual(errors, []);
  });
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
  await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine source changes' }, { cwd: f.directory });
  assert.ok((await session.extensionRunner.emitContext([])).some(message => message.content.includes('UserPromptSubmit scope guidance')));
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom_message'), false);
  const original = { type: 'tool_result', toolName: 'custom_probe', toolCallId: 'probe-1', input: {}, content: [{ type: 'text', text: 'Original tool evidence' }], details: { receipt: 7 }, structuredContent: { state: 'recorded' }, isError: true, usage: { input: 1, output: 2 } };
  const result = await session.extensionRunner.emitToolResult(original) ?? original;
  assert.deepEqual(result.content, original.content);
  assert.ok((await session.extensionRunner.emitContext([])).some(message => message.customType === 'slopsentral-tool-hooks' && message.content.includes('PostToolUse scope guidance')));
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
  for (const [text, source] of [['Fix Kotlin "quoted" code\n$HOME $(no-command)', 'interactive'], ['A different RPC request', 'rpc'], ['An extension-supplied message', 'extension']]) {
    assert.deepEqual(await session.extensionRunner.emitInput(text, images, source), { action: 'continue' });
    await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: text, images }, { cwd: f.directory });
    const entry = (await session.extensionRunner.emitContext([])).find(e => e.role === 'custom' && e.customType === 'slopsentral-prompt-hooks');
    assert.deepEqual(JSON.parse(entry.content), { prompt: text, source });
  }
  assert.deepEqual(errors, []);
});

test('native session shutdown cancels an active manual gate without a continuation', { skip: process.platform === 'win32', timeout: 15000 }, async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 30 };
  const f = fixture(t, [action]);
  const pidPath = path.join(f.directory, 'ready');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';process.on('SIGTERM',()=>{});fs.writeFileSync(${JSON.stringify(pidPath + '.tmp')},String(process.pid));fs.renameSync(${JSON.stringify(pidPath + '.tmp')},${JSON.stringify(pidPath)});setInterval(()=>{},1000);`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const notifications = [];
  session.extensionRunner.setUIContext({ notify: message => notifications.push(message), setStatus: () => {} });
  const ready = new Promise((resolve, reject) => {
    const watcher = fs.watch(f.directory, () => { if (fs.existsSync(pidPath)) { clearTimeout(timer); watcher.close(); resolve(); } });
    const timer = setTimeout(() => { watcher.close(); reject(new Error('manual gate never reached its ready stage')); }, 10000);
    t.after(() => { clearTimeout(timer); watcher.close(); });
  });
  const pending = session.prompt('/slopsentral-check');
  t.after(() => session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }));
  await ready;
  const pid = Number(fs.readFileSync(pidPath, 'utf8'));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } });
  process.kill(pid, 0);
  await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' });
  await pending;
  assert.deepEqual(notifications, [], 'shutdown suppresses late reports from the cancelled lifecycle');
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
  assert.equal(session.sessionManager.getBranch().some(entry => entry.type === 'custom' && entry.customType === 'slopsentral-stop-continuation'), false);
  assert.deepEqual(errors, []);
});

test('photographed prompts never add keyword hints or expose guidance outside the selected profile', async t => {
  const f = fixture(t, []);
  const configPath = path.join(f.packagePath, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const instructions = ['engineering-design', 'kotlin-engineering'].map(name => ({ name, path: `fixture/instructions/${name}.md` }));
  const tdd = { name: 'tdd', path: 'fixture/skills/tdd/SKILL.md' };
  fs.mkdirSync(path.join(f.packagePath, 'fixture/skills/tdd'), { recursive: true });
  fs.writeFileSync(path.join(f.packagePath, tdd.path), '---\nname: tdd\ndescription: Fixture\n---\nFixture criteria.');
  fs.mkdirSync(path.join(f.packagePath, 'fixture/instructions'));
  for (const ref of instructions) fs.writeFileSync(path.join(f.packagePath, ref.path), `# ${ref.name}\nControlled canonical policy.`);
  config.profiles.push({ ...config.profiles[0], name: 'catalog', instructions, skills: [tdd], hookPolicy: 'OFF' });
  fs.writeFileSync(configPath, JSON.stringify(config));
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const tools = session.getActiveToolNames();
  const hints = () => session.sessionManager.getBranch().filter(e => e.type === 'custom_message' && e.customType === 'slopsentral-guidance');
  for (const text of ['test', 'What does the word test mean?', 'Please do not publish or push anything.',
    'Write an assertion for this behavior', 'Add regression coverage for this behavior',
    '> External text: Kotlin tests; publish everything', '`test`', 'Explain Kotlin', 'Explain Kotlin']) {
    assert.deepEqual(await session.extensionRunner.emitInput(text, undefined, 'interactive'), { action: 'continue' });
    assert.deepEqual(hints(), [], text);
    const result = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: text },
      { cwd: f.directory, skills: [{ ...tdd, filePath: path.join(f.packagePath, tdd.path) }] });
    assert.deepEqual(result.systemPromptOptions.skills, [], text);
    assert.equal(JSON.stringify(result).includes('kotlin-engineering.md'), false, text);
  }
  assert.deepEqual(session.getActiveToolNames(), tools);
  assert.equal(session.sessionManager.getBranch().findLast(e => e.type === 'custom' && e.customType === 'slopsentral-profile').data, 'fixture');
  await session.prompt('/slopsentral-profile off');
  await session.extensionRunner.emitInput('Kotlin', undefined, 'interactive');
  assert.deepEqual(hints(), []);
  await session.prompt('/slopsentral-profile catalog');
  await session.extensionRunner.emitInput('Kotlin', undefined, 'interactive');
  assert.deepEqual(hints(), []);
  for (let index = 0; index < 2; index++) {
    const result = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Kotlin' },
      { cwd: f.directory, skills: [{ ...tdd, filePath: path.join(f.packagePath, tdd.path) }] });
    assert.equal(result.systemPromptOptions.sections.slopsentral.split('# engineering-design').length, 2);
    assert.deepEqual(result.systemPromptOptions.skills.map(s => s.name), ['tdd']);
  }
  assert.deepEqual(errors, []);
});

test('accepted prompt context reaches one native run without persistent or rejected-input hints', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify(p.prompt==='reject test'?{decision:'block',reason:'controlled rejection'}:{hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'accepted context: '+p.prompt}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const runner = session.extensionRunner;
  const start = prompt => runner.emitBeforeAgentStart({ messageType: 'user', prompt }, { cwd: f.directory });
  const user = { role: 'user', content: 'original user evidence', timestamp: 1 };
  const context = () => runner.emitContext([user]);
  const entries = () => session.sessionManager.getBranch().filter(e => e.type === 'custom_message');
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(await runner.emitInput('accept test', undefined, 'rpc'), { action: 'continue' });
    await start('accept test');
    const messages = await context();
    assert.deepEqual(messages[0], user);
    assert.equal(messages.length, 2);
    assert.equal(messages[1].content, 'accepted context: accept test');
    assert.deepEqual(entries(), []);
  }
  await runner.emit({ type: 'agent_settled', messages: [] });
  assert.deepEqual(await context(), [user]);
  assert.deepEqual(await runner.emitInput('reject test', undefined, 'rpc'), { action: 'handled' });
  await start('reject test');
  assert.deepEqual(await context(), [user]);
  assert.deepEqual(entries(), []);
  for (const reset of [
    () => session.prompt('/slopsentral-profile second'),
    () => runner.emit({ type: 'session_start', reason: 'resume' }),
    () => runner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true }),
  ]) {
    await runner.emitInput('accept test', undefined, 'interactive');
    await reset();
    await start('accept test');
    assert.deepEqual(await context(), [user]);
  }
  await runner.emitInput('accept test', undefined, 'interactive');
  await start('different prompt after another extension');
  assert.deepEqual(await context(), [user]);
  const legacy = ['slopsentral-guidance', 'slopsentral-prompt-hooks'].map(customType => ({ role: 'custom', customType, content: 'legacy hidden hint', display: false, timestamp: 1 }));
  const unrelated = { ...legacy[0], customType: 'unrelated-extension' };
  assert.deepEqual(await runner.emitContext([...legacy, user, unrelated]), [user, unrelated]);
  assert.deepEqual(errors, []);
});

test('session restoration during a native prompt hook rejects its late context', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(ready)},'ready'); const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'UserPromptSubmit',additionalContext:'stale context'}}));}},10);`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const entered = new Promise((resolve, reject) => {
    const watcher = fs.watch(f.directory, () => { if (fs.existsSync(ready)) { clearTimeout(timer); watcher.close(); resolve(); } });
    const timer = setTimeout(() => { watcher.close(); reject(new Error('prompt hook did not start')); }, 3000);
    t.after(() => { clearTimeout(timer); watcher.close(); });
  });
  const pending = session.extensionRunner.emitInput('accept', undefined, 'rpc');
  await entered;
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true });
  fs.writeFileSync(release, 'release');
  assert.deepEqual(await pending, { action: 'handled' });
  await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'accept' }, { cwd: f.directory });
  assert.deepEqual(await session.extensionRunner.emitContext([]), []);
  assert.deepEqual(errors, []);
});

test('session restoration during native startup cannot restore accepted prompt context', async t => {
  const actions = ['UserPromptSubmit', 'SessionStart'].map(event => ({ name: 'gate', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 }));
  const f = fixture(t, actions);
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));if(p.hook_event_name==='UserPromptSubmit'){console.log(JSON.stringify({hookSpecificOutput:{hookEventName:p.hook_event_name,additionalContext:'stale accepted context'}}));}else{fs.writeFileSync(${JSON.stringify(ready)},'ready');const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log('{}');}},10);}`);
  const { session, errors, aborts } = await host(t, f.packagePath, f.directory);
  await session.extensionRunner.emitInput('accept', undefined, 'rpc');
  const entered = new Promise((resolve, reject) => {
    const watcher = fs.watch(f.directory, () => { if (fs.existsSync(ready)) { clearTimeout(timer); watcher.close(); resolve(); } });
    const timer = setTimeout(() => { watcher.close(); reject(new Error('startup hook did not start')); }, 3000);
    t.after(() => { clearTimeout(timer); watcher.close(); });
  });
  const pending = session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'accept' }, { cwd: f.directory });
  await entered;
  await session.extensionRunner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true });
  fs.writeFileSync(release, 'release');
  await pending;
  assert.deepEqual(await session.extensionRunner.emitContext([]), []);
  assert.equal(aborts(), 1);
  assert.deepEqual(errors, []);
});

test('native steering and follow-up keep context until the accepted input reaches a request', async t => {
  const action = { name: 'prompt', event: 'UserPromptSubmit', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 2 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({hookSpecificOutput:{hookEventName:p.hook_event_name,additionalContext:'context for '+p.prompt}}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const runner = session.extensionRunner;
  const original = { role: 'user', content: 'original', timestamp: 1 };
  await runner.emitInput('original', undefined, 'rpc');
  session.sessionManager.appendMessage(original);
  await runner.emitBeforeAgentStart({ messageType: 'user', prompt: 'original' }, { cwd: f.directory });
  let messages = [original];
  let expected = 'context for original';
  for (const method of ['steer', 'followUp']) {
    assert.equal(await session[method]('queued '+method, undefined, { source: 'rpc' }), 'queued');
    assert.equal((await runner.emitContext(messages)).at(-1).content, expected, 'a queued input must not erase or precede active context');
    const delivered = { role: 'user', content: 'queued '+method, timestamp: 2 };
    session.sessionManager.appendMessage(delivered);
    messages = [...messages, delivered];
    expected = 'context for queued '+method;
    assert.equal((await runner.emitContext(messages)).at(-1).content, expected);
    assert.equal(session.sessionManager.getBranch().some(e => e.type === 'custom_message'), false);
  }
  assert.deepEqual(errors, []);
});

test('failed native write preserves changed instructions, review obligations, and original error', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: ['uv', 'run', '--locked', '--script', 'hooks/agents-md-scope.py'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  for (const name of ['agents-md-scope.py', 'agents-md-scope.py.lock']) fs.copyFileSync(path.join(root, 'source/hooks', name), path.join(f.packagePath, 'fixture/hooks', name));
  const writer = createWriteToolDefinition(f.directory, { operations: {
    mkdir: async directory => fs.mkdirSync(directory, { recursive: true }),
    writeFile: async (file, content) => { fs.writeFileSync(file, content); throw new Error('Fixture failure after mutation'); },
  } });
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory, undefined, path.join(f.directory, 'agent'), [writer]);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'AGENTS.md', content: 'Use the changed fixture command.\n' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'AGENTS.md'), 'utf8'), 'Use the changed fixture command.\n');
  const result = session.messages.findLast(message => message.role === 'toolResult');
  assert.equal(result.isError, true);
  assert.ok(result.content.some(part => part.text?.includes('Fixture failure after mutation')));
  assert.ok(result.content.some(part => part.text?.includes('Current instructions from "AGENTS.md"') && part.text.includes('Use the changed fixture command.')));
  await until(() => notices.some(message => message.includes('scope review')), 'failed mutation assessment');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['AGENTS.md']);
  assert.equal(state.journal.assessedRevision, state.journal.revision);
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  assert.deepEqual((await jsonCommand(session, 'state')).journal.pending, ['AGENTS.md']);
  assert.deepEqual(errors, []);
});

test('native nested calls and explicit mutation adapters preserve instruction deletion evidence', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: ['uv', 'run', '--locked', '--script', 'hooks/agents-md-scope.py'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  for (const name of ['agents-md-scope.py', 'agents-md-scope.py.lock']) fs.copyFileSync(path.join(root, 'source/hooks', name), path.join(f.packagePath, 'fixture/hooks', name));
  const { Type } = await import('typebox');
  const parameters = Type.Object({ path: Type.String() });
  const tools = [
    { name: 'erase', label: 'erase', description: 'Fixture removal', parameters,
      execute: async (_id, args) => { fs.unlinkSync(path.join(f.directory, args.path)); throw new Error('Fixture failure after deletion'); } },
    { name: 'nested', label: 'nested', description: 'Fixture nested write', parameters,
      execute: async (_id, args, signal, _update, ctx) => ctx.executeTool('write', { path: args.path, content: 'nested source\n' }, { signal }) },
  ];
  fs.mkdirSync(path.join(f.directory, 'module'));
  fs.writeFileSync(path.join(f.directory, 'AGENTS.md'), 'Use root rules.\n');
  fs.writeFileSync(path.join(f.directory, 'module/AGENTS.md'), 'Use module rules.\n');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory, undefined, path.join(f.directory, 'agent'), tools);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"mutationAdapters":{"erase":["path"],"nested":["path"]}}')).type, 'saved');
  await nativeTools(session, modelRuntime, [
    { name: 'nested', args: { path: 'module/new.py' } },
    { name: 'erase', args: { path: 'module/AGENTS.md' } },
  ]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'module/new.py'), 'utf8'), 'nested source\n');
  assert.equal(fs.existsSync(path.join(f.directory, 'module/AGENTS.md')), false);
  const deletion = session.messages.find(message => message.role === 'toolResult' && message.toolName === 'erase');
  assert.equal(deletion.isError, true);
  assert.ok(deletion.content.some(part => part.text?.includes('was deleted')));
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['module/AGENTS.md', 'module/new.py']);
  assert.deepEqual(state.journal.gaps, []);
  assert.deepEqual(errors, []);
});

test('read-only native runs launch no scope process and shell changes expose a coverage gap', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  const ledger = path.join(f.directory, 'calls');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(ledger)},'ran\n');console.log('{}');`);
  fs.writeFileSync(path.join(f.directory, 'read.txt'), 'fixture');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  await nativeTools(session, modelRuntime, [{ name: 'read', args: { path: 'read.txt' } }]);
  assert.equal(fs.existsSync(ledger), false);
  await nativeTools(session, modelRuntime, [{ name: 'bash', args: { command: "printf 'fixture' > shell-file.txt" } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'shell-file.txt'), 'utf8'), 'fixture');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, []);
  assert.ok(state.journal.gaps.includes('UNSUPPORTED_TOOL: bash'));
  assert.ok(state.coverage[0].includes('external edits'));
  assert.deepEqual(errors, []);
});

function barrierHook(f) {
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  const exited = path.join(f.directory, 'exited');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);fs.writeFileSync(${JSON.stringify(exited)},'completed');console.log(JSON.stringify({systemMessage:'barrier released'}));}},5);`);
  return { ready, release, exited };
}

test('native background hooks do not delay settlement or lose distinct prompt obligations', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  const barrier = barrierHook(f);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"report","output":{"type":"ALWAYS"},"context":"none"}}}')).type, 'saved');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'first.txt', content: 'first' } }]);
  await until(() => fs.existsSync(barrier.ready), 'background admission');
  assert.equal(fs.existsSync(barrier.exited), false, 'the first native run returned before release');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'second.txt', content: 'second' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'second.txt'), 'utf8'), 'second');
  assert.equal(fs.existsSync(barrier.exited), false, 'the second native run also returned before release');
  assert.equal((await jsonCommand(session, 'state')).jobs.length, 2);
  fs.writeFileSync(barrier.release, 'release');
  await until(() => notices.filter(message => message.includes('barrier released')).length === 2, 'both background deliveries');
  assert.equal((await afterJobs(session)).recent.length, 2);
  assert.deepEqual(errors, []);
});

for (const transition of ['configuration', 'session-tree', 'external-branch', 'cancellation']) test(`native background results cannot cross ${transition}`, async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  if (transition === 'external-branch') { fs.mkdirSync(path.join(f.directory, '.git')); fs.writeFileSync(path.join(f.directory, '.git/HEAD'), 'ref: refs/heads/first\n'); }
  const barrier = barrierHook(f);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"report","output":{"type":"ALWAYS"},"context":"none"}}}');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'pending.txt', content: 'pending' } }]);
  await until(() => fs.existsSync(barrier.ready), 'background barrier');
  const pid = Number(fs.readFileSync(barrier.ready, 'utf8'));
  if (transition === 'configuration') await jsonCommand(session, 'set session {"schemaVersion":1,"capabilities":{"hook:gate":false}}');
  if (transition === 'session-tree') await session.extensionRunner.emit({ type: 'session_tree', newLeafId: session.sessionManager.getLeafId(), fromExtension: true });
  if (transition === 'external-branch') fs.writeFileSync(path.join(f.directory, '.git/HEAD'), 'ref: refs/heads/other\n');
  if (transition === 'cancellation') {
    const key = (await jsonCommand(session, 'state')).jobs[0];
    assert.ok(key);
    assert.equal((await jsonCommand(session, `cancel ${key}`)).type, 'cancellation-requested');
  }
  fs.writeFileSync(barrier.release, 'release');
  await until(() => { try { process.kill(pid, 0); return false; } catch (error) { if (error.code !== 'ESRCH') throw error; return true; } }, 'stale job exit');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['pending.txt']);
  assert.deepEqual(state.recent, []);
  assert.equal(notices.some(message => message.includes('barrier released')), false);
  assert.deepEqual(errors, []);
});

test('native SettingsList saves a hook toggle, restores the branch, and changes real tool permission', async t => {
  const action = { name: 'gate', event: 'PreToolUse', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], matcher: '^write$', timeout: 5 };
  const f = fixture(t, [action]);
  const configFile = path.join(f.packagePath, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.profiles[0].instructions.push({ name: 'missing', path: 'fixture/missing.md' });
  fs.writeFileSync(configFile, JSON.stringify(config));
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const importedTerminal = await tsImport('./fixtures/pi-virtual-terminal.ts', import.meta.url);
  const { VirtualTerminal } = importedTerminal.default ?? importedTerminal;
  initTheme('dark');
  const terminal = new VirtualTerminal(60, 18);
  const tui = new TuiMainScreen(terminal, true);
  const editor = new Input();
  tui.addChild(editor); tui.setFocus(editor); tui.start();
  t.after(() => tui.stop());
  let component;
  let closed = false;
  const ui = session.extensionRunner.createCommandContext().ui;
  session.extensionRunner.setUIContext({ ...ui, notify: () => {}, setStatus: () => {}, custom: factory => new Promise(resolve => {
    component = factory(tui, ui.theme, {}, value => {
      tui.removeChild(component); tui.addChild(editor); tui.setFocus(editor); tui.requestRender(); closed = true; resolve(value);
    });
    tui.removeChild(editor); tui.addChild(component); tui.setFocus(component); tui.requestRender();
  }) }, 'tui');
  const pending = session.prompt('/slopsentral');
  await until(() => component !== undefined, 'native menu');
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('Save scope')));
  terminal.sendInput('\x1b[B'); terminal.sendInput('\r'); // Save scope: session -> project.
  for (const character of 'Hooks') terminal.sendInput(character);
  terminal.sendInput('\r'); // Open the hook picker.
  terminal.sendInput('\r'); // Configure gate.
  terminal.sendInput('\r'); // Enabled: on -> off.
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('off')));
  const saved = JSON.parse(fs.readFileSync(path.join(f.directory, '.pi/slopsentral.json'), 'utf8'));
  assert.deepEqual(saved.capabilities, { 'hook:gate': false });
  for (const character of 'Execution') terminal.sendInput(character);
  terminal.sendInput('\r');
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('INVALID_SETTINGS')));
  terminal.sendInput('\x15');
  for (const character of 'Exclude regex') terminal.sendInput(character);
  terminal.sendInput('\r'); terminal.sendInput('['); terminal.sendInput('\r');
  await terminal.waitForRender();
  assert.ok(terminal.getViewport().some(line => line.includes('INVALID_SETTINGS')));
  terminal.sendInput('\x15'); terminal.sendInput('^benign:'); terminal.sendInput('\r');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.directory, '.pi/slopsentral.json'), 'utf8')).hooks['hook:gate'].output.pattern, '^benign:');
  terminal.sendInput('\x15');
  terminal.resize(26, 10); tui.requestRender();
  await terminal.waitForRender();
  for (const line of component.render(26)) assert.ok(visibleWidth(line) <= 26);
  terminal.sendInput('\x1b'); // Return to hook picker.
  terminal.sendInput('\x1b'); // Return to main menu.
  terminal.sendInput('\x1b'); // Close the main menu with its search intact.
  await pending;
  assert.equal(closed, true);
  terminal.sendInput('restored-focus');
  assert.equal(editor.getValue(), 'restored-focus');
  await session.extensionRunner.emit({ type: 'session_start', reason: 'resume' });
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'allowed.txt', content: 'allowed' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'allowed.txt'), 'utf8'), 'allowed');
  session.extensionRunner.setUIContext({ notify: () => {}, setStatus: () => {} }, 'print');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'hook:gate').origin, 'project');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:missing').state, 'unavailable');
  assert.equal((await jsonCommand(session, 'set project {"schemaVersion":1,"capabilities":{"hook:gate":true}}')).type, 'saved');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'blocked.txt', content: 'must not appear' } }]);
  assert.equal(fs.existsSync(path.join(f.directory, 'blocked.txt')), false);
  assert.equal(session.messages.findLast(message => message.role === 'toolResult').isError, true);
  assert.deepEqual(errors, []);
});

test('output suppression preserves blocking decisions and routes structured context outside the tool receipt', async t => {
  const hooks = ['PreToolUse', 'PostToolUse', 'Stop'].map(event => ({ name: 'gate', event, plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 }));
  const f = fixture(t, hooks);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(p.hook_event_name==='PostToolUse'?{hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:'private hook context'}}:{decision:'block',reason:'controlled denial'}));`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"foreground","critical":"blocking","output":{"type":"NEVER"},"context":"structured"}}}');
  const call = { type: 'tool_call', toolName: 'write', toolCallId: 'hidden-1', input: { path: 'file.txt' } };
  assert.equal((await session.extensionRunner.emitToolCall(call)).block, true);
  const original = { type: 'tool_result', toolName: 'write', toolCallId: 'hidden-1', input: call.input, content: [{ type: 'text', text: 'original evidence' }], details: { receipt: 1 }, isError: false, structuredContent: { original: true } };
  const result = await session.extensionRunner.emitToolResult(original) ?? original;
  assert.deepEqual(result, original, 'hidden hook output must not enter a visible native receipt');
  assert.ok((await session.extensionRunner.emitContext([])).some(message => message.customType === 'slopsentral-tool-hooks' && message.content.includes('private hook context')));
  session.sessionManager.appendMessage({ role: 'user', content: 'fixture', timestamp: 0 });
  const settled = await session.extensionRunner.emitBoundary({ type: 'agent_before_settle', outcome: 'completed' }, entries => ({ contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: entries.some(entry => entry.type === 'custom_message') }));
  assert.equal(settled.continue, true);
  assert.equal(settled.entries.some(entry => entry.type === 'custom_message' && entry.display === true), false);
  assert.deepEqual(notices, []);
  assert.deepEqual(errors, []);
});

test('external settings changes invalidate jobs and malformed settings keep the last accepted gates', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  const barrier = barrierHook(f);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"report","output":{"type":"ALWAYS"},"context":"none"}}}');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'changed.txt', content: 'changed' } }]);
  await until(() => fs.existsSync(barrier.ready), 'external setting barrier');
  const projectFile = path.join(f.directory, '.pi/slopsentral.json');
  fs.mkdirSync(path.dirname(projectFile), { recursive: true });
  fs.writeFileSync(projectFile, JSON.stringify({ schemaVersion: 1, capabilities: { 'hook:gate': false } }));
  fs.writeFileSync(barrier.release, 'release');
  await until(() => fs.existsSync(barrier.exited), 'old process completion');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'hook:gate').state, 'disabled');
  assert.equal(notices.some(message => message.includes('barrier released')), false);
  fs.writeFileSync(projectFile, '{broken');
  assert.equal((await jsonCommand(session, 'state')).effective.capabilities.find(item => item.capability.id === 'hook:gate').state, 'disabled');
  assert.ok((await jsonCommand(session, 'state')).errors.some(message => message.includes('project:')));
  assert.equal((await jsonCommand(session, 'set project {"schemaVersion":1}')).type, 'saved');
  assert.deepEqual((await jsonCommand(session, 'state')).errors, []);
  assert.deepEqual(errors, []);
});

test('scope snapshots preserve later edits while a background assessment finishes', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 10 };
  const f = fixture(t, [action], 'ADVISORY');
  const ready = path.join(f.directory, 'ready');
  const release = path.join(f.directory, 'release');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(timer);console.log(JSON.stringify({decision:'block',assessment:'ASSESSED',reason:JSON.stringify(p.changed_paths)}));}},5);`);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const notices = [];
  session.extensionRunner.setUIContext({ notify: message => notices.push(message), setStatus: () => {} });
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'first.txt', content: 'first' } }]);
  await until(() => fs.existsSync(ready), 'scope snapshot');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'later.txt', content: 'later' } }]);
  fs.writeFileSync(release, 'release');
  await until(() => notices.some(message => message.includes('later.txt')), 'new scope snapshot');
  const state = await jsonCommand(session, 'state');
  assert.deepEqual(state.journal.pending, ['first.txt', 'later.txt']);
  assert.equal(state.journal.assessedRevision, state.journal.revision);
  assert.equal(state.recent.length, 1, 'the stale first result never commits');
  assert.equal(notices.length, 1);
  assert.deepEqual(errors, []);
});

test('manual hook runs keep dependency rejection and use the same deadline policy owner', async t => {
  const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 30 };
  const f = fixture(t, [action], 'ADVISORY');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `console.log('{}');`);
  const { session, errors } = await host(t, f.packagePath, f.directory);
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"foreground","critical":"report","output":{"type":"NEVER"},"context":"none","timeoutSeconds":5}}}')).type, 'saved');
  const result = await jsonCommand(session, 'run hook:gate');
  assert.equal(result.type, 'hook-results');
  assert.equal(result.runs[0].action.timeout, 5);
  assert.equal(result.runs[0].result.type, 'completed');
  assert.equal((await jsonCommand(session, 'set session {"schemaVersion":1,"hooks":{"hook:gate":{"execution":"background","critical":"blocking","output":{"type":"NEVER"},"context":"none"}}}')).type, 'rejected');
  assert.equal((await jsonCommand(session, 'run hook:absent')).code, 'UNKNOWN_HOOK');
  fs.writeFileSync(path.join(f.packagePath, 'capabilities.json'), JSON.stringify({ schemaVersion: 1, capabilities: [
    { id: 'resource:missing', type: 'RESOURCE', name: 'missing', path: 'fixture/missing.txt', dependencies: [], profiles: ['fixture'] },
    { id: 'hook:gate', type: 'HOOK', name: 'gate', dependencies: ['resource:missing'], profiles: ['fixture'], actions: [action] },
  ] }));
  const second = await host(t, f.packagePath, f.directory, undefined, path.join(f.directory, 'second-agent'));
  await jsonCommand(second.session, 'set session {"schemaVersion":1,"capabilities":{"hook:gate":false,"resource:missing":false}}');
  const blocked = await jsonCommand(second.session, 'run hook:gate');
  assert.equal(blocked.runs[0].result.code, 'BLOCKED');
  assert.match(blocked.runs[0].result.reason, /DEPENDENCY_UNAVAILABLE/);
  assert.deepEqual(second.errors, []);
  assert.deepEqual(errors, []);
});

test('local instructions, skills, and resources compose independently and missing files recover', async t => {
  const f = fixture(t, [], 'ADVISORY');
  const instruction = path.join(f.directory, 'local-rules.md');
  const skill = path.join(f.directory, 'local-skill/SKILL.md');
  const resource = path.join(f.directory, 'data.json');
  fs.mkdirSync(path.dirname(skill));
  fs.writeFileSync(skill, '---\nname: local-skill\ndescription: Local fixture skill.\n---\nUse the fixture.\n');
  fs.writeFileSync(resource, '{}');
  const additions = [
    { id: 'instruction:local-rules', type: 'INSTRUCTION', name: 'local-rules', path: 'local-rules.md', dependencies: [], profiles: [] },
    { id: 'skill:local-skill', type: 'SKILL', name: 'local-skill', path: skill, dependencies: [], profiles: [] },
    { id: 'resource:local-data', type: 'RESOURCE', name: 'local-data', path: resource, dependencies: [], profiles: [] },
  ];
  const { session, loader, errors } = await host(t, f.packagePath, f.directory);
  assert.equal((await jsonCommand(session, `set project ${JSON.stringify({ schemaVersion: 1, additions })}`)).type, 'saved');
  let state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:local-rules').state, 'unavailable');
  fs.writeFileSync(instruction, 'Use these recovered local instructions.\n');
  state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:local-rules').state, 'enabled');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'instruction:local-rules').capability.path, instruction);
  await session.extendResourcesFromExtensions('reload');
  assert.ok(loader.getSkills().skills.some(item => item.filePath === skill));
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'fixture' }, { cwd: f.directory, skills: loader.getSkills().skills });
  assert.ok(prompt.systemPromptOptions.sections.slopsentral.includes('Use these recovered local instructions.'));
  assert.ok(prompt.systemPromptOptions.sections.slopsentral.includes(resource));
  assert.ok(prompt.systemPromptOptions.skills.some(item => item.filePath === skill));
  await jsonCommand(session, 'set session {"schemaVersion":1,"capabilities":{"instruction:local-rules":false,"skill:local-skill":false}}');
  const disabled = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'fixture' }, { cwd: f.directory, skills: loader.getSkills().skills });
  assert.equal(disabled.systemPromptOptions.sections.slopsentral.includes('Use these recovered local instructions.'), false);
  assert.ok(disabled.systemPromptOptions.sections.slopsentral.includes(resource));
  assert.equal(disabled.systemPromptOptions.skills.some(item => item.filePath === skill), false);
  assert.deepEqual(errors, []);
});

test('an unreadable branch identity rejects assessment without a subprocess or an assessed receipt', async t => {
  const action = { name: 'agents-md-scope', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action], 'ADVISORY');
  fs.mkdirSync(path.join(f.directory, '.git'));
  fs.writeFileSync(path.join(f.directory, '.git/HEAD'), 'invalid branch metadata');
  const ledger = path.join(f.directory, 'must-not-run');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ledger)},'ran');console.log(JSON.stringify({decision:'block',assessment:'ASSESSED',reason:'fixture'}));`);
  const { session, modelRuntime } = await host(t, f.packagePath, f.directory);
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'pending.txt', content: 'pending' } }]);
  const state = await afterJobs(session);
  assert.equal(fs.existsSync(ledger), false);
  assert.equal(state.journal.assessedRevision, 0);
  assert.deepEqual(state.journal.pending, ['pending.txt']);
  assert.match(state.recent[0].result.reason, /WORKSPACE_IDENTITY_UNAVAILABLE/);
});

test('an invalid catalog keeps instructions and commands usable but rejects an unproven hook graph', async t => {
  const action = { name: 'gate', event: 'PreToolUse', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  const profilesFile = path.join(f.packagePath, 'profiles.json');
  const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
  profiles.profiles[0].instructions.push({ name: 'rules', path: 'fixture/rules.md' });
  fs.writeFileSync(profilesFile, JSON.stringify(profiles));
  fs.writeFileSync(path.join(f.packagePath, 'fixture/rules.md'), 'Use the isolated fixture instructions.');
  fs.writeFileSync(path.join(f.packagePath, 'capabilities.json'), '{"schemaVersion":999}');
  const ledger = path.join(f.directory, 'hook-must-not-run');
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), `import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(ledger)},'ran');console.log('{}');`);
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  const prompt = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'fixture' }, { cwd: f.directory, skills: [] });
  assert.ok(prompt.systemPromptOptions.sections.slopsentral.includes('Use the isolated fixture instructions.'));
  assert.ok(session.extensionRunner.getRegisteredCommands().some(command => command.name === 'slopsentral'));
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'forbidden.txt', content: 'must not write' } }]);
  assert.equal(fs.existsSync(ledger), false, 'unknown dependencies must not authorize a hook process');
  assert.equal(fs.existsSync(path.join(f.directory, 'forbidden.txt')), false, 'the affected blocking operation must remain blocked');
  const state = await jsonCommand(session, 'state');
  assert.equal(state.effective.capabilities.find(item => item.capability.id === 'hook:gate').reason, 'CATALOG_UNAVAILABLE');
  assert.ok(state.errors.includes('INVALID_CATALOG'));
  assert.deepEqual(errors, []);
});

test('malformed first-load settings reject effects until a settings command repairs the layer', async t => {
  const action = { name: 'gate', event: 'PreToolUse', plugin: 'fixture', argv: [process.execPath, 'hooks/gate.mjs'], timeout: 5 };
  const f = fixture(t, [action]);
  fs.writeFileSync(path.join(f.packagePath, 'fixture/hooks/gate.mjs'), "console.log('{}');");
  fs.mkdirSync(path.join(f.directory, '.pi'));
  fs.writeFileSync(path.join(f.directory, '.pi/slopsentral.json'), '{broken');
  const { session, modelRuntime, errors } = await host(t, f.packagePath, f.directory);
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'forbidden.txt', content: 'must not write' } }]);
  assert.equal(fs.existsSync(path.join(f.directory, 'forbidden.txt')), false, 'unadmitted settings must not select default hook semantics');
  assert.equal((await jsonCommand(session, 'state')).effective.type, 'rejected');
  assert.ok(session.extensionRunner.getRegisteredCommands().some(command => command.name === 'slopsentral'));
  assert.equal((await jsonCommand(session, 'set project {"schemaVersion":1}')).type, 'saved');
  await nativeTools(session, modelRuntime, [{ name: 'write', args: { path: 'recovered.txt', content: 'recovered' } }]);
  assert.equal(fs.readFileSync(path.join(f.directory, 'recovered.txt'), 'utf8'), 'recovered');
  assert.equal((await jsonCommand(session, 'state')).effective.type, 'effective');
  assert.deepEqual(errors, []);
});
